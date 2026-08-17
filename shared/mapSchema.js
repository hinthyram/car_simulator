/*
 * Canonical map data contract.
 * Version 5 is the first explicitly normalized transport format.
 * The functions are deliberately browser/server friendly: no DOM or Three.js.
 */

export const MAP_SCHEMA_VERSION = 5;

const DEFAULT_TILE_TYPES = {
  asphalt:{name:"아스팔트",friction:.95,color:"#202328"},
  concrete:{name:"콘크리트",friction:.90,color:"#777b80"},
  gravel:{name:"자갈",friction:.65,color:"#756b5d"},
  dirt:{name:"흙",friction:.55,color:"#6f5035"},
  grass:{name:"잔디",friction:.40,color:"#41663b"},
  ice:{name:"얼음",friction:.15,color:"#9cc8dc"}
};

const CORNERS = new Set(["nw","ne","sw","se"]);

const num=(v,d=0)=>{
  const n=Number(v);
  return Number.isFinite(n)?n:d;
};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export function normalizeMap(input, {preserveUnknown=true}={}) {
  const m=input && typeof input==="object" ? input : {};
  const sizeIn=m.size||{};
  const gridIn=m.grid||{};
  const tileSize=Math.max(.1,num(m.tileSize,10));
  const cols=Math.max(1,Math.round(num(gridIn.cols,num(sizeIn.width,200)/tileSize)));
  const rows=Math.max(1,Math.round(num(gridIn.rows,num(sizeIn.length,200)/tileSize)));
  const width=cols*tileSize;
  const length=rows*tileSize;

  const tileTypes={...DEFAULT_TILE_TYPES};
  if(m.tileTypes && typeof m.tileTypes==="object"){
    for(const [key,val] of Object.entries(m.tileTypes)){
      if(!val || typeof val!=="object") continue;
      tileTypes[key]={
        name:String(val.name||key),
        friction:clamp(num(val.friction,.5),0,2),
        color:String(val.color||"#777777")
      };
    }
  }

  const rawTiles=Array.isArray(m.tiles)?m.tiles:[];
  const tiles=Array.from({length:cols*rows},(_,i)=>{
    const t=rawTiles[i]||{};
    const type=tileTypes[t.type]?t.type:"grass";
    return {type,height:num(t.height,0)};
  });

  const obstacles=Array.isArray(m.obstacles)?m.obstacles.map(o=>{
    if(!o || typeof o!=="object") return null;
    const type=o.type==="tree"?"tree":o.type==="fenceCorner"?"fenceCorner":"fence";
    const base={
      type,
      x:num(o.x,0),
      z:num(o.z,0),
      yaw:num(o.yaw,0),
      scale:Math.max(.01,num(o.scale,1))
    };
    if(type==="fenceCorner") base.corner=CORNERS.has(o.corner)?o.corner:"nw";
    return base;
  }).filter(Boolean):[];

  const sp=m.spawn&&typeof m.spawn==="object"?m.spawn:{};
  const spawn={
    x:num(sp.x,0),
    y:num(sp.y,.05),
    z:num(sp.z,0),
    yaw:num(sp.yaw,0)
  };

  const now=new Date().toISOString();
  const out=preserveUnknown ? {...m} : {};
  Object.assign(out,{
    version:MAP_SCHEMA_VERSION,
    id:String(m.id||("map_"+Date.now())),
    name:String(m.name||"새 맵").trim()||"새 맵",
    size:{width,length},
    tileSize,
    grid:{cols,rows},
    tileTypes,
    tiles,
    obstacles,
    spawn,
    createdAt:m.createdAt||now,
    updatedAt:m.updatedAt||now
  });
  return out;
}

export function validateMap(input){
  const errors=[];
  if(!input || typeof input!=="object") return {valid:false,errors:["map must be an object"]};
  if(typeof input.id!=="string" || !input.id) errors.push("id");
  if(typeof input.name!=="string" || !input.name.trim()) errors.push("name");
  if(!input.size || !(Number(input.size.width)>0) || !(Number(input.size.length)>0)) errors.push("size");
  if(!input.grid || !(Number.isInteger(input.grid.cols)&&input.grid.cols>0) || !(Number.isInteger(input.grid.rows)&&input.grid.rows>0)) errors.push("grid");
  if(!Array.isArray(input.tiles) || input.tiles.length!==input.grid.cols*input.grid.rows) errors.push("tiles");
  if(!Array.isArray(input.obstacles)) errors.push("obstacles");
  if(!input.spawn || !Number.isFinite(Number(input.spawn.x)) || !Number.isFinite(Number(input.spawn.z)) || !Number.isFinite(Number(input.spawn.yaw))) errors.push("spawn");
  for(const o of input.obstacles||[]){
    if(!["tree","fence","fenceCorner"].includes(o.type)) errors.push("obstacle.type");
    if(o.type==="fenceCorner"&&!CORNERS.has(o.corner)) errors.push("obstacle.corner");
  }
  return {valid:errors.length===0,errors};
}

export function createMap(overrides={}){
  return normalizeMap({
    id:"map_"+Date.now(),
    name:"새 맵",
    size:{width:200,length:200},
    tileSize:10,
    grid:{cols:20,rows:20},
    tiles:[],
    obstacles:[],
    spawn:{x:0,y:.05,z:0,yaw:0},
    ...overrides
  });
}
