-- ===========================================================================
-- 0007 — 커스텀 필드(schema-as-data) + 우선순위 필드
--   ur CLI(_db)의 fields.jsonl 설계를 웹앱 Postgres 로 이식한다.
--     · field_def : 필드 "정의"를 데이터로 (프로젝트별). 새 필드 = 코드 변경 없이 행 추가.
--     · node.fields : 각 노드의 커스텀 값 컨테이너(jsonb). 값은 {key: value} 로 인라인 저장.
--   커스텀 필드 "관리 UI"는 사용자에게 노출하지 않는다(설계만 일반화). 다만 요구 기능인
--   '우선순위'(6단계)는 concretely 시드하고 UI로 노출한다.
--   additive · 기존 authenticated/anon 정책과 동일 패턴으로 anon·authenticated 전체 허용.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. field_def — 커스텀 필드 정의(프로젝트별)
--    type: text·multiline·number·bool·select·multiselect·date (앱 레이어가 강제)
--    options(select/multiselect): [{"value":"높음","order":4}, ...]
--    applies_to: 노드 타입 배열 또는 {*}(전체). UI 노출/적용 대상.
-- ---------------------------------------------------------------------------
create table field_def (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references project(id) on delete cascade,
  key           text not null,                          -- 안정 키 (예: priority)
  label         text not null,                          -- 표시명 (예: 우선순위)
  type          text not null,                          -- 필드 자료형
  options       jsonb not null default '[]'::jsonb,     -- select/multiselect 허용값(순서 有)
  applies_to    text[] not null default array['*'],     -- 적용 대상 노드타입 ('*'=전체)
  default_value text,
  required      boolean not null default false,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (project_id, key)
);

create index idx_field_def_project on field_def(project_id);
create trigger trg_field_def_updated before update on field_def for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. node.fields — 커스텀 필드 값 컨테이너 (jsonb, 기본 빈 객체)
--    값은 앱/CLI 가 field_def 로 검증. DB 는 유연한 jsonb 로 보관(스키마 변경 없이 필드 증설).
-- ---------------------------------------------------------------------------
alter table node add column fields jsonb not null default '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- 3. 기본 필드 시드 — 프로젝트마다 '우선순위'(priority, select, 6단계) 정의.
--    seed_default_statuses 와 같은 결: 함수 + after insert 트리거 + 기존 프로젝트 백필.
-- ---------------------------------------------------------------------------
create or replace function seed_default_fields(p_project_id uuid)
returns void
language plpgsql
as $$
begin
  insert into field_def (project_id, key, label, type, options, applies_to, sort_order)
  values (
    p_project_id, 'priority', '우선순위', 'select',
    '[{"value":"매우낮음","order":1},{"value":"낮음","order":2},{"value":"보통","order":3},{"value":"높음","order":4},{"value":"매우높음","order":5},{"value":"최우선","order":6}]'::jsonb,
    array['*'], 1
  )
  on conflict (project_id, key) do nothing;
end;
$$;

create or replace function trg_seed_fields_fn()
returns trigger
language plpgsql
as $$
begin
  perform seed_default_fields(new.id);
  return new;
end;
$$;

create trigger trg_project_seed_fields
  after insert on project
  for each row execute function trg_seed_fields_fn();

-- 기존 프로젝트에 우선순위 필드 백필
do $$
declare r record;
begin
  for r in select id from project loop
    perform seed_default_fields(r.id);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 4. RLS · GRANT — 기존 테이블과 동일(내부용 전체 허용).
-- ---------------------------------------------------------------------------
alter table field_def enable row level security;
create policy "authenticated all" on field_def for all to authenticated using (true) with check (true);
create policy "anon all"          on field_def for all to anon          using (true) with check (true);

grant all on field_def to authenticated, service_role, anon;
grant execute on function seed_default_fields(uuid) to authenticated, service_role, anon;
