-- ============================================================================
-- Canopy 초기 스키마 (0001_init)
-- 기획서.md §4(데이터 모델) · §5(타입 문법) · §6(UR 추적) · §7(티켓/상태) 기반.
--
-- !! 아직 적용하지 마세요 — live Supabase 프로젝트 생성 후 일괄 적용용 파일입니다.
-- 적용:  supabase db push   또는  대시보드 SQL 에디터에 그대로 붙여넣기.
--
-- 공통 규약:
--   - 모든 테이블 id uuid pk default gen_random_uuid() (member 예외: auth.users.id)
--   - created_at / updated_at timestamptz default now(), updated_at 자동 갱신 트리거
--   - RLS: 전 테이블 enable + authenticated(로그인 사용자) 전부 허용 (내부용)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. ENUM 타입
-- ---------------------------------------------------------------------------
create type node_type   as enum ('컨텐츠', '기능', '세부기능', '마스터데이터', '작업');
create type node_domain as enum ('기획', '디자인', '사운드', '구현', '밸런싱', '기타');
create type status_category as enum ('할일', '진행중', '완료', '취소됨');
create type node_link_type  as enum ('blocks', 'relates');
create type ur_status       as enum ('완료', '미구현', '오구현');

-- ---------------------------------------------------------------------------
-- 1. 공통 트리거 함수 — updated_at 자동 갱신
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. 테이블
-- ---------------------------------------------------------------------------

