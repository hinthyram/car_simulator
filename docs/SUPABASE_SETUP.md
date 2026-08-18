# Supabase setup

This build uses GitHub Pages for the static site and Supabase directly for user-created maps. Render/Node server files are not required.

## 1. Create `public.maps`

Run the SQL below in Supabase SQL Editor:

```sql
create table public.maps (
  id text primary key,
  name text not null,
  version integer not null default 1,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.maps enable row level security;

create policy "Allow public map reading" on public.maps for select to anon using (true);
create policy "Allow public map creation" on public.maps for insert to anon with check (true);
create policy "Allow public map update" on public.maps for update to anon using (true) with check (true);
create policy "Allow public map deletion" on public.maps for delete to anon using (true);
```

These policies are intentionally simple for the prototype. Add authentication and owner-based policies before public production use.

## 2. Set the frontend key

Edit `shared/runtimeConfig.js`:

- `CAR_SIM_SUPABASE_URL`: project URL
- `CAR_SIM_SUPABASE_PUBLISHABLE_KEY`: Supabase Publishable key (`sb_publishable_...`)

Never put a Supabase Secret/service-role key in the repository.

## 3. Data model

User-created maps are stored as one JSONB document in `public.maps.data`.
Built-in maps are static JSON files committed to GitHub and are not stored in Supabase.
