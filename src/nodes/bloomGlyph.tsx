import type { SVGProps } from "react"
import type { StatusCategory } from "@/lib/statuses"

const petals = [
  ["8", "3.7"],
  ["12.3", "6.4"],
  ["10.6", "11.4"],
  ["5.4", "11.4"],
  ["3.7", "6.4"],
]
const petalsSmall = [
  ["8", "4"],
  ["12", "6.6"],
  ["10.4", "11.2"],
  ["5.6", "11.2"],
  ["4", "6.6"],
]

// 만개(완료)
export const BloomFull = (p: SVGProps<SVGSVGElement>) => (
  <svg width="15" height="15" viewBox="0 0 16 16" {...p}>
    <g fill="currentColor">
      {petals.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="2.3" />
      ))}
    </g>
    <circle cx="8" cy="8" r="1.7" fill="#C24E78" />
  </svg>
)
// 반개(진행중)
export const BloomHalf = (p: SVGProps<SVGSVGElement>) => (
  <svg width="15" height="15" viewBox="0 0 16 16" {...p}>
    <g fill="currentColor">
      {petalsSmall.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="2.1" />
      ))}
    </g>
    <circle cx="8" cy="8" r="1.5" fill="#BE6A3F" />
  </svg>
)
// 빈꽃(할일) — 외곽선만
export const BloomEmpty = (p: SVGProps<SVGSVGElement>) => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.2"
    {...p}
  >
    {petalsSmall.map(([cx, cy], i) => (
      <circle key={i} cx={cx} cy={cy} r="2.1" />
    ))}
  </svg>
)
// 시듦(취소) — 흐린 채움
export const BloomWilt = (p: SVGProps<SVGSVGElement>) => (
  <svg width="15" height="15" viewBox="0 0 16 16" opacity=".55" {...p}>
    <g fill="currentColor">
      {petalsSmall.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="2.1" />
      ))}
    </g>
  </svg>
)

export const BLOOM_GLYPH: Record<
  StatusCategory,
  (p: SVGProps<SVGSVGElement>) => React.JSX.Element
> = {
  할일: BloomEmpty,
  진행중: BloomHalf,
  완료: BloomFull,
  취소됨: BloomWilt,
}

/** 카테고리별 글리프 색 / 라벨 텍스트색 (대비 규칙: 작은 핑크 텍스트는 plum). */
export const CATEGORY_TEXT_COLOR: Record<StatusCategory, string> = {
  할일: "var(--c-mist)",
  진행중: "var(--c-peach-d)",
  완료: "var(--c-plum)",
  취소됨: "var(--c-ink-3)",
}
