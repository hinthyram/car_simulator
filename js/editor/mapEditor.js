"use strict";

import { MapStorage } from "../../shared/mapStorage.js";
import { normalizeMap, createMap } from "../../shared/mapSchema.js";

/*
 * M3: 외부 Three.js 의존성을 제거한 자체 Canvas 3D 뷰어.
 * 파일을 더블클릭(file://)으로 열어도 동작하도록 설계했다.
 */
const TILE_TYPES={
 asphalt:{name:"아스팔트",friction:.95,color:"#202328"},
 concrete:{name:"콘크리트",friction:.90,color:"#777b80"},
 gravel:{name:"자갈",friction:.65,color:"#756b5d"},
 dirt:{name:"흙",friction:.55,color:"#6f5035"},
 grass:{name:"잔디",friction:.40,color:"#41663b"},
 ice:{name:"얼음",friction:.15,color:"#9cc8dc"}
};

const $=id=>document.getElementById(id);
const canvas=$("canvas"),ctx=canvas.getContext("2d");
const params=new URLSearchParams(location.search), editingId=params.get("id");

let W=200,L=200,tileSize=10,cols=20,rows=20;
let tiles=[],selected="asphalt",mode="tile",heightStep=.5;
let obstacles=[],selectedObstacle=null,fenceYaw=0,selectedFenceShape="straightH",painting=false,painted=new Set();
let spawn={x:0,y:.05,z:0,yaw:0},dirty=false;
const FOV=55;
let cam={yaw:.72,pitch:.82,distance:270,targetX:0,targetY:0,targetZ:0};
let dragging=false,moved=false,lastX=0,lastY=0,panMode=false;
let hoverTile=-1;

