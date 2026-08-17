import {MapStorage} from '../../shared/mapStorage.js';
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
MapStorage.init().then(render).catch(err=>{box.innerHTML=`<div class="empty">서버 연결 실패: ${esc(err.message)}</div>`});
