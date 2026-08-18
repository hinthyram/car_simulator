import { normalizeMap } from './mapSchema.js';

const BUILTIN_MAP_URLS = [
  new URL('../maps/default_mountain_ring.json', import.meta.url).href
];

let cache = null;

export async function loadBuiltinMaps(){
  if(cache) return cache.map(m=>normalizeMap(m));
  const loaded=[];
  for(const url of BUILTIN_MAP_URLS){
    try{
      const res=await fetch(url, {cache:'no-store'});
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      loaded.push(normalizeMap(await res.json()));
    }catch(err){
      console.warn('[CAR SIM] Built-in map failed to load:', url, err);
    }
  }
  cache=loaded;
  return loaded.map(m=>normalizeMap(m));
}
