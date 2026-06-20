import type { NodeType } from "@/nodes/nodeGrammar"

/**
 * Pixel Blossom "정원의 레이어" — 타입(레이어)별 저채도 distinct 색.
 * 상태색(mist/peach/sakura/ember)·도메인칩(pink-bg/plum)과 다른 의미축.
 * 사용처 절제: 커버 밴드 틴트·액센트, 레이어 칩, 트리/네비 타입 아이콘(아이콘만).
 *  - base: 아이콘·틴트·굵은 액센트 (작은 텍스트 금지)
 *  - ink : 칩 라벨 텍스트 (틴트/흰 위 AA)
 */
export const LAYER_COLOR: Record<NodeType, { base: string; ink: string }> = {
  컨텐츠: { base: "#E27BA4", ink: "#B84A77" },
  기능: { base: "#A892D9", ink: "#6E55B0" },
  세부기능: { base: "#7DAEDE", ink: "#3F6FA6" },
  마스터데이터: { base: "#5FBBA2", ink: "#2E7E6A" },
  작업: { base: "#DDA24A", ink: "#9C6B1C" },
}

/** 레이어 틴트 배경(흰색에 base 12% 혼합) — 커버 밴드용. */
export function layerTint(type: NodeType): string {
  return `color-mix(in oklab, ${LAYER_COLOR[type].base} 12%, white)`
}
