-- ============================================================================
-- 0009_api_efficiency — 프로젝트 단위 집계 RPC + 조회용 인덱스
--
-- 배경: node_progress 뷰는 재귀 CTE 라 node_id 필터가 CTE 안으로 내려가지 않는다.
--   → `node_progress?node_id=in.(...)` 한 번마다 "모든 프로젝트의 모든 노드" 서브트리를
--     전부 계산한 뒤 거른다(UI 는 60개씩 청크로 여러 번 호출). 노드가 늘수록 O(N·depth)×호출수.
--   subtree_progress(p_project_id, p_root) 는 대상 프로젝트(또는 한 서브트리)만 계산한다.
-- project_summary 는 대시보드/에이전트용 요약(UR 상태 통계·미커버 수·컨텐츠 진행률)을
--   한 번의 호출, 작은 JSON 으로 돌려준다(UR 전체를 내려받아 클라이언트에서 세지 않도록).
-- 기존 뷰(node_progress, ur_coverage)는 하위 호환을 위해 그대로 둔다.
-- ============================================================================

-- 프로젝트(또는 p_root 서브트리) 노드별 UR roll-up 진행률. node_progress 와 같은 컬럼.
create or replace function subtree_progress(p_project_id uuid, p_root uuid default null)
returns table (node_id uuid, total_urs bigint, done_urs bigint, progress numeric)
language sql
stable
set search_path = public
as $$
  with recursive scope as (
      select n.id
        from node n
       where n.project_id = p_project_id
         and (p_root is null or n.id = p_root)
    union
      select c.id
        from scope s
        join node c on c.parent_id = s.id
       where p_root is not null
  ),
  pairs as (
      select s.id as root_id, s.id as desc_id from scope s
    union all
      select p.root_id, c.id
        from pairs p
        join node c on c.parent_id = p.desc_id
  )
  select
    p.root_id,
    count(u.id),
    count(u.id) filter (where u.status = '완료'),
    case when count(u.id) = 0 then null
         else round((count(u.id) filter (where u.status = '완료'))::numeric / count(u.id), 4)
    end
  from pairs p
  left join ur u on u.feature_id = p.desc_id
  group by p.root_id;
$$;

-- 프로젝트 요약 (작은 JSON 1개).
create or replace function project_summary(p_project_id uuid)
returns jsonb
language sql
stable
set search_path = public
as $$
  with nodes as (
    select n.* from node n where n.project_id = p_project_id
  ),
  cov as (
    select u.status,
           exists (select 1 from ur_work_link l where l.ur_id = u.id) as linked
      from ur u
      join nodes n on n.id = u.feature_id
  ),
  prog as (
    select * from subtree_progress(p_project_id, null)
  )
  select jsonb_build_object(
    'nodes', (
      select coalesce(jsonb_object_agg(t.type, t.c), '{}'::jsonb)
        from (select type::text as type, count(*) as c from nodes group by type) t
    ),
    'urs', jsonb_build_object(
      'total',     (select count(*) from cov),
      '완료',      (select count(*) from cov where status = '완료'),
      '미구현',    (select count(*) from cov where status = '미구현'),
      '오구현',    (select count(*) from cov where status = '오구현'),
      'uncovered', (select count(*) from cov where not linked and status <> '완료')
    ),
    'tasks_by_category', (
      select coalesce(jsonb_object_agg(t.cat, t.c), '{}'::jsonb)
        from (
          select coalesce(s.category::text, '없음') as cat, count(*) as c
            from nodes n
            left join status s on s.id = n.status_id
           where n.type = '작업'
           group by 1
        ) t
    ),
    'contents', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', n.id,
               'key', 'Content-' || n.ticket_number,
               'title', n.title,
               'total_urs', p.total_urs,
               'done_urs', p.done_urs,
               'progress', p.progress
             ) order by n.sort_order, n.created_at), '[]'::jsonb)
        from nodes n
        join prog p on p.node_id = n.id
       where n.type = '컨텐츠'
    )
  );
$$;

grant execute on function subtree_progress(uuid, uuid) to anon, authenticated, service_role;
grant execute on function project_summary(uuid)        to anon, authenticated, service_role;

-- 조회 인덱스: UR 키(Requirement-N) 조회, 작업 로그의 작업자/기간 필터.
create index if not exists idx_ur_ticket_number    on ur(ticket_number);
create index if not exists idx_work_log_member     on work_log(member_id);
create index if not exists idx_work_log_started_at on work_log(started_at);
create index if not exists idx_node_updated_at     on node(project_id, updated_at);

-- PostgREST 스키마 캐시 갱신(새 RPC 노출).
notify pgrst, 'reload schema';
