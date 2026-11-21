-- ===========================================================================
-- 0008 — UR 설명(description)
--   요구사항은 한 줄 원문(text)만 담을 수 있어 배경·결정 히스토리·상세 스펙을
--   적을 곳이 없었다. node.body 와 같은 성격의 마크다운 장문 필드를 추가한다.
--   additive · nullable → 기존 행/코드 무영향.
-- ===========================================================================

alter table ur add column if not exists description text;

comment on column ur.description is '요구사항 상세 설명·히스토리 (마크다운).';
