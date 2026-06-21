-- ===========================================================================
-- 0006 — 기본 상태 색을 Pixel Blossom 팔레트로 통일
--   완료=퍼스널(sakura), 취소됨=회색(mist), 할일=회색(mist), 진행중=peach.
--   (프론트 CATEGORY_COLOR 와 일치 — 뱃지의 status.color 가 초록/빨강이던 것을 교정.)
-- ===========================================================================

create or replace function seed_default_statuses(p_project_id uuid)
returns void
language plpgsql
as $$
begin
  insert into status (project_id, name, category, color, sort_order) values
    (p_project_id, '할일',   '할일',   '#ABA2A8', 0),   -- mist(회색)
    (p_project_id, '진행중', '진행중', '#EC9A78', 0),   -- peach
    (p_project_id, '완료',   '완료',   '#E88AAB', 0),   -- sakura(퍼스널)
    (p_project_id, '취소됨', '취소됨', '#ABA2A8', 0);   -- mist(회색)
end;
$$;

-- 기존 시드 기본색만 새 팔레트로 교체(사용자 커스텀 색은 보존).
update status set color = '#ABA2A8' where category = '할일'   and color = '#6b7280';
update status set color = '#EC9A78' where category = '진행중' and color = '#3b82f6';
update status set color = '#E88AAB' where category = '완료'   and color = '#22c55e';
update status set color = '#ABA2A8' where category = '취소됨' and color = '#ef4444';
