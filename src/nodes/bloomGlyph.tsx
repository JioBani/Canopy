import type { SVGProps } from "react"
import type { StatusCategory } from "@/lib/statuses"
import { CATEGORY_TONE } from "@/lib/statusTone"

const petals = [
  ["8", "3.7"],
  ["12.3", "6.4"],
  ["10.6", "11.4"],
  ["5.4", "11.4"],
  ["3.7", "6.4"],
]

/** 브랜드 마크(로고) 전용 꽃. 상태 표시에 쓰지 않는다. */
export const BloomFull = (p: SVGProps<SVGSVGElement>) => (
  <svg width="15" height="15" viewBox="0 0 16 16" {...p}>
    <g fill="currentColor">
      {petals.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="2.3" />
      ))}
    </g>
    <circle cx="8" cy="8" r="1.7" fill="#fff" />
  </svg>
)

/* ── 상태 글리프 (design-system-v2): ○ 할일 · ◐ 진행중 · ✓ 완료 · ⊘ 취소됨 ──
   색만이 아니라 모양으로도 구분된다. currentColor 사용. */
const ring = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
}

export const StatusTodo = (p: SVGProps<SVGSVGElement>) => (
  <svg {...ring} {...p}>
    <circle cx="12" cy="12" r="8.5" />
  </svg>
)
export const StatusProgress = (p: SVGProps<SVGSVGElement>) => (
  <svg {...ring} {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" stroke="none" />
  </svg>
)
export const StatusDone = (p: SVGProps<SVGSVGElement>) => (
  <svg {...ring} {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m8.3 12.2 2.6 2.6 4.8-5.2" />
  </svg>
)
export const StatusCancelled = (p: SVGProps<SVGSVGElement>) => (
  <svg {...ring} {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m6 18 12-12" />
  </svg>
)

/** 카테고리 → 상태 글리프 (이름은 v1 호환). */
export const BLOOM_GLYPH: Record<
  StatusCategory,
  (p: SVGProps<SVGSVGElement>) => React.JSX.Element
> = {
  할일: StatusTodo,
  진행중: StatusProgress,
  완료: StatusDone,
  취소됨: StatusCancelled,
}

/** 카테고리별 텍스트/아이콘 색 (v1 호환 이름). */
export const CATEGORY_TEXT_COLOR: Record<StatusCategory, string> = {
  할일: CATEGORY_TONE.할일.fg,
  진행중: CATEGORY_TONE.진행중.fg,
  완료: CATEGORY_TONE.완료.fg,
  취소됨: CATEGORY_TONE.취소됨.fg,
}
