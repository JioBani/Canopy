/**
 * 프로젝트 입력 검증/정규화.
 * key_prefix 는 티켓키(`{key_prefix}-{번호}`) 조합에 쓰이므로 엄격히 sanitize 한다.
 */

export const KEY_PREFIX_MIN = 2
export const KEY_PREFIX_MAX = 10

/** 입력값을 키 프리픽스 규칙에 맞게 정규화: 대문자화 + 영숫자만 + 최대 길이. */
export function sanitizeKeyPrefix(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, KEY_PREFIX_MAX)
}

/** 키 프리픽스 검증. 통과 시 null, 실패 시 에러 메시지. */
export function validateKeyPrefix(value: string): string | null {
  if (value.length < KEY_PREFIX_MIN) {
    return `키 프리픽스는 ${KEY_PREFIX_MIN}자 이상이어야 합니다.`
  }
  if (value.length > KEY_PREFIX_MAX) {
    return `키 프리픽스는 ${KEY_PREFIX_MAX}자 이하여야 합니다.`
  }
  if (!/^[A-Z0-9]+$/.test(value)) {
    return "영문 대문자와 숫자만 사용할 수 있습니다."
  }
  return null
}

/** 프로젝트명 검증. 통과 시 null. */
export function validateProjectName(value: string): string | null {
  const trimmed = value.trim()
  if (trimmed.length === 0) return "프로젝트명을 입력하세요."
  if (trimmed.length > 60) return "프로젝트명은 60자 이하여야 합니다."
  return null
}

/** 티켓키 조합: `{key_prefix}-{ticket_number}`. */
export function ticketKey(keyPrefix: string, ticketNumber: number): string {
  return `${keyPrefix}-${ticketNumber}`
}
