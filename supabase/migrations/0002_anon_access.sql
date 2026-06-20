-- ===========================================================================
-- 0002 — 로그인 게이트 제거: anon(비로그인) 전체 허용 (팀 내부용)
--   0001 은 authenticated 만 허용했다. 로그인 없이 앱을 쓰려면 anon 역할에도
--   접근을 열어야 한다. additive — 기존 authenticated 정책/GRANT 는 그대로 두고
--   anon 정책·GRANT 만 추가한다. (RLS 는 permissive OR 라 충돌 없음.)
-- ===========================================================================

-- 스키마/테이블/시퀀스 GRANT (anon)
grant usage on schema public to anon;
grant all on all tables in schema public to anon;       -- 뷰 포함
grant all on all sequences in schema public to anon;

-- 프로젝트 insert 시 도는 기본 상태 시드 함수 — anon 도 호출 가능해야 함
grant execute on function seed_default_statuses(uuid) to anon;

-- RLS 정책 (anon 전체 허용) — 테이블별
create policy "anon all" on project        for all to anon using (true) with check (true);
create policy "anon all" on ticket_counter for all to anon using (true) with check (true);
create policy "anon all" on member         for all to anon using (true) with check (true);
create policy "anon all" on status         for all to anon using (true) with check (true);
create policy "anon all" on node           for all to anon using (true) with check (true);
create policy "anon all" on ur_group       for all to anon using (true) with check (true);
create policy "anon all" on ur             for all to anon using (true) with check (true);
create policy "anon all" on ur_work_link   for all to anon using (true) with check (true);
create policy "anon all" on task_checklist for all to anon using (true) with check (true);
create policy "anon all" on node_link      for all to anon using (true) with check (true);
