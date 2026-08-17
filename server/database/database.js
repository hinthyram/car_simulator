import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const dataDir=path.resolve(__dirname,'../../data');
fs.mkdirSync(dataDir,{recursive:true});

const db=new Database(path.join(dataDir,'maps.db'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS maps (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  version INTEGER NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_maps_updated_at ON maps(updated_at DESC);
`);

const statements={
 list:db.prepare(`SELECT data FROM maps ORDER BY updated_at DESC`),
 get:db.prepare(`SELECT data FROM maps WHERE id=?`),
 upsert:db.prepare(`
   INSERT INTO maps(id,name,version,data,created_at,updated_at)
   VALUES(@id,@name,@version,@data,@created_at,@updated_at)
   ON CONFLICT(id) DO UPDATE SET
     name=excluded.name,
     version=excluded.version,
     data=excluded.data,
     updated_at=excluded.updated_at
 `),
 remove:db.prepare(`DELETE FROM maps WHERE id=?`)
};

export function listMaps(){
  return statements.list.all().map(r=>JSON.parse(r.data));
}
export function getMap(id){
  const row=statements.get.get(id);
  return row?JSON.parse(row.data):null;
}
export function saveMap(map){
  statements.upsert.run({
    id:map.id,name:map.name,version:map.version,data:JSON.stringify(map),
    created_at:map.createdAt,updated_at:map.updatedAt
  });
  return map;
}
export function deleteMap(id){
  return statements.remove.run(id).changes>0;
}
