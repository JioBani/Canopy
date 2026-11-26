-- ============================================================================
-- 0012_node_status_required — 노드 상태 필수화 (모든 노드 타입)
--
-- 1) 백필: status_id 가 없는 노드 → 같은 프로젝트의 기본 '할일' 상태
--    (category='할일' 중 name='할일' 우선, 없으면 category='할일' 의 sort_order·created_at 최소)
-- 2) node.status_id NOT NULL
-- 3) BEFORE INSERT 트리거: status_id 미지정 시 같은 규칙으로 기본 상태 채움
-- 4) FK on delete set null → no action
--    (사용 중 상태 삭제는 에러 — 먼저 다른 상태로 이전해야 함.
--     restrict 가 아닌 no action 인 이유: 프로젝트 삭제 cascade 에서 status 와 node 가
--     같은 문장 안에서 함께 지워지므로 문장 끝 검사여야 한다.)
-- 5) 프로젝트의 마지막 '할일' 분류 상태는 삭제/분류 변경 불가 (프로젝트 삭제 cascade 는 허용)
-- ============================================================================

-- 프로젝트 기본 '할일' 상태 id (없으면 null)
create or replace function default_todo_status_id(p_project_id uuid)
returns uuid
language sql
stable
set search_path = public
as $$
  select s.id
    from status s
   where s.project_id = p_project_id
     and s.category = '할일'
   order by (s.name = '할일') desc, s.sort_order asc, s.created_at asc, s.id asc
   limit 1;
$$;

grant execute on function default_todo_status_id(uuid) to anon, authenticated, service_role;

-- 1) 백필
do $$
declare
  missing uuid;
begin
  select n.project_id into missing
    from node n
   where n.status_id is null
     and default_todo_status_id(n.project_id) is null
   limit 1;
  if missing is not null then
    raise exception '프로젝트 %에 할일 분류 상태가 없어 노드 상태를 백필할 수 없습니다.', missing;
  end if;

  update node n
     set status_id = default_todo_status_id(n.project_id)
   where n.status_id is null;
end $$;

-- 3) insert 기본값 트리거
create or replace function node_default_status()
returns trigger
language plpgsql
as $$
begin
  if new.status_id is null then
    new.status_id := default_todo_status_id(new.project_id);
    if new.status_id is null then
      raise exception '프로젝트(%)에 할일 분류 상태가 없어 노드를 만들 수 없습니다. 할일 분류 상태를 먼저 만드세요.', new.project_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_node_default_status on node;
create trigger trg_node_default_status
  before insert on node
  for each row execute function node_default_status();

-- 2) NOT NULL
alter table node alter column status_id set not null;

-- 4) FK: set null → no action
alter table node drop constraint if exists node_status_id_fkey;
alter table node add constraint node_status_id_fkey
  foreign key (status_id) references status(id) on delete no action;

-- 5) 마지막 '할일' 분류 상태 보호
create or replace function protect_last_todo_status()
returns trigger
language plpgsql
as $$
begin
  if old.category <> '할일' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'UPDATE' and new.category = '할일' then
    return new;
  end if;
  -- 프로젝트 삭제 cascade 중이면 허용 (부모 project 행이 이미 사라져 보임)
  if not exists (select 1 from project p where p.id = old.project_id) then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if not exists (
    select 1 from status s
     where s.project_id = old.project_id
       and s.category = '할일'
       and s.id <> old.id
  ) then
    raise exception '프로젝트의 마지막 할일 분류 상태는 삭제하거나 분류를 바꿀 수 없습니다 (노드 기본 상태로 쓰임).';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists trg_status_protect_last_todo on status;
create trigger trg_status_protect_last_todo
  before delete or update of category on status
  for each row execute function protect_last_todo_status();

comment on column node.status_id is '노드 상태(필수). insert 시 미지정이면 프로젝트 기본 할일 상태로 채워짐.';

notify pgrst, 'reload schema';