function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function colorHex(hex){
 const n=parseInt(hex.slice(1),16);
 return [(n>>16)&255,(n>>8)&255,n&255];
}
function shade(hex,k){
 const [r,g,b]=colorHex(hex), f=clamp(k,0,1);
 return `rgb(${Math.round(r*f)},${Math.round(g*f)},${Math.round(b*f)})`;
}
function tileDefault(){return {type:"grass",height:0}}
function ensureTiles(){while(tiles.length<cols*rows)tiles.push(tileDefault());tiles.length=cols*rows}
function tilePos(i){
 const r=Math.floor(i/cols),c=i%cols;
 return {x:-W/2+(c+.5)*tileSize,z:-L/2+(r+.5)*tileSize};
}
function mapFromStorage(id){
 return MapStorage.get(id);
}
function initMap(m){
 W=Number(m?.size?.width)||200;L=Number(m?.size?.length)||200;
 tileSize=Number(m?.tileSize)||10;
 cols=Number(m?.grid?.cols)||Math.max(1,Math.round(W/tileSize));
 rows=Number(m?.grid?.rows)||Math.max(1,Math.round(L/tileSize));
 W=cols*tileSize;L=rows*tileSize;
 tiles=Array.isArray(m?.tiles)?m.tiles.map(t=>({type:t.type||"grass",height:Number(t.height)||0})):[];
 ensureTiles();
 obstacles=Array.isArray(m?.obstacles)?m.obstacles.map(o=>{
   if(o.type==="tree") return {type:"tree",x:Number(o.x)||0,z:Number(o.z)||0,yaw:Number(o.yaw)||0,scale:Number(o.scale)||1};
   if(o.type==="fenceCorner") return {type:"fenceCorner",corner:["nw","ne","sw","se"].includes(o.corner)?o.corner:"nw",x:Number(o.x)||0,z:Number(o.z)||0,yaw:Number(o.yaw)||0,scale:Number(o.scale)||1};
   return {type:"fence",x:Number(o.x)||0,z:Number(o.z)||0,yaw:Number(o.yaw)||0,scale:Number(o.scale)||1};
 }):[]; 
 spawn=m?.spawn?{...m.spawn}:{x:0,y:.05,z:0,yaw:0};
 $("name").value=m?.name||"새 맵";
 $("spawnYaw").value=Math.round(((Number(spawn.yaw)||0)%360+360)%360);
 $("deleteMap").style.display=m?.id?"block":"none";
 $("loaded").textContent=m?.id?"편집 중: "+m.id:"새 맵";
 cam.targetX=0;cam.targetZ=0;
 updateInputs();dirty=false;updateViewIndicator();draw();
}
function updateInputs(){
 $("width").value=W;$("length").value=L;$("tileSize").value=tileSize;
 $("sizeStat").textContent=`실제 ${W} × ${L} m · ${cols} × ${rows} 타일 · ${tileSize}m`;
}
function setMode(m){
 mode=m;
 $("raise").classList.toggle("active",m==="raise");
 $("lower").classList.toggle("active",m==="lower");
 $("spawnMode").classList.toggle("active",m==="spawn");
 $("obstacleErase").classList.toggle("active",m==="obstacleErase");
 document.querySelectorAll(".tile").forEach(x=>x.classList.toggle("active",m==="tile"&&x.dataset.id===selected));
 document.querySelectorAll(".obstacle").forEach(x=>x.classList.toggle("active",m==="obstacle"&&x.dataset.obstacle===selectedObstacle));
 $("fenceX").classList.toggle("active",m==="obstacle"&&selectedObstacle==="fence"&&selectedFenceShape==="straightH");
 $("fenceZ").classList.toggle("active",m==="obstacle"&&selectedObstacle==="fence"&&selectedFenceShape==="straightV");
 document.querySelectorAll(".fence-corner").forEach(x=>x.classList.toggle("active",m==="obstacle"&&selectedObstacle==="fence"&&selectedFenceShape===x.dataset.corner));
 updateStatus();
}
function updateStatus(){
 if(mode==="spawn")$("status").textContent="시작 위치 지정: 타일을 클릭하세요.";
 else if(mode==="raise")$("status").textContent=`높이 +${heightStep.toFixed(1)}m`;
 else if(mode==="lower")$("status").textContent=`높이 -${heightStep.toFixed(1)}m`;
 else if(mode==="obstacle"){
 if(selectedObstacle==="tree")$("status").textContent="나무 배치";
 else if(selectedFenceShape==="straightH")$("status").textContent="가로 울타리 배치";
 else if(selectedFenceShape==="straightV")$("status").textContent="세로 울타리 배치";
 else $("status").textContent=`ㄱ자 울타리 ${selectedFenceShape.toUpperCase()} 배치`;
}
 else if(mode==="obstacleErase")$("status").textContent="구조물 제거";
 else {const t=TILE_TYPES[selected];$("status").textContent=`${t.name} · μ ${t.friction.toFixed(2)}`;}
}
function createTileButtons(){
 const box=$("tiles");box.innerHTML="";
 Object.entries(TILE_TYPES).forEach(([id,t])=>{
   const b=document.createElement("button");b.className="tile";b.dataset.id=id;
   b.innerHTML=`${t.name}<small>μ ${t.friction.toFixed(2)}</small>`;
   b.onclick=()=>{selected=id;setMode("tile");b.blur();};
   box.appendChild(b);
 });
 box.firstElementChild.classList.add("active");
}

