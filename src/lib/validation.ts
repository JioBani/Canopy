/**
 * 프로젝트 입력 검증/정규화.
 * 티켓키는 타입 기반(`{Type}-{번호}`)이라 프로젝트별 프리픽스가 없다.
 * (ticketKey 는 @/nodes/nodeGrammar 로 이동했다.)
 */

/** 프로젝트명 검증. 통과 시 null. */
export function validateProjectName(value: string): string | null {
  const trimmed = value.trim()
  if (trimmed.length === 0) return "프로젝트명을 입력하세요."
  if (trimmed.length > 60) return "프로젝트명은 60자 이하여야 합니다."
  return null
}
