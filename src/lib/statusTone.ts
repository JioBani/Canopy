import { CATEGORY_COLOR, type Status, type StatusCategory } from "@/lib/statuses"
import { ink, tint } from "@/lib/themeColor"

/** 상태 카테고리 의미색 (design-system-v2). fg=텍스트·아이콘, bg=칩 배경. */
export const CATEGORY_TONE: Record<StatusCategory, { fg: string; bg: string }> = {
  할일: { fg: "var(--ds-st-todo)", bg: "var(--ds-st-todo-bg)" },
  진행중: { fg: "var(--ds-st-prog)", bg: "var(--ds-st-prog-bg)" },
  완료: { fg: "var(--ds-st-done)", bg: "var(--ds-st-done-bg)" },
  취소됨: { fg: "var(--ds-st-cancel)", bg: "var(--ds-st-cancel-bg)" },
}

/**
 * v1(Pixel Blossom)·초기 시드가 DB 에 박아 둔 기본색. 사용자가 고른 색이 아니므로
 * 이 값이면 카테고리 의미색을 쓴다 (0001/0006 마이그레이션 값).
 */
const LEGACY_DEFAULTS = new Set(
  ["#aba2a8", "#ec9a78", "#e88aab", "#6b7280", "#3b82f6", "#22c55e", "#ef4444"].map(
    (c) => c.toLowerCase()
  )
)

export function isCustomStatusColor(
  color: string | null | undefined,
  category?: StatusCategory
): color is string {
  if (!color) return false
  const c = color.trim().toLowerCase()
  if (LEGACY_DEFAULTS.has(c)) return false
  if (category && CATEGORY_COLOR[category].toLowerCase() === c) return false
  return true
}

/** 상태 → 칩 색. 사용자 지정색이면 그 색을 글자/아이콘에, 배경은 12% 틴트. */
export function statusTone(
  status: Pick<Status, "category" | "color">
): { fg: string; bg: string } {
  if (isCustomStatusColor(status.color, status.category)) {
    return {
      fg: ink(status.color),
      bg: tint(status.color, 14),
    }
  }
  return CATEGORY_TONE[status.category]
}