-- project — 프로젝트
-- 티켓 키는 타입 기반(`{Type}-{N}`)이라 프로젝트별 프리픽스가 없다.
-- 타입별 번호 카운터는 ticket_counter 테이블이 보관한다.
create table project (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- member — 팀원 (Supabase auth user 와 매핑; id = auth.users.id)
create table member (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text,
  display_name  text,
  avatar_url    text,                          -- 구글 프로필
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- status — 프로젝트별 커스텀 작업 상태
create table status (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references project(id) on delete cascade,
  name        text not null,                   -- 표시 이름 (예: 개발중)
  category    status_category not null,        -- 고정 4종 (roll-up/보드 기준)
  color       text,                            -- 뱃지 색 (선택)
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- node — 트리의 모든 노드 (type 으로 구분, parent_id 자기참조로 무한 깊이)
create table node (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references project(id) on delete cascade,
  parent_id      uuid references node(id) on delete cascade,   -- null = 컨텐츠(최상위)
  type           node_type not null,
  ticket_number  int,                          -- 트리거가 타입별로 발급 (티켓키 = {Type}-{ticket_number})
  title          text not null,
  body           text,                         -- 설명(마크다운), 모든 노드 공통
  sort_order     int  not null default 0,
  status_id      uuid references status(id) on delete set null,   -- 주로 작업
  domain         node_domain,                  -- 작업만 (nullable)
  assignee_id    uuid references member(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (project_id, type, ticket_number)     -- 번호는 프로젝트·타입 단위로 유일
);

-- ticket_counter — 프로젝트·종류(kind)별 다음 발급 번호 (원자적 증가)
-- kind = 노드 타입(컨텐츠/기능/…/작업) 또는 'ur'(요구사항). 타입별 독립 카운터.
create table ticket_counter (
  project_id  uuid not null references project(id) on delete cascade,
  kind        text not null,
  next_seq    int  not null default 1,
  primary key (project_id, kind)
);

-- ur_group — UR 묶음 (세부기능 소유, 가독성용)
-- feature_id 컬럼명은 호환 위해 유지하나 의미는 '세부기능 노드'다(트리거가 강제).
create table ur_group (
  id          uuid primary key default gen_random_uuid(),
  feature_id  uuid not null references node(id) on delete cascade,   -- 세부기능 노드
  name        text not null,
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ur — 사용자 요구사항 (세부기능 소유)
-- status: 수동 지정(연결작업 자동계산 아님). 오구현이면 misimpl_reason 에 사유.
create table ur (
  id            uuid primary key default gen_random_uuid(),
  feature_id    uuid not null references node(id) on delete cascade,        -- 세부기능 노드
  ur_group_id   uuid references ur_group(id) on delete set null,            -- 그룹(선택)
  ticket_number int,                             -- 트리거가 발급 (키 = Requirement-{ticket_number}, 프로젝트 단위)
  text          text not null,                  -- 요구사항 원문
  status        ur_status not null default '미구현',
  misimpl_reason text,                           -- 오구현 사유
  sort_order    int  not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ur_work_link — UR ↔ 작업 (M:N 추적 링크, 작업 단위로만)
create table ur_work_link (
  id          uuid primary key default gen_random_uuid(),
  ur_id       uuid not null references ur(id) on delete cascade,
  work_id     uuid not null references node(id) on delete cascade,         -- 작업 노드
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (ur_id, work_id)
);

-- task_checklist — 작업 내부 체크리스트 (작업내용)
create table task_checklist (
  id          uuid primary key default gen_random_uuid(),
  work_id     uuid not null references node(id) on delete cascade,         -- 작업 노드
  text        text not null,
  done        boolean not null default false,
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- node_link — 노드 간 관계 (선제/관련)
create table node_link (
  id            uuid primary key default gen_random_uuid(),
  from_node_id  uuid not null references node(id) on delete cascade,
  to_node_id    uuid not null references node(id) on delete cascade,
  type          node_link_type not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (from_node_id, to_node_id, type),
  check (from_node_id <> to_node_id)
);

-- ---------------------------------------------------------------------------
-- 3. 인덱스
-- ---------------------------------------------------------------------------
create index idx_status_project          on status(project_id);
create index idx_node_project            on node(project_id);
create index idx_node_parent             on node(parent_id);
create index idx_node_status             on node(status_id);
create index idx_node_assignee           on node(assignee_id);
create index idx_node_type               on node(type);
create index idx_ur_group_feature        on ur_group(feature_id);
create index idx_ur_feature              on ur(feature_id);
create index idx_ur_group                on ur(ur_group_id);
create index idx_ur_work_link_ur         on ur_work_link(ur_id);
create index idx_ur_work_link_work       on ur_work_link(work_id);
create index idx_task_checklist_work     on task_checklist(work_id);
create index idx_node_link_from          on node_link(from_node_id);
create index idx_node_link_to            on node_link(to_node_id);

-- ---------------------------------------------------------------------------
-- 4. updated_at 트리거 (전 테이블)
-- ---------------------------------------------------------------------------
create trigger trg_project_updated        before update on project        for each row execute function set_updated_at();
create trigger trg_member_updated         before update on member         for each row execute function set_updated_at();
create trigger trg_status_updated         before update on status         for each row execute function set_updated_at();
create trigger trg_node_updated           before update on node           for each row execute function set_updated_at();
create trigger trg_ur_group_updated       before update on ur_group       for each row execute function set_updated_at();
create trigger trg_ur_updated             before update on ur             for each row execute function set_updated_at();
create trigger trg_ur_work_link_updated   before update on ur_work_link   for each row execute function set_updated_at();
create trigger trg_task_checklist_updated before update on task_checklist for each row execute function set_updated_at();
create trigger trg_node_link_updated      before update on node_link      for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. 핵심 로직 #1 — 티켓 번호 발급 (node insert 시 원자적, 타입별)
--    ticket_counter(project_id, type) 행을 UPSERT 로 원자적 증가시키며 이전 값을
--    ticket_number 로 할당. 같은 (project,type) 행을 잠그므로 동시 insert 가
--    직렬화되어 타입별 번호 중복이 없다 (티켓키 = {Type}-{ticket_number}).
-- ---------------------------------------------------------------------------
create or replace function assign_ticket_number()
returns trigger
language plpgsql
as $$
declare
  next_no int;
begin
  insert into ticket_counter (project_id, kind, next_seq)
       values (new.project_id, new.type::text, 2)
  on conflict (project_id, kind)
       do update set next_seq = ticket_counter.next_seq + 1
    returning next_seq - 1 into next_no;   -- 증가 전 값 = 이번에 발급할 번호

  if next_no is null then
    raise exception '티켓 번호 발급 실패: project_id=% type=%', new.project_id, new.type;
  end if;

  new.ticket_number := next_no;
  return new;
end;
$$;

create trigger trg_node_assign_ticket
  before insert on node
  for each row execute function assign_ticket_number();

-- UR 번호 발급 — ur insert 시 (프로젝트 단위 'ur' 카운터). 키 = Requirement-{ticket_number}.
-- ur 에는 project_id 가 없으므로 소유 세부기능(feature_id)에서 프로젝트를 끌어온다.
create or replace function assign_ur_number()
returns trigger
language plpgsql
as $$
declare
  pid uuid;
  next_no int;
begin
  select project_id into pid from node where id = new.feature_id;
  if pid is null then
    raise exception 'UR 번호 발급 실패: feature_id=% 노드가 없습니다.', new.feature_id;
  end if;

  insert into ticket_counter (project_id, kind, next_seq)
       values (pid, 'ur', 2)
  on conflict (project_id, kind)
       do update set next_seq = ticket_counter.next_seq + 1
    returning next_seq - 1 into next_no;

  new.ticket_number := next_no;
  return new;
end;
$$;

create trigger trg_ur_assign_number
  before insert on ur
  for each row execute function assign_ur_number();

-- ---------------------------------------------------------------------------
-- 6. 핵심 로직 #2 — 노드 타입 문법 강제 (기획서 §5)
--    부모-자식 타입 규칙을 위반하는 insert/update 를 거부.
--      컨텐츠      : 부모 없음(최상위)        자식: 기능
--      기능        : 부모 컨텐츠              자식: 세부기능, 마스터데이터
--      세부기능    : 부모 기능                자식: 작업
--      마스터데이터: 부모 기능                자식: 작업
--      작업        : 부모 세부기능|마스터데이터  자식: 없음(잎)
-- ---------------------------------------------------------------------------
create or replace function validate_node_hierarchy()
returns trigger
language plpgsql
as $$
declare
  parent_type    node_type;
  parent_project uuid;
begin
  if new.type = '컨텐츠' then
    if new.parent_id is not null then
      raise exception '컨텐츠는 최상위 노드여야 합니다 (parent_id 가 있으면 안 됨).';
    end if;
    return new;
  end if;

  -- 컨텐츠 외에는 부모가 반드시 있어야 함
  if new.parent_id is null then
    raise exception '% 노드는 부모가 필요합니다.', new.type;
  end if;

  select type, project_id into parent_type, parent_project
    from node where id = new.parent_id;

  if parent_type is null then
    raise exception '부모 노드(%)를 찾을 수 없습니다.', new.parent_id;
  end if;

  if parent_project <> new.project_id then
    raise exception '부모 노드가 다른 프로젝트에 속합니다.';
  end if;

  case new.type
    when '기능' then
      if parent_type <> '컨텐츠' then
        raise exception '기능의 부모는 컨텐츠여야 합니다 (현재: %).', parent_type;
      end if;
    when '세부기능' then
      if parent_type <> '기능' then
        raise exception '세부기능의 부모는 기능이어야 합니다 (현재: %).', parent_type;
      end if;
    when '마스터데이터' then
      if parent_type <> '기능' then
        raise exception '마스터데이터의 부모는 기능이어야 합니다 (현재: %).', parent_type;
      end if;
    when '작업' then
      if parent_type not in ('세부기능', '마스터데이터') then
        raise exception '작업의 부모는 세부기능 또는 마스터데이터여야 합니다 (현재: %).', parent_type;
      end if;
    else
      raise exception '알 수 없는 노드 타입: %', new.type;
  end case;

  return new;
end;
$$;

create trigger trg_node_validate_hierarchy
  before insert or update of parent_id, type on node
  for each row execute function validate_node_hierarchy();

-- ---------------------------------------------------------------------------
-- 6b. UR/링크 대상 타입 가드 (엄격 강제 철학 일관성)
--     ur_group.feature_id, ur.feature_id 는 세부기능 노드여야 한다(UR 은 세부기능 소유).
--     ur_work_link.work_id 는 작업 노드여야 한다.
-- ---------------------------------------------------------------------------
create or replace function check_node_is_subfeature()
returns trigger
language plpgsql
as $$
begin
  if (select type from node where id = new.feature_id) is distinct from '세부기능' then
    raise exception 'feature_id(%)는 세부기능 노드여야 합니다.', new.feature_id;
  end if;
  return new;
end;
$$;

create trigger trg_ur_group_feature_check
  before insert or update of feature_id on ur_group
  for each row execute function check_node_is_subfeature();

create trigger trg_ur_feature_check
  before insert or update of feature_id on ur
  for each row execute function check_node_is_subfeature();

create or replace function check_work_is_task()
returns trigger
language plpgsql
as $$
begin
  if (select type from node where id = new.work_id) is distinct from '작업' then
    raise exception 'work_id(%)는 작업 노드여야 합니다.', new.work_id;
  end if;
  return new;
end;
$$;

create trigger trg_ur_work_link_task_check
  before insert or update of work_id on ur_work_link
  for each row execute function check_work_is_task();

-- ---------------------------------------------------------------------------
-- 7. 핵심 로직 #4 — 프로젝트 기본 상태 시드 함수 + 자동 호출 트리거
--    4 카테고리에 기본 상태 1개씩 (색은 기획서 §10 기준).
-- ---------------------------------------------------------------------------
create or replace function seed_default_statuses(p_project_id uuid)
returns void
language plpgsql
as $$
begin
  insert into status (project_id, name, category, color, sort_order) values
    (p_project_id, '할일',   '할일',   '#6b7280', 0),   -- 회색
    (p_project_id, '진행중', '진행중', '#3b82f6', 0),   -- 파랑
    (p_project_id, '완료',   '완료',   '#22c55e', 0),   -- 초록
    (p_project_id, '취소됨', '취소됨', '#ef4444', 0);   -- 빨강
end;
$$;

create or replace function trg_seed_statuses_fn()
returns trigger
language plpgsql
as $$
begin
  perform seed_default_statuses(new.id);
  return new;
end;
$$;

create trigger trg_project_seed_statuses
  after insert on project
  for each row execute function trg_seed_statuses_fn();

-- ---------------------------------------------------------------------------
-- 8. 핵심 로직 #3 — 진행률 roll-up & UR 커버리지 뷰
--    security_invoker=true 로 base 테이블 RLS 를 그대로 따른다.
-- ---------------------------------------------------------------------------

-- node_progress: 노드별 "하위 작업(자신 포함) 중 완료 카테고리 비율" roll-up.
--   비-잎 노드 = 하위 작업 집계, 작업 노드 = 자기 자신(완료면 1/1).
--   하위 작업이 0개면 progress = null (진행바 없음).
create or replace view node_progress
with (security_invoker = true)
as
with recursive subtree as (
    select id as root_id, id as node_id from node
  union all
    select s.root_id, c.id
      from subtree s
      join node c on c.parent_id = s.node_id
)
select
  s.root_id as node_id,
  count(*) filter (where tn.type = '작업')                                as total_tasks,
  count(*) filter (where tn.type = '작업' and st.category = '완료')        as done_tasks,
  case
    when count(*) filter (where tn.type = '작업') = 0 then null
    else round(
      count(*) filter (where tn.type = '작업' and st.category = '완료')::numeric
      / count(*) filter (where tn.type = '작업'), 4)
  end as progress
from subtree s
join node tn   on tn.id = s.node_id
left join status st on st.id = tn.status_id
group by s.root_id;

-- ur_coverage: UR 별 연결 작업 수 / 완료 작업 수 / 미커버 여부.
create or replace view ur_coverage
with (security_invoker = true)
as
select
  u.id          as ur_id,
  u.feature_id,
  u.ur_group_id,
  count(l.work_id)                                              as linked_work_count,
  count(l.work_id) filter (where st.category = '완료')          as done_work_count,
  (count(l.work_id) = 0)                                        as is_uncovered
from ur u
left join ur_work_link l on l.ur_id = u.id
left join node w        on w.id = l.work_id
left join status st     on st.id = w.status_id
group by u.id, u.feature_id, u.ur_group_id;

-- ---------------------------------------------------------------------------
-- 9. member 동기화 — auth.users → member upsert 트리거
--    구글 로그인(첫 가입/메타 변경) 시 자동으로 member 를 채운다. 앱 코드 불필요.
--    SECURITY DEFINER 라 member RLS 와 무관하게 동작.
-- ---------------------------------------------------------------------------
create or replace function handle_auth_user_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.member (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      new.email
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update set
    email        = excluded.email,
    display_name = excluded.display_name,
    avatar_url   = excluded.avatar_url;
  return new;
end;
$$;

create trigger on_auth_user_synced
  after insert or update on auth.users
  for each row execute function handle_auth_user_sync();

-- ---------------------------------------------------------------------------
-- 10. RLS — 전 테이블 enable + authenticated 전부 허용 (내부용)
-- ---------------------------------------------------------------------------
alter table project        enable row level security;
alter table ticket_counter enable row level security;
alter table member         enable row level security;
alter table status         enable row level security;
alter table node           enable row level security;
alter table ur_group       enable row level security;
alter table ur             enable row level security;
alter table ur_work_link   enable row level security;
alter table task_checklist enable row level security;
alter table node_link      enable row level security;

create policy "authenticated all" on project        for all to authenticated using (true) with check (true);
create policy "authenticated all" on ticket_counter for all to authenticated using (true) with check (true);
create policy "authenticated all" on member         for all to authenticated using (true) with check (true);
create policy "authenticated all" on status         for all to authenticated using (true) with check (true);
create policy "authenticated all" on node           for all to authenticated using (true) with check (true);
create policy "authenticated all" on ur_group       for all to authenticated using (true) with check (true);
create policy "authenticated all" on ur             for all to authenticated using (true) with check (true);
create policy "authenticated all" on ur_work_link   for all to authenticated using (true) with check (true);
create policy "authenticated all" on task_checklist for all to authenticated using (true) with check (true);
create policy "authenticated all" on node_link      for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- 11. 권한 (PostgREST 노출용)
--   authenticated = 앱(로그인 사용자), service_role = 서버/관리/백엔드 테스트.
--   anon 은 권한 미부여 → 비로그인은 테이블 접근 자체 불가 (내부용 의도).
--   service_role 은 RLS 는 우회하지만 테이블 GRANT 는 별도로 필요하다.
-- ---------------------------------------------------------------------------
grant usage on schema public to authenticated, service_role;
grant all on all tables in schema public to authenticated, service_role;   -- 뷰 포함
grant all on all sequences in schema public to authenticated, service_role;
grant execute on function seed_default_statuses(uuid) to authenticated, service_role;