function resize(){
 const dpr=Math.min(devicePixelRatio||1,2),w=canvas.clientWidth,h=canvas.clientHeight;
 canvas.width=Math.max(1,Math.floor(w*dpr));canvas.height=Math.max(1,Math.floor(h*dpr));
 ctx.setTransform(dpr,0,0,dpr,0,0);draw();
}
function cameraBasis(){
 const cy=Math.cos(cam.yaw),sy=Math.sin(cam.yaw);
 const cp=Math.cos(cam.pitch),sp=Math.sin(cam.pitch);
 const pos={
   x:cam.targetX+cam.distance*cp*sy,
   y:cam.targetY+cam.distance*sp,
   z:cam.targetZ+cam.distance*cp*cy
 };
 // Camera looks exactly at target.
 const forward={x:-cp*sy,y:-sp,z:-cp*cy};
 // Right vector stays horizontal, so yaw is intuitive.
 const right={x:cy,y:0,z:-sy};
 // Up = right × forward.
 const up={
   x:right.y*forward.z-right.z*forward.y,
   y:right.z*forward.x-right.x*forward.z,
   z:right.x*forward.y-right.y*forward.x
 };
 return {pos,forward,right,up};
}
function project(p){
 const b=cameraBasis();
 const dx=p.x-b.pos.x,dy=p.y-b.pos.y,dz=p.z-b.pos.z;
 const vx=dx*b.right.x+dy*b.right.y+dz*b.right.z;
 const vy=dx*b.up.x+dy*b.up.y+dz*b.up.z;
 const vz=dx*b.forward.x+dy*b.forward.y+dz*b.forward.z;
 const aspect=Math.max(.1,canvas.clientWidth/canvas.clientHeight);
 const focal=(canvas.clientHeight/2)/Math.tan(FOV*Math.PI/360);
 return {
   x:canvas.clientWidth/2+(vx/vz)*focal,
   y:canvas.clientHeight/2-(vy/vz)*focal,
   z:vz
 };
}
function tileVertexHeight(col,row){
 // Shared vertex height: average the surrounding tile heights.
 // This makes adjacent elevated tiles meet at exactly the same vertex
 // instead of leaving cracks or hard vertical steps.
 let sum=0,count=0;
 for(let rr=row-1;rr<=row;rr++){
   for(let cc=col-1;cc<=col;cc++){
     if(cc>=0&&cc<cols&&rr>=0&&rr<rows){
       sum+=Number(tiles[rr*cols+cc]?.height)||0; count++;
     }
   }
 }
 return count?sum/count:0;
}
function tileTopWorld(i){
 const r=Math.floor(i/cols),c=i%cols;
 const x0=-W/2+c*tileSize,x1=x0+tileSize;
 const z0=-L/2+r*tileSize,z1=z0+tileSize;
 return [
   {x:x0,y:tileVertexHeight(c,r),z:z0},
   {x:x1,y:tileVertexHeight(c+1,r),z:z0},
   {x:x1,y:tileVertexHeight(c+1,r+1),z:z1},
   {x:x0,y:tileVertexHeight(c,r+1),z:z1}
 ];
}
function drawTile(i){
 const t=tiles[i],info=TILE_TYPES[t.type]||TILE_TYPES.grass;
 const wp=tileTopWorld(i);
 const top=wp.map(v=>project(v));
 const bottom=wp.map(v=>project({x:v.x,y:0,z:v.z}));

 // Draw only the tile's side faces. Top surfaces are full-size and share
 // exact vertices with neighbors, so there is no physical-looking gap.
 const all=top.concat(bottom);
 const faces=[
   [0,1,5,4,.78],
   [1,2,6,5,.68],
   [2,3,7,6,.74],
   [3,0,4,7,.82]
 ];
 faces.sort((a,b)=>((all[b[0]].z+all[b[1]].z)/2)-((all[a[0]].z+all[a[1]].z)/2));
 faces.forEach(f=>{
   const avgY=(wp[f[0]].y+wp[f[1]].y)/2;
   if(avgY<=0.001)return;
   ctx.beginPath();
   ctx.moveTo(all[f[0]].x,all[f[0]].y);ctx.lineTo(all[f[1]].x,all[f[1]].y);
   ctx.lineTo(all[f[2]].x,all[f[2]].y);ctx.lineTo(all[f[3]].x,all[f[3]].y);ctx.closePath();
   ctx.fillStyle=shade(info.color,f[4]);ctx.fill();
 });

 // Semi-transparent volume under each tile. This makes the lower side of
 // the terrain readable when the camera is below the map.
 const baseY=-Math.max(1.5,tileSize*0.18);
 const base=wp.map(v=>project({x:v.x,y:baseY,z:v.z}));
 const vol=top.concat(base);
 const volumeFaces=[[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]];
 volumeFaces.sort((a,b)=>((vol[b[0]].z+vol[b[1]].z)/2)-((vol[a[0]].z+vol[a[1]].z)/2));
 ctx.save();
 ctx.globalAlpha=.22;
 volumeFaces.forEach(f=>{
   ctx.beginPath();ctx.moveTo(vol[f[0]].x,vol[f[0]].y);ctx.lineTo(vol[f[1]].x,vol[f[1]].y);
   ctx.lineTo(vol[f[2]].x,vol[f[2]].y);ctx.lineTo(vol[f[3]].x,vol[f[3]].y);ctx.closePath();
   ctx.fillStyle="#9aaebb";ctx.fill();
 });
 ctx.globalAlpha=.10;
 ctx.beginPath();ctx.moveTo(base[0].x,base[0].y);for(let j=1;j<4;j++)ctx.lineTo(base[j].x,base[j].y);ctx.closePath();
 ctx.fillStyle="#9aaebb";ctx.fill();
 ctx.restore();

 ctx.beginPath();ctx.moveTo(top[0].x,top[0].y);
 for(let j=1;j<4;j++)ctx.lineTo(top[j].x,top[j].y);
 ctx.closePath();
 ctx.fillStyle=info.color;ctx.fill();

 // Very subtle boundary only where tile material changes.
 const r=Math.floor(i/cols),c=i%cols;
 const neighborTypes=[];
 if(c>0)neighborTypes.push(tiles[i-1]?.type);
 if(c<cols-1)neighborTypes.push(tiles[i+1]?.type);
 if(r>0)neighborTypes.push(tiles[i-cols]?.type);
 if(r<rows-1)neighborTypes.push(tiles[i+cols]?.type);
 const different=neighborTypes.some(type=>type!==t.type);
 if(different){
   ctx.strokeStyle="rgba(255,255,255,.08)";ctx.lineWidth=.45;ctx.stroke();
 }
 if(Math.abs(t.height)>0.001){
   const center=project({x:(wp[0].x+wp[2].x)/2,y:t.height,z:(wp[0].z+wp[2].z)/2});
   ctx.fillStyle="rgba(255,255,255,.7)";ctx.font="10px Arial";
   ctx.fillText(t.height.toFixed(1)+"m",center.x+3,center.y-3);
 }
}

