import { normalizeMap, validateMap } from './mapSchema.js';
import { CAR_SIM_API_BASE as CONFIG_API_BASE } from './runtimeConfig.js';

const API_BASE = (typeof window !== 'undefined' && window.CAR_SIM_API_BASE) ? String(window.CAR_SIM_API_BASE).replace(/\/$/, '') : String(CONFIG_API_BASE || '').replace(/\/$/, '');
const API = API_BASE + '/api/maps';
let readyPromise=null;

async function api(path='',options={}){
  const res=await fetch(API+path,{
    headers:{'Content-Type':'application/json',...(options.headers||{})},
    ...options
  });
  if(!res.ok){
    let message='Request failed';
    try{const body=await res.json();message=body.error||message}catch(_){}
    throw new Error(message);
  }
  if(res.status===204) return null;
  return res.json();
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
        try{
          await api('');
          backendAvailable=true;
          await migrateLocalMaps();
        }catch(err){
          backendAvailable=false;
          console.warn('[CAR SIM] Map server unavailable; using local fallback.',err);
        }
        return backendAvailable;
      })();
    }
    return readyPromise;
  },

  async list(){
    await this.init();
    if(!backendAvailable) return localMaps();
    try{
      const data=await api('');
      return (data.maps||[]).map(normalizeMap);
    }catch(err){
      backendAvailable=false;
      return localMaps();
    }
  },

  async get(id){
    if(!id) return null;
    await this.init();
    if(!backendAvailable) return localMaps().find(m=>m.id===id)||null;
    try{
      const data=await api('/'+encodeURIComponent(id));
      return data.map?normalizeMap(data.map):null;
    }catch(err){
      if(/not found/i.test(err.message)) return null;
      const local=localMaps().find(m=>m.id===id);
      return local||null;
    }
  },

  async save(map){
    await this.init();
    const normalized=normalizeMap(map);
    const check=validateMap(normalized);
    if(!check.valid) throw new Error('Invalid map: '+check.errors.join(', '));

    if(!backendAvailable){
      localStorage.setItem('carSimMap:'+normalized.id,JSON.stringify(normalized));
      return normalized;
    }

    const exists=await this.get(normalized.id);
    const method=exists?'PUT':'POST';
    const path=exists?'/'+encodeURIComponent(normalized.id):'';
    try{
      const data=await api(path,{method,body:JSON.stringify(normalized)});
      return normalizeMap(data.map);
    }catch(err){
      localStorage.setItem('carSimMap:'+normalized.id,JSON.stringify(normalized));
      throw new Error('서버 저장에 실패했습니다. 로컬에는 임시 저장했습니다: '+err.message);
    }
  },

  async remove(id){
    if(!id)return;
    await this.init();
    if(!backendAvailable){
      localStorage.removeItem('carSimMap:'+id);
      return;
    }
    try{
      await api('/'+encodeURIComponent(id),{method:'DELETE'});
    }catch(err){
      if(!/not found/i.test(err.message)) throw err;
    }
    localStorage.removeItem('carSimMap:'+id);
  }
};
