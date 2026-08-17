import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mapsRouter from './routes/maps.js';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(__dirname,'..');
const app=express();
const PORT=Number(process.env.PORT)||3000;

app.disable('x-powered-by');
app.use(express.json({limit:'5mb'}));

app.get('/api/health',(req,res)=>res.json({ok:true,service:'car-simulator',version:'11.0.0'}));
app.use('/api/maps',mapsRouter);

app.use(express.static(root));

app.use((err,req,res,next)=>{
  console.error(err);
  res.status(500).json({error:'Internal server error'});
});

app.listen(PORT,()=>console.log(`CAR SIMULATOR running at http://localhost:${PORT}`));
