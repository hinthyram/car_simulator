import { normalizeMap, validateMap } from './mapSchema.js';

const API='/api/maps';
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
