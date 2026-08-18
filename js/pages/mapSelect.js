import {MapStorage, getMapApiDebugInfo} from '../../shared/mapStorage.js';
const box=document.getElementById('maps');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

async function render(){
  const maps=(await MapStorage.list()).filter(m=>!m.id.startsWith('default_'));
  box.innerHTML='';
  if(!maps.length){box.innerHTML='<div class="empty">저장된 맵이 없습니다. 맵 만들기에서 첫 맵을 만들어 보세요.</div>';return;}
  for(const m of maps){
    const builtin=m.id.startsWith('default_');
    const d=document.createElement('div'); d.className='card';
    d.innerHTML=`<h3>${esc(m.name)} ${builtin?'<span class="badge">기본 맵</span>':''}</h3><div class="small">${m.size?.width||0} × ${m.size?.length||0} m · ${m.grid?.cols||0} × ${m.grid?.rows||0} 타일</div><div class="actions"><button class="primary">주행</button><button ${builtin?'disabled title="기본 맵은 원본을 직접 수정할 수 없습니다."':''}>수정</button><button class="danger" ${builtin?'disabled title="기본 맵은 삭제할 수 없습니다."':''}>삭제</button></div>`;
    const b=d.querySelectorAll('button');
    b[0].onclick=()=>location.href='../simulator/simulation.html?map='+encodeURIComponent(m.id);
    if(!builtin){
      b[1].onclick=()=>location.href='../map-editor/map-editor.html?id='+encodeURIComponent(m.id);
      b[2].onclick=async()=>{if(confirm('"'+m.name+'" 맵을 삭제할까요?')){try{await MapStorage.remove(m.id);await render()}catch(err){alert(err.message)}}};
    }
    box.appendChild(d);
  }
}

MapStorage.list().then(render).catch(err=>{
  const info=getMapApiDebugInfo();
  console.error('[CAR SIM] Map storage connection failed',{error:err,apiBase:info.apiBase,apiUrl:info.apiUrl,pageOrigin:info.pageOrigin});
  box.innerHTML=`<div class="empty" style="white-space:pre-wrap;text-align:left"><strong>맵 저장소 연결 실패</strong>\n\n${esc(err.message)}\n\nAPI 주소:\n${esc(info.apiUrl)}\n\n현재 페이지:\n${esc(info.pageOrigin)}\n\nF12 → Console에서 자세한 오류를 확인할 수 있습니다.</div>`;
});
