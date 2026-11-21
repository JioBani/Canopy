-- ============================================================================
-- 0010_ur_group_ticket — 요구사항 그룹(ur_group) 티켓 번호
--
-- 키 형식: RequirementGroup-{ticket_number}  (프로젝트 단위 순번, Requirement-N 과 같은 방식)
-- - ur_group.ticket_number : insert 트리거가 ticket_counter(project_id, 'ur_group') 로 원자 발급
-- - ur_group.project_id    : 프로젝트 내 유니크 보장을 위한 비정규화 컬럼(트리거가 feature_id 로 채움)
-- - 기존 그룹 백필: 프로젝트별 created_at, sort_order, id 순 1..N, 카운터 = N+1
-- 전부 additive · 재실행 안전(if not exists / where ticket_number is null).
-- ============================================================================

alter table ur_group add column if not exists ticket_number int;
alter table ur_group add column if not exists project_id uuid references project(id) on delete cascade;

-- insert / feature 변경 시: project_id 동기화 + (insert 때) 번호 발급
create or replace function assign_ur_group_number()
returns trigger
language plpgsql
as $$
declare
  pid uuid;
  next_no int;
begin
  select project_id into pid from node where id = new.feature_id;
  if pid is null then
    raise exception 'UR 그룹 번호 발급 실패: feature_id=% 노드가 없습니다.', new.feature_id;
  end if;

  if tg_op = 'UPDATE' then
    if old.project_id is not null and old.project_id <> pid then
      raise exception 'UR 그룹은 다른 프로젝트의 세부기능으로 옮길 수 없습니다.';
    end if;
    new.project_id := pid;
    return new;
  end if;

  new.project_id := pid;
  insert into ticket_counter (project_id, kind, next_seq)
       values (pid, 'ur_group', 2)
  on conflict (project_id, kind)
       do update set next_seq = ticket_counter.next_seq + 1
    returning next_seq - 1 into next_no;
  new.ticket_number := next_no;
  return new;
end;
$$;

drop trigger if exists trg_ur_group_assign_number on ur_group;
create trigger trg_ur_group_assign_number
  before insert or update of feature_id on ur_group
  for each row execute function assign_ur_group_number();

-- 번호 없는 그룹 백필(재실행 안전). 이미 번호가 있는 프로젝트는 max 다음부터 이어 붙인다.
create or replace function backfill_ur_group_numbers()
returns int
language plpgsql
as $$
declare
  n int;
begin
  update ur_group g
     set project_id = nd.project_id
    from node nd
   where nd.id = g.feature_id
     and g.project_id is null;

  with base as (
    select g.project_id, coalesce(max(g.ticket_number), 0) as mx
      from ur_group g
     group by g.project_id
  ),
  todo as (
    select g.id, g.project_id,
           row_number() over (partition by g.project_id order by g.created_at, g.sort_order, g.id) as rn
      from ur_group g
     where g.ticket_number is null
  )
  update ur_group g
     set ticket_number = b.mx + t.rn
    from todo t
    join base b on b.project_id = t.project_id
   where g.id = t.id;
  get diagnostics n = row_count;

  insert into ticket_counter (project_id, kind, next_seq)
  select g.project_id, 'ur_group', max(g.ticket_number) + 1
    from ur_group g
   group by g.project_id
  on conflict (project_id, kind)
     do update set next_seq = greatest(ticket_counter.next_seq, excluded.next_seq);

  return n;
end;
$$;

revoke all on function backfill_ur_group_numbers() from public, anon, authenticated;
grant execute on function backfill_ur_group_numbers() to service_role;

select backfill_ur_group_numbers();

alter table ur_group alter column ticket_number set not null;
alter table ur_group alter column project_id set not null;
create unique index if not exists uq_ur_group_project_ticket on ur_group(project_id, ticket_number);
create index if not exists idx_ur_group_ticket_number on ur_group(ticket_number);

comment on column ur_group.ticket_number is '트리거 발급 번호 (키 = RequirementGroup-{n}, 프로젝트 단위).';
comment on column ur_group.project_id is 'feature_id 의 프로젝트 (트리거가 채움; 프로젝트 내 번호 유니크용).';

notify pgrst, 'reload schema';
