-- ===========================================================================
-- 0005 — 작업 시간 측정 (작업 Task 전용)
--   · node.time_spent_minutes: 수동 보정(분). 표시 총시간 = 보정 + Σ(종료 로그 duration)
--     → 로그 추가/수정/삭제가 총시간에 자동 반영(구성상 일관, bookkeeping 불필요).
--   · work_log: 작업 세션. ended_at NULL = 진행 중. 진행 중 세션은 작업당 1개(부분 유니크).
-- ===========================================================================

alter table node add column if not exists time_spent_minutes int not null default 0;

create table work_log (
  id               uuid primary key default gen_random_uuid(),
  work_id          uuid not null references node(id)   on delete cascade,  -- 작업 노드
  member_id        uuid references member(id)          on delete set null, -- 작업자(선택)
  started_at       timestamptz not null default now(),
  ended_at         timestamptz,                                            -- NULL = 진행 중
  duration_minutes int,                                                    -- 종료 시 계산(편집 가능)
  note             text,                                                   -- 무슨 작업(선택)
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index idx_work_log_work on work_log(work_id);
-- 작업당 진행 중(미종료) 세션은 1개만
create unique index uq_work_log_active on work_log(work_id) where ended_at is null;

create trigger trg_work_log_updated
  before update on work_log
  for each row execute function set_updated_at();

-- work_id 는 작업 노드여야 함(기존 가드 재사용)
create trigger trg_work_log_task_check
  before insert or update of work_id on work_log
  for each row execute function check_work_is_task();

-- RLS: 다른 테이블과 동일(authenticated + anon 전체 허용)
alter table work_log enable row level security;
create policy "authenticated all" on work_log for all to authenticated using (true) with check (true);
create policy "anon all"          on work_log for all to anon          using (true) with check (true);
grant all on work_log to authenticated, anon, service_role;
