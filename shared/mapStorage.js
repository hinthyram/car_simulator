import { normalizeMap, validateMap } from './mapSchema.js';
import {
  CAR_SIM_SUPABASE_URL,
  CAR_SIM_SUPABASE_PUBLISHABLE_KEY
} from './runtimeConfig.js';

const SUPABASE_URL = String(CAR_SIM_SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_REST = SUPABASE_URL + '/rest/v1';
const MAPS_ENDPOINT = SUPABASE_REST + '/maps';
const SUPABASE_KEY = String(CAR_SIM_SUPABASE_PUBLISHABLE_KEY || '').trim();

let readyPromise = null;

function ensureConfig() {
  if (!SUPABASE_URL || !/^https:\/\/.+\.supabase\.co$/.test(SUPABASE_URL)) {
    throw new Error('Supabase URL이 설정되지 않았습니다. shared/runtimeConfig.js를 확인하세요.');
  }
  if (!SUPABASE_KEY || SUPABASE_KEY.includes('PASTE_YOUR_')) {
    throw new Error('Supabase Publishable Key가 설정되지 않았습니다. shared/runtimeConfig.js에 Publishable key를 입력하세요.');
  }
}

async function api(query = '', options = {}) {
  ensureConfig();
  const url = MAPS_ENDPOINT + query;
  let res;

  try {
    res = await fetch(url, {
      ...options,
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(options.headers || {})
      }
    });
  } catch (err) {
    const e = new Error(
      `Supabase 요청 실패\nURL: ${url}\n` +
      `원인: ${err?.message || 'Unknown network error'}\n` +
      'Supabase URL, Publishable key, HTTPS 및 RLS 정책을 확인하세요.'
    );
    e.code = 'NETWORK_ERROR';
    e.url = url;
    e.cause = err;
    throw e;
  }

  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch (_) {}

  if (!res.ok) {
    const message = body?.message || body?.error_description || body?.hint || body?.details || body?.error || text || res.statusText || 'Request failed';
    const e = new Error(
      `Supabase 요청 실패\n` +
      `HTTP: ${res.status} ${res.statusText}\n` +
      `URL: ${url}\n` +
      `응답: ${message}`
    );
    e.code = 'HTTP_ERROR';
    e.status = res.status;
    e.url = url;
    e.responseBody = body ?? text;
    throw e;
  }

  if (res.status === 204) return null;
  return body;
}

function toRow(map) {
  return {
    id: map.id,
    name: map.name,
    version: map.version,
    data: map,
    created_at: map.createdAt,
    updated_at: map.updatedAt
  };
}

function fromRow(row) {
  if (!row) return null;
  const raw = row.data && typeof row.data === 'object' ? row.data : {};
  return normalizeMap({
    ...raw,
    id: row.id ?? raw.id,
    name: row.name ?? raw.name,
    version: row.version ?? raw.version,
    createdAt: row.created_at ?? raw.createdAt,
    updatedAt: row.updated_at ?? raw.updatedAt
  });
}

function localMaps() {
  const maps = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith('carSimMap:')) continue;
    try {
      const m = normalizeMap(JSON.parse(localStorage.getItem(key)));
      if (validateMap(m).valid) maps.push(m);
    } catch (_) {}
  }
  return maps;
}

async function migrateLocalMaps() {
  const existing = await api('?select=id');
  const ids = new Set((existing || []).map(row => row.id));
  for (const map of localMaps()) {
    if (!ids.has(map.id)) {
      try {
        await api('', {
          method: 'POST',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify(toRow(map))
        });
      } catch (_) {}
    }
  }
}

export const MapStorage = {
  async init() {
    if (!readyPromise) {
      readyPromise = (async () => {
        await api('?select=id&limit=1');
        await migrateLocalMaps();
      })().catch(err => {
        readyPromise = null;
        throw err;
      });
    }
    return readyPromise;
  },

  async list() {
    await this.init();
    const rows = await api('?select=id,name,version,data,created_at,updated_at&order=updated_at.desc');
    return (rows || []).map(fromRow).filter(Boolean);
  },

  async get(id) {
    if (!id) return null;
    await this.init();
    const encoded = encodeURIComponent(id);
    const rows = await api(`?select=id,name,version,data,created_at,updated_at&id=eq.${encoded}&limit=1`);
    return rows?.length ? fromRow(rows[0]) : null;
  },

  async save(map) {
    await this.init();
    const normalized = normalizeMap(map);
    const check = validateMap(normalized);
    if (!check.valid) throw new Error('Invalid map: ' + check.errors.join(', '));

    const row = toRow(normalized);
    const rows = await api('?on_conflict=id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(row)
    });
    return fromRow(rows?.[0]);
  },

  async remove(id) {
    if (!id) return;
    await this.init();
    const encoded = encodeURIComponent(id);
    const rows = await api(`?id=eq.${encoded}`, {
      method: 'DELETE',
      headers: { Prefer: 'return=representation' }
    });
    if (!rows?.length) {
      const err = new Error('Map not found');
      err.status = 404;
      throw err;
    }
  }
};

export function getMapApiDebugInfo() {
  return {
    apiBase: SUPABASE_URL,
    apiUrl: MAPS_ENDPOINT,
    pageOrigin: typeof location !== 'undefined' ? location.origin : 'unknown'
  };
}
