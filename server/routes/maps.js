import { Router } from 'express';
import { normalizeMap, validateMap } from '../../shared/mapSchema.js';
import { listMaps, getMap, saveMap, deleteMap } from '../database/database.js';

const router=Router();

function clean(input){
  const map=normalizeMap(input);
  const check=validateMap(map);
  if(!check.valid){
    const err=new Error('Invalid map: '+check.errors.join(', '));
    err.status=400;
    throw err;
  }
  return map;
}

router.get('/',(req,res)=>{
  res.json({maps:listMaps()});
});

router.get('/:id',(req,res)=>{
  const map=getMap(req.params.id);
  if(!map) return res.status(404).json({error:'Map not found'});
  res.json({map});
});

router.post('/',(req,res)=>{
  try{
    const map=clean(req.body);
    const saved=saveMap(map);
    res.status(201).json({map:saved});
  }catch(err){
    res.status(err.status||500).json({error:err.message});
  }
});

router.put('/:id',(req,res)=>{
  try{
    const map=clean({...req.body,id:req.params.id});
    const saved=saveMap(map);
    res.json({map:saved});
  }catch(err){
    res.status(err.status||500).json({error:err.message});
  }
});

router.delete('/:id',(req,res)=>{
  if(!deleteMap(req.params.id)) return res.status(404).json({error:'Map not found'});
  res.status(204).end();
});

export default router;
