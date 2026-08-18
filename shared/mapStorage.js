import { normalizeMap, validateMap } from './mapSchema.js';
import { loadBuiltinMaps } from './defaultMaps.js';
import { CAR_SIM_SUPABASE_URL, CAR_SIM_SUPABASE_PUBLISHABLE_KEY } from './runtimeConfig.js';

const SUPABASE_URL=String(CAR_SIM_SUPABASE_URL||'').replace(/\/$/,'');
const API=SUPABASE_URL+'/rest/v1/maps';
const KEY=String(CAR_SIM_SUPABASE_PUBLISHABLE_KEY||'');
let readyPromise=null;
let builtins=[];

function headers(extra={}){
  return {
    apikey: KEY,
    Authorization: `Bearer ${KEY}`,
    'Content-Type':'application/json',
    ...extra
  };
}

async function api(options={}){
  const {path='',...fetchOptions}=options;
  const url=API+path;
  let res;
  try{
    res=await fetch(url,{...fetchOptions,headers:headers(fetchOptions.headers||{})});
  }catch(err){
    const e=new Error(`Supabase 네트워크 요청 실패\nURL: ${url}\n원인: ${err?.message||'Failed to fetch'}`);
    e.code='NETWORK_ERROR'; e.url=url; throw e;
  }
  const text=await res.text();
  let body=null; try{body=text?JSON.parse(text):null}catch(_){ }
  if(!res.ok){
    const msg=body?.message||body?.error_description||body?.hint||text||res.statusText;
    const e=new Error(`Supabase API 요청 실패\nHTTP: ${res.status} ${res.statusText}\nURL: ${url}\n응답: ${msg}`);
    e.code='HTTP_ERROR'; e.status=res.status; e.url=url; throw e;
  }
  return body||[];
}

function localMaps(){
  const maps=[];
  for(let i=0;i<localStorage.length;i++){
    const key=localStorage.key(i); if(!key?.startsWith('carSimMap:')) continue;
    try{const m=normalizeMap(JSON.parse(localStorage.getItem(key)));if(validateMap(m).valid)maps.push(m)}catch(_){ }
  }
  return maps;
}

async function loadRemote(){
  if(!KEY || KEY.includes('PASTE_YOUR')) throw new Error('Supabase Publishable Key가 설정되지 않았습니다. shared/runtimeConfig.js를 확인하세요.');
  return (await api({path:'?select=id,name,version,data,created_at,updated_at&order=updated_at.desc'})).map(r=>normalizeMap(r.data||r));
}

export const MapStorage={
  async init(){
    if(!readyPromise){
      readyPromise=(async()=>{ builtins=await loadBuiltinMaps(); await loadRemote(); })().catch(err=>{readyPromise=null;throw err});
    }
    return readyPromise;
  },

  async list(){
    builtins=await loadBuiltinMaps();
    try{
      const remote=await loadRemote();
      const ids=new Set(builtins.map(m=>m.id));
      return [...builtins,...remote.filter(m=>!ids.has(m.id))];
    }catch(err){
      // Built-in maps remain playable even if Supabase is temporarily unavailable.
      if(builtins.length) return [...builtins,...localMaps().filter(m=>!builtins.some(b=>b.id===m.id))];
      throw err;
    }
  },

  async get(id){
    if(!id)return null;
    builtins=await loadBuiltinMaps();
    const builtin=builtins.find(m=>m.id===id); if(builtin)return normalizeMap(builtin);
    try{
      const rows=await api({path:`?id=eq.${encodeURIComponent(id)}&select=*`});
      return rows[0]?normalizeMap(rows[0].data||rows[0]):null;
    }catch(err){
      const local=localMaps().find(m=>m.id===id); if(local)return local;
      throw err;
    }
  },

  async save(map){
    const normalized=normalizeMap(map); const check=validateMap(normalized);
    if(!check.valid)throw new Error('Invalid map: '+check.errors.join(', '));
    builtins=await loadBuiltinMaps();
    if(builtins.some(m=>m.id===normalized.id)) throw new Error('기본 맵은 직접 덮어쓸 수 없습니다. 맵 에디터에서 다른 이름으로 저장하세요.');
    const exists=await this.get(normalized.id);
    const payload={id:normalized.id,name:normalized.name,version:normalized.version,data:normalized,created_at:normalized.createdAt,updated_at:new Date().toISOString()};
    const rows=await api({path:exists?`?id=eq.${encodeURIComponent(normalized.id)}`:'',method:exists?'PATCH':'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(payload)});
    return normalizeMap(rows[0]?.data||normalized);
  },

  async remove(id){
    builtins=await loadBuiltinMaps();
    if(builtins.some(m=>m.id===id)) throw new Error('기본 맵은 삭제할 수 없습니다.');
    await api({path:`?id=eq.${encodeURIComponent(id)}`,method:'DELETE'});
  }
};

export function getMapApiDebugInfo(){
  return {apiBase:SUPABASE_URL,apiUrl:API,pageOrigin:typeof location!=='undefined'?location.origin:'unknown'};
}
