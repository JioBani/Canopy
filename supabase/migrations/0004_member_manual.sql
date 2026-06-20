-- ===========================================================================
-- 0004 — member 수동 관리 (로그인 제거 후속)
--   auth.users 연동을 끊고 멤버를 직접 추가/수정/삭제할 수 있게 한다.
--   · auth.users → member 동기화 트리거/함수 제거
--   · member.id 의 auth.users FK 제거 + 자체 uuid 기본값(수동 생성)
--   · 아바타 색(color) 컬럼 추가
--   (email 은 이미 nullable, node.assignee_id 는 이미 ON DELETE SET NULL → 변경 불필요)
-- ===========================================================================

drop trigger if exists on_auth_user_synced on auth.users;
drop function if exists handle_auth_user_sync();

alter table member drop constraint if exists member_id_fkey;
alter table member alter column id set default gen_random_uuid();

alter table member add column if not exists color text;
