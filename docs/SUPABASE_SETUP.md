# Supabase 연결 설정

## 1. Project URL

현재 프로젝트의 Project URL:

```text
https://vhjrxfuivfdtmwhcjwfr.supabase.co
```

REST API 주소가 `/rest/v1/`로 표시되는 경우 코드에서는 `/rest/v1/` 앞의 Project URL만 사용합니다.

## 2. maps 테이블

SQL Editor에서 다음을 실행합니다.

```sql
create table public.maps (
  id text primary key,
  name text not null,
  version integer not null default 1,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

## 3. RLS

```sql
alter table public.maps enable row level security;

create policy "Allow public map reading"
on public.maps for select to anon using (true);

create policy "Allow public map creation"
on public.maps for insert to anon with check (true);

create policy "Allow public map update"
on public.maps for update to anon using (true) with check (true);

create policy "Allow public map deletion"
on public.maps for delete to anon using (true);
```

위 정책은 테스트용입니다. 공개 서비스에서는 로그인 사용자별 소유권 정책으로 강화하세요.

## 4. Publishable key

Supabase Dashboard → Settings → API Keys → Publishable key에서 `sb_publishable_...` 키를 복사합니다.

`shared/runtimeConfig.js`의 다음 부분에 붙여넣습니다.

```js
export const CAR_SIM_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_...';
```

**Secret key / service_role key / DB 비밀번호는 브라우저 코드나 GitHub에 넣지 않습니다.**

## 5. 배포

```bash
git add .
git commit -m "Migrate map storage to Supabase"
git push
```

GitHub Pages Actions가 완료된 뒤 웹사이트에서 맵 선택 → 맵 만들기 → 저장 → 새로고침 순서로 테스트합니다.

## 6. 확인

Supabase Dashboard → Table Editor → `maps`에서 저장된 맵 행이 생기는지 확인합니다.
