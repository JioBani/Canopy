-- ============================================================================
-- 0011_status_icon — 상태 아이콘 (lucide 아이콘 키 문자열)
--
-- status.icon : 예) 'circle-dashed'. 허용 목록 검증은 앱 레이어(front) 담당, DB 는 길이만 제한.
-- 기본값(카테고리별): 할일=circle, 진행중=circle-dot, 완료=circle-check, 취소됨=circle-x
-- 기존 상태 백필: icon 이 비어 있는 행만 카테고리 기본값으로 채운다(재실행 안전).
-- ============================================================================

alter table status add column if not exists icon text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'status_icon_length') then
    alter table status add constraint status_icon_length check (icon is null or char_length(icon) between 1 and 64);
  end if;
end $$;

comment on column status.icon is '아이콘 키(lucide, 예: circle-dashed). 허용 목록은 앱에서 검증.';

-- 카테고리별 기본 아이콘 (시드·백필·앱 공용 기준)
create or replace function default_status_icon(p_category status_category)
returns text
language sql
immutable
as $$
  select case p_category
    when '할일'   then 'circle'
    when '진행중' then 'circle-dot'
    when '완료'   then 'circle-check'
    when '취소됨' then 'circle-x'
  end;
$$;

create or replace function seed_default_statuses(p_project_id uuid)
returns void
language plpgsql
as $$
begin
  insert into status (project_id, name, category, color, icon, sort_order) values
    (p_project_id, '할일',   '할일',   '#ABA2A8', 'circle',       0),
    (p_project_id, '진행중', '진행중', '#EC9A78', 'circle-dot',   0),
    (p_project_id, '완료',   '완료',   '#E88AAB', 'circle-check', 0),
    (p_project_id, '취소됨', '취소됨', '#ABA2A8', 'circle-x',     0);
end;
$$;

update status set icon = default_status_icon(category) where icon is null;

grant execute on function default_status_icon(status_category) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
