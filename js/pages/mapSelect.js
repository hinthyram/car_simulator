import {MapStorage, getMapApiDebugInfo} from '../../shared/mapStorage.js';
const box=document.getElementById('maps');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function render(){const maps=await MapStorage.list();box.innerHTML='';
if(!maps.length){box.innerHTML='<div class="empty">저장된 맵이 없습니다. 맵 만들기에서 첫 맵을 만들어 보세요.</div>';return}
for(const m of maps){const d=document.createElement('div');d.className='card';
d.innerHTML=`<h3>${esc(m.name)}</h3><div class="small">${m.size?.width||0} × ${m.size?.length||0} m · ${m.grid?.cols||0} × ${m.grid?.rows||0} 타일</div><div class="actions"><button class="primary">주행</button><button>수정</button><button class="danger">삭제</button></div>`;
const b=d.querySelectorAll('button');b[0].onclick=()=>location.href='../simulator/simulation.html?map='+encodeURIComponent(m.id);
b[1].onclick=()=>location.href='../map-editor/map-editor.html?id='+encodeURIComponent(m.id);
b[2].onclick=()=>{if(confirm('"'+m.name+'" 맵을 삭제할까요?')){MapStorage.remove(m.id);render()}};
box.appendChild(d)}}
MapStorage.init().then(render).catch(err=>{
  const info=getMapApiDebugInfo();
  console.error('[CAR SIM] Map API connection failed', {
    error: err,
    apiBase: info.apiBase,
    apiUrl: info.apiUrl,
    pageOrigin: info.pageOrigin
  });

  box.innerHTML=`<div class="empty" style="white-space:pre-wrap;text-align:left">
<strong>서버 연결 실패</strong>

${esc(err.message)}

API 주소:
${esc(info.apiUrl)}

현재 페이지:
${esc(info.pageOrigin)}

F12 → Console에서 자세한 오류를 확인할 수 있습니다.
</div>`;
});