function drawObstacle(o){
 const baseY=tileVertexHeight(
   Math.floor((o.x+W/2)/tileSize),
   Math.floor((o.z+L/2)/tileSize)
 );
 const center=project({x:o.x,y:baseY,z:o.z});
 const s=tileSize*.42*(o.scale||1);
 const ang=(o.yaw||0)*Math.PI/180;

 if(o.type==="tree"){
   // Tree is always anchored to the exact center of its tile.
   // Draw a clear top-view tree symbol: trunk + circular canopy + center marker.
   const r=tileSize*.25*(o.scale||1);
   ctx.save();
   ctx.beginPath();
   ctx.arc(center.x,center.y,r,0,Math.PI*2);
   ctx.fillStyle="rgba(46,112,61,.96)";
   ctx.fill();
   ctx.strokeStyle="rgba(170,235,175,.95)";
   ctx.lineWidth=2;
   ctx.stroke();

   ctx.beginPath();
   ctx.arc(center.x,center.y,r*.38,0,Math.PI*2);
   ctx.fillStyle="rgba(93,64,38,.95)";
   ctx.fill();

   // Crosshair makes the tile-center placement obvious.
   ctx.strokeStyle="rgba(255,255,255,.72)";
   ctx.lineWidth=1.5;
   ctx.beginPath();
   ctx.moveTo(center.x-r*.55,center.y);
   ctx.lineTo(center.x+r*.55,center.y);
   ctx.moveTo(center.x,center.y-r*.55);
   ctx.lineTo(center.x,center.y+r*.55);
   ctx.stroke();
   ctx.restore();
   return;
 }

 if(o.type==="fenceCorner"){
   const len=tileSize*.82*(o.scale||1), half=len*.5;
   const arms={nw:[[half,0],[0,half]],ne:[[-half,0],[0,half]],sw:[[half,0],[0,-half]],se:[[-half,0],[0,-half]]};
   const pts=arms[o.corner]||arms.nw;
   const a=project({x:o.x+pts[0][0],y:baseY+.05,z:o.z+pts[0][1]});
   const c=project({x:o.x,y:baseY+.05,z:o.z});
   const b=project({x:o.x+pts[1][0],y:baseY+.05,z:o.z+pts[1][1]});
   ctx.save();ctx.lineCap="round";ctx.lineJoin="round";
   ctx.strokeStyle="rgba(0,0,0,.38)";ctx.lineWidth=10;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(c.x,c.y);ctx.lineTo(b.x,b.y);ctx.stroke();
   ctx.strokeStyle="#d7dde0";ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(c.x,c.y);ctx.lineTo(b.x,b.y);ctx.stroke();
   ctx.fillStyle="#aab2b6";[a,c,b].forEach(p=>{ctx.beginPath();ctx.arc(p.x,p.y,4,0,Math.PI*2);ctx.fill()});
   ctx.restore();return;
 }

 // Fence: the map indicator itself shows its orientation.
 // yaw 0/180 -> vertical on the map; yaw 90/270 -> horizontal.
 const len=tileSize*.82*(o.scale||1);
 const dx=Math.cos(ang)*len*.5;
 const dz=Math.sin(ang)*len*.5;
 const a=project({x:o.x-dx,y:baseY+.05,z:o.z-dz});
 const b=project({x:o.x+dx,y:baseY+.05,z:o.z+dz});

 ctx.save();
 ctx.lineCap="round";
 ctx.lineJoin="round";

 // Shadow / collision footprint.
 ctx.strokeStyle="rgba(0,0,0,.38)";
 ctx.lineWidth=10;
 ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();

 // Main fence rail.
 ctx.strokeStyle="#d7dde0";
 ctx.lineWidth=6;
 ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();

 // Posts at both ends and center.
 ctx.fillStyle="#aab2b6";
 [0,.5,1].forEach(t=>{
   const x=a.x+(b.x-a.x)*t, y=a.y+(b.y-a.y)*t;
   ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.fill();
 });

 // Direction arrow in the middle: makes horizontal/vertical unmistakable.
 const mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
 const vx=(b.x-a.x),vy=(b.y-a.y);
 const vlen=Math.hypot(vx,vy)||1, ux=vx/vlen,uy=vy/vlen;
 const arrow=12;
 ctx.strokeStyle="#22b8ff";
 ctx.lineWidth=2.5;
 ctx.beginPath();
 ctx.moveTo(mx-ux*arrow,my-uy*arrow);
 ctx.lineTo(mx+ux*arrow,my+uy*arrow);
 ctx.stroke();
 ctx.beginPath();
 ctx.moveTo(mx+ux*arrow,my+uy*arrow);
 ctx.lineTo(mx+ux*(arrow-6)-uy*4,my+uy*(arrow-6)+ux*4);
 ctx.lineTo(mx+ux*(arrow-6)+uy*4,my+uy*(arrow-6)-ux*4);
 ctx.closePath();
 ctx.fillStyle="#22b8ff";ctx.fill();

 ctx.restore();
}
function obstacleAtScreen(e){
 const p=screenToWorld(e); if(!p)return null;
 let best=-1,bestD=Infinity;
 obstacles.forEach((o,i)=>{
   const d=Math.hypot(o.x-p.x,o.z-p.z);
   if(d<tileSize*.65*(o.scale||1)&&d<bestD){best=i;bestD=d;}
 });
 return best>=0?best:null;
}
function draw(){
 const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;
 ctx.clearRect(0,0,w,h);
 const grad=ctx.createLinearGradient(0,0,0,h);grad.addColorStop(0,"#252b31");grad.addColorStop(1,"#0d1014");ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);
 // Sort tiles back-to-front.
 const order=[];for(let i=0;i<tiles.length;i++){const p=tilePos(i),q=project({x:p.x,y:tiles[i].height,z:p.z});order.push({i,z:q.z})}
 order.sort((a,b)=>b.z-a.z);order.forEach(o=>drawTile(o.i));
 obstacles.slice().sort((a,b)=>project({x:b.x,y:0,z:b.z}).z-project({x:a.x,y:0,z:a.z}).z).forEach(drawObstacle);
 if(hoverTile>=0 && tiles[hoverTile]){
   const p=tilePos(hoverTile),hh=tiles[hoverTile].height+.04,s=tileSize*.5;
   const q=[project({x:p.x-s,y:hh,z:p.z-s}),project({x:p.x+s,y:hh,z:p.z-s}),project({x:p.x+s,y:hh,z:p.z+s}),project({x:p.x-s,y:hh,z:p.z+s})];
   ctx.beginPath();ctx.moveTo(q[0].x,q[0].y);for(let k=1;k<4;k++)ctx.lineTo(q[k].x,q[k].y);ctx.closePath();
   ctx.fillStyle="rgba(22,131,255,.20)";ctx.fill();ctx.strokeStyle="#1683ff";ctx.lineWidth=2;ctx.stroke();
 }
 // Spawn marker + direction arrow.
 const sp=project({x:spawn.x,y:spawn.y+1,z:spawn.z});
 const ang=Number(spawn.yaw||0)*Math.PI/180;
 const ahead=project({x:spawn.x+Math.sin(ang)*tileSize*.9,y:spawn.y+1,z:spawn.z+Math.cos(ang)*tileSize*.9});
 ctx.beginPath();ctx.arc(sp.x,sp.y,7,0,Math.PI*2);ctx.fillStyle="#00d9ff";ctx.fill();ctx.strokeStyle="#fff";ctx.stroke();
 ctx.beginPath();ctx.moveTo(sp.x,sp.y);ctx.lineTo(ahead.x,ahead.y);ctx.strokeStyle="#00d9ff";ctx.lineWidth=4;ctx.stroke();
 const adx=ahead.x-sp.x,ady=ahead.y-sp.y,len=Math.hypot(adx,ady)||1,ux=adx/len,uy=ady/len;
 ctx.beginPath();ctx.moveTo(ahead.x,ahead.y);ctx.lineTo(ahead.x-ux*12-uy*6,ahead.y-uy*12+ux*6);ctx.lineTo(ahead.x-ux*12+uy*6,ahead.y-uy*12-ux*6);ctx.closePath();ctx.fillStyle="#00d9ff";ctx.fill();
 ctx.fillStyle="#fff";ctx.font="11px Arial";ctx.fillText("START",sp.x+10,sp.y+4);
}
function screenToWorld(e){
 const rect=canvas.getBoundingClientRect();
 const sx=e.clientX-rect.left, sy=e.clientY-rect.top;
 const ndcX=(sx/rect.width)*2-1;
 const ndcY=1-(sy/rect.height)*2;
 const b=cameraBasis();
 const aspect=Math.max(.1,rect.width/rect.height);
 const tan=Math.tan(FOV*Math.PI/360);
 // Same perspective equation used by project(), so picking and drawing
 // share exactly the same camera transform.
 let dx=b.forward.x + b.right.x*ndcX*tan*aspect + b.up.x*ndcY*tan;
 let dy=b.forward.y + b.right.y*ndcX*tan*aspect + b.up.y*ndcY*tan;
 let dz=b.forward.z + b.right.z*ndcX*tan*aspect + b.up.z*ndcY*tan;
 const len=Math.hypot(dx,dy,dz); dx/=len;dy/=len;dz/=len;
 const tt=Math.abs(dy)>1e-7 ? (0-b.pos.y)/dy : 0;
 if(tt<=0) return null;
 return {x:b.pos.x+dx*tt,z:b.pos.z+dz*tt};
}
function hitTile(e){
 const p=screenToWorld(e);
 if(!p)return null;
 const c=Math.floor((p.x+W/2)/tileSize),r=Math.floor((p.z+L/2)/tileSize);
 if(c<0||c>=cols||r<0||r>=rows)return null;
 return {i:r*cols+c,x:-W/2+(c+.5)*tileSize,z:-L/2+(r+.5)*tileSize};
}
function updateHover(e){
 const hit=hitTile(e); hoverTile=hit?hit.i:-1; draw();
}
canvas.addEventListener("pointerdown",e=>{
 const hit=hitTile(e);
 const isCamera=e.shiftKey||e.button===1||(!hit && e.button===0);
 if(e.button===0 && hit && !e.shiftKey && mode==="spawn"){
   const t=tiles[hit.i];
   spawn={x:hit.x,y:Number(t?.height)||0.05,z:hit.z,yaw:Number(spawn.yaw)||0};
   dirty=true;
   $("status").textContent=`시작 위치: X ${spawn.x.toFixed(1)} / Z ${spawn.z.toFixed(1)} / 방향 ${spawn.yaw.toFixed(0)}°`;
   draw();
   return;
 }
 if(e.button===0 && hit && !e.shiftKey && mode!=="spawn"){

   painting=true;painted.clear();lastX=e.clientX;lastY=e.clientY;canvas.classList.add("drag"); 
   applyHit(hit); e.preventDefault(); return;
 }
 dragging=true;moved=false;panMode=e.shiftKey||e.button===1;
 lastX=e.clientX;lastY=e.clientY;canvas.classList.add("drag");
});
window.addEventListener("pointermove",e=>{
 if(painting){
   const hit=hitTile(e); if(hit)applyHit(hit);
   lastX=e.clientX;lastY=e.clientY;draw();return;
 }
 if(!dragging){updateHover(e);return;}
 const dx=e.clientX-lastX,dy=e.clientY-lastY;
 if(Math.abs(dx)+Math.abs(dy)>2)moved=true;
 lastX=e.clientX;lastY=e.clientY;
 if(panMode){const f=cam.distance*.002;cam.targetX-=dx*f*Math.cos(cam.yaw);cam.targetZ+=dx*f*Math.sin(cam.yaw);cam.targetY=clamp(cam.targetY+dy*f,-50,100);}
 else {cam.yaw-=dx*.008;cam.pitch=clamp(cam.pitch+dy*.006,-1.54,1.54);updateViewIndicator();}
 draw();
});
window.addEventListener("pointerup",()=>{painting=false;dragging=false;canvas.classList.remove("drag");painted.clear();});
function applyHit(hit){
 const t=tiles[hit.i];
 if(painted.has(hit.i))return;
 painted.add(hit.i);
 if(mode==="tile")t.type=selected;
 else if(mode==="raise")t.height+=heightStep;
 else if(mode==="lower")t.height-=heightStep;
 else if(mode==="obstacle") {
   const exists=obstacles.find(o=>Math.hypot(o.x-hit.x,o.z-hit.z)<tileSize*.45);
   if(!exists){
 if(selectedObstacle==="tree") obstacles.push({type:"tree",x:hit.x,z:hit.z,yaw:0,scale:1});
 else if(selectedFenceShape==="straightH") obstacles.push({type:"fence",x:hit.x,z:hit.z,yaw:0,scale:1});
 else if(selectedFenceShape==="straightV") obstacles.push({type:"fence",x:hit.x,z:hit.z,yaw:90,scale:1});
 else obstacles.push({type:"fenceCorner",corner:selectedFenceShape,x:hit.x,z:hit.z,yaw:0,scale:1});
}
 } else if(mode==="obstacleErase"){
   const idx=obstacleAtScreen({clientX:lastX,clientY:lastY});
   if(idx!==null)obstacles.splice(idx,1);
 }
 dirty=true;draw();
 if(mode==="spawn")$("status").textContent=`시작점 X ${hit.x.toFixed(1)} / Z ${hit.z.toFixed(1)} / Y ${t.height.toFixed(1)}`;
}
canvas.addEventListener("click",e=>{
 if(moved||painting)return;
 const hit=hitTile(e);if(!hit)return;
 applyHit(hit);
});
canvas.addEventListener("wheel",e=>{e.preventDefault();cam.distance=clamp(cam.distance*Math.exp(e.deltaY*.001),30,1600);draw()},{passive:false});

