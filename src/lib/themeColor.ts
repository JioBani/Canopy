/**
 * 테마 적응 색 — 고정 hex(레이어·우선순위·사용자 지정 상태색)를 라이트/다크 모두에서 읽히게.
 * 결과는 CSS 식(color-mix + CSS 변수)이라 inline style 에 그대로 쓰고, 테마 전환 시 즉시 따라간다.
 * 변수 값은 src/index.css 의 :root / .dark 에 정의(--tc-*).
 *
 * - ink(hex)  : 글자색. 라이트 = 어둡게(가독), 다크 = 밝게.
 * - icon(hex) : 아이콘/점. 라이트 = 원색, 다크 = 살짝 밝게.
 * - tint(hex, pct) : 연한 배경. 표면색(--ds-surface)과 섞음 — 다크에선 더 진하게.
 */
export function ink(hex: string): string {
  return `color-mix(in oklab, ${hex} var(--tc-ink-mix), var(--tc-ink-base))`
}

export function icon(hex: string): string {
  return `color-mix(in oklab, ${hex} var(--tc-icon-mix), var(--tc-icon-base))`
}

export function tint(hex: string, pct = 14): string {
  return `color-mix(in oklab, ${hex} calc(${pct}% * var(--tc-tint-k)), var(--ds-surface))`
}
