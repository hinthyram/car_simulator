import { normalizeMap, validateMap } from './mapSchema.js';
import { CAR_SIM_API_BASE as CONFIG_API_BASE } from './runtimeConfig.js';

const API_BASE = (typeof window !== 'undefined' && window.CAR_SIM_API_BASE) ? String(window.CAR_SIM_API_BASE).replace(/\/$/, '') : String(CONFIG_API_BASE || '').replace(/\/$/, '');
const API = API_BASE + '/api/maps';
let readyPromise=null;

async function api(path='',options={}){
  const url=API+path;
  let res;
  try{
    res=await fetch(url,{
      headers:{'Content-Type':'application/json',...(options.headers||{})},
      ...options
    });
  }catch(err){
    const e=new Error(
      `네트워크 요청 실패\nURL: ${url}\n` +
      `원인: ${err?.message || 'Unknown network error'}\n` +
      `CORS, HTTPS, Render URL 또는 브라우저 네트워크 차단을 확인하세요.`
    );
    e.code='NETWORK_ERROR';
    e.url=url;
    e.cause=err;
    throw e;
  }

  const text=await res.text();
  let body=null;
  try{ body=text?JSON.parse(text):null; }catch(_){}

  if(!res.ok){
    const message=body?.error || text || res.statusText || 'Request failed';
    const e=new Error(
      `API 요청 실패\n` +
      `HTTP: ${res.status} ${res.statusText}\n` +
      `URL: ${url}\n` +
      `응답: ${message}`
    );
    e.code='HTTP_ERROR';
    e.status=res.status;
    e.url=url;
    e.responseBody=body ?? text;
    throw e;
  }

  if(res.status===204) return null;
  return body;
}
function localMaps(){
  const maps=[];
  for(let i=0;i<localStorage.length;i++){
    const key=localStorage.key(i);
    if(!key?.startsWith('carSimMap:')) continue;
    try{
      const m=normalizeMap(JSON.parse(localStorage.getItem(key)));
      if(validateMap(m).valid) maps.push(m);
    }catch(_){}
  }
  return maps;
}

async function migrateLocalMaps(){
  const existing=(await api('')).maps||[];
  const ids=new Set(existing.map(m=>m.id));
  for(const map of localMaps()){
    if(!ids.has(map.id)){
      try{await api('',{method:'POST',body:JSON.stringify(map)});}catch(_){}
    }
  }
}

export const MapStorage={
  async init(){
    if(!readyPromise){
      readyPromise=(async()=>{
        await api('');
        await migrateLocalMaps();
      })().catch(err=>{readyPromise=null;throw err});
    }
    return readyPromise;
  },

  async list(){
    await this.init();
    const data=await api('');
    return (data.maps||[]).map(normalizeMap);
  },

  async get(id){
    if(!id) return null;
    await this.init();
    try{
      const data=await api('/'+encodeURIComponent(id));
      return data.map?normalizeMap(data.map):null;
    }catch(err){
      if(/not found/i.test(err.message)) return null;
      throw err;
    }
  },

  async save(map){
    await this.init();
    const normalized=normalizeMap(map);
    const check=validateMap(normalized);
    if(!check.valid) throw new Error('Invalid map: '+check.errors.join(', '));
    const exists=await this.get(normalized.id);
    const method=exists?'PUT':'POST';
    const path=exists?'/'+encodeURIComponent(normalized.id):'';
    const data=await api(path,{method,body:JSON.stringify(normalized)});
    return normalizeMap(data.map);
  },

  async remove(id){
    if(!id)return;
    await this.init();
    try{await api('/'+encodeURIComponent(id),{method:'DELETE'})}catch(err){
      if(!/not found/i.test(err.message)) throw err;
    }
  }
};


export function getMapApiDebugInfo(){
  return {
    apiBase: API_BASE,
    apiUrl: API,
    pageOrigin: typeof location !== 'undefined' ? location.origin : 'unknown'
  };
}