$("heightStep").addEventListener("input",()=>{
  const v=Number($("heightStep").value);
  if(Number.isFinite(v)&&v>0) heightStep=v;
  updateStatus();
}); 
$("raise").onclick=()=>setMode("raise");document.querySelectorAll(".tile").forEach(x=>x.classList.remove("active"));$("lower").onclick=()=>setMode("lower");document.querySelectorAll(".tile").forEach(x=>x.classList.remove("active"));
document.querySelectorAll(".obstacle").forEach(b=>b.onclick=()=>{
 selectedObstacle=b.dataset.obstacle;
 if(selectedObstacle==="tree")selectedFenceShape="straightH";
 setMode("obstacle");b.blur();
});
document.querySelectorAll(".fence-corner").forEach(b=>b.onclick=()=>{
 selectedObstacle="fence";selectedFenceShape=b.dataset.corner;setMode("obstacle");b.blur();draw();
});
$("obstacleErase").onclick=()=>{setMode("obstacleErase");$("obstacleErase").blur();draw()};
$("fenceX").onclick=()=>{fenceYaw=0;selectedObstacle="fence";selectedFenceShape="straightH";setMode("obstacle");$("fenceX").blur();draw()};
$("fenceZ").onclick=()=>{fenceYaw=90;selectedObstacle="fence";selectedFenceShape="straightV";setMode("obstacle");$("fenceZ").blur();draw()};
$("obstacleClear").onclick=()=>{if(obstacles.length&&!confirm("맵의 모든 구조물을 제거할까요?"))return;obstacles=[];dirty=true;draw();};
$("spawnMode").onclick=()=>{setMode("spawn");document.querySelectorAll(".tile").forEach(x=>x.classList.remove("active"));$("spawnMode").blur();};
$("flat").onclick=()=>{tiles.forEach(t=>t.height=0);dirty=true;draw()};
$("spawnYaw").addEventListener("input",()=>{
  let v=Number($("spawnYaw").value)||0; v=((v%360)+360)%360;
  spawn.yaw=v;$("spawnYaw").value=Math.round(v);dirty=true;draw();
});
$("spawnNorth").onclick=()=>{$("spawnYaw").value=0;spawn.yaw=0;dirty=true;draw()};
$("spawnRight").onclick=()=>{$("spawnYaw").value=90;spawn.yaw=90;dirty=true;draw()};
$("spawnLeft").onclick=()=>{$("spawnYaw").value=270;spawn.yaw=270;dirty=true;draw()};
$("applySize").onclick=()=>{
 const nw=Math.max(20,Number($("width").value)||200),nl=Math.max(20,Number($("length").value)||200),ns=Math.max(2,Number($("tileSize").value)||10);
 const nc=Math.max(1,Math.round(nw/ns)),nr=Math.max(1,Math.round(nl/ns));
 const old=tiles,oc=cols,or=rows;cols=nc;rows=nr;tileSize=ns;W=cols*tileSize;L=rows*tileSize;tiles=new Array(cols*rows);
 for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)tiles[r*cols+c]=old[r*oc+c]?{...old[r*oc+c]}:tileDefault();
 updateInputs();dirty=true;draw();
};
function mapData(){
  const id=editingId||"map_"+Date.now();
  return normalizeMap({
    id,
    name:$("name").value.trim()||"새 맵",
    size:{width:W,length:L},
    tileSize,
    grid:{cols,rows},
    tileTypes:TILE_TYPES,
    tiles,
    spawn,
    obstacles
  });
}
$("saveBtn").onclick=async()=>{
 try{
 const m=await MapStorage.save(mapData());
 localStorage.setItem("drivingSim_activeMap",JSON.stringify(m));
 history.replaceState(null,"","?id="+encodeURIComponent(m.id));
 $("deleteMap").style.display="block";$("loaded").textContent="편집 중: "+m.id;dirty=false;alert("서버에 저장되었습니다.");
 }catch(err){alert("저장 실패: "+err.message)}
};
$("playBtn").onclick=async()=>{try{const m=await MapStorage.save(mapData());
 localStorage.setItem("drivingSim_activeMap",JSON.stringify(m));
 location.href="../simulator/simulation.html?map="+encodeURIComponent(m.id)+"&returnEditor=1";
}catch(err){alert("저장 실패: "+err.message)}
};
$("deleteMap").onclick=async()=>{if(editingId&&confirm("현재 맵을 삭제할까요?")){try{await MapStorage.remove(editingId);location.href="../index.html"}catch(err){alert("삭제 실패: "+err.message)}}};
$("newBtn").onclick=()=>{if(dirty&&!confirm("저장하지 않은 변경사항을 버릴까요?"))return;initMap(null)};
function updateViewIndicator(){
 const el=$("viewIndicator");
 if($("view2d").classList.contains("active")) el.textContent="탑뷰 · 위쪽 보기";
 else if(cam.pitch < -0.08) el.textContent="3D · 아래쪽 보기";
 else if(cam.pitch > 1.35) el.textContent="3D · 위쪽 보기";
 else if(Math.abs(cam.pitch) < .08) el.textContent="3D · 수평 보기";
 else el.textContent="3D · 위쪽 보기";
}
$("view3d").onclick=()=>{
 $("view3d").classList.add("active");$("view2d").classList.remove("active");
 cam.pitch=.72;cam.yaw=.72;cam.distance=Math.max(W,L)*1.15;cam.targetY=0;updateViewIndicator();draw();
};
$("view2d").onclick=()=>{
 $("view2d").classList.add("active");$("view3d").classList.remove("active");
 cam.pitch=1.54;cam.yaw=0;cam.distance=Math.max(W,L)*.72;cam.targetY=0;updateViewIndicator();draw();
};
window.addEventListener("resize",resize);

(async()=>{
    const serverAvailable=await MapStorage.init();
    try{
        const saved=editingId?await mapFromStorage(editingId):null;
        createTileButtons(); initMap(saved); resize();
        if(!serverAvailable) $("status").textContent="오프라인 편집 모드 · 서버 저장은 연결 후 사용";
    }catch(err){
        createTileButtons(); initMap(null); resize();
        console.warn("[CAR SIM] Map editor fallback mode.",err);
        $("status").textContent="오프라인 편집 모드 · 서버 저장은 연결 후 사용";
    }
})();
