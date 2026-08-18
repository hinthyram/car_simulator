import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mapsRouter from './routes/maps.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

app.disable('x-powered-by');
app.use(express.json({ limit: '5mb' }));

// GitHub Pages frontend -> Render API.
// CORS_ORIGIN can be a comma-separated allow-list.
const defaultOrigins = [
  'https://hinthyram.github.io',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];
const allowedOrigins = new Set(
  (process.env.CORS_ORIGIN || defaultOrigins.join(','))
    .split(',')
    .map(v => v.trim())
    .filter(Boolean)
);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (allowedOrigins.has('*') || allowedOrigins.has(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/api/health', (req, res) => res.json({
  ok: true,
  service: 'car-simulator-api',
  version: '15.1.0',
  time: new Date().toISOString()
}));
app.use('/api/maps', mapsRouter);

// The same server can also serve the project locally / as a full-stack deployment.
app.use(express.static(root));

app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'API route not found' });
  res.status(404).send('Not found');
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, HOST, () => {
  console.log(`CAR SIMULATOR API listening on ${HOST}:${PORT}`);
});
