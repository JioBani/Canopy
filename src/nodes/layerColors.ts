import type { NodeType } from "@/nodes/nodeGrammar"
import { icon, ink, tint } from "@/lib/themeColor"

const HEX: Record<NodeType, string> = {
  컨텐츠: "#D9669A",
  기능: "#8F75D1",
  세부기능: "#4F8FD1",
  마스터데이터: "#3DA588",
  작업: "#D08E2C",
}

/**
 * 레이어(계층 타입) 색 — design-system-v2.
 * 아이콘(base)과 타입 칩(ink 글자 + soft 배경)에서만 쓴다. 본문 텍스트·넓은 배경 틴트 금지.
 */
// 값은 CSS 식(테마 적응) — inline style 전용. base=아이콘, ink=칩 글자, soft=칩 배경.
export const LAYER_COLOR: Record<NodeType, { base: string; ink: string; soft: string }> =
  Object.fromEntries(
    (Object.keys(HEX) as NodeType[]).map((t) => [
      t,
      { base: icon(HEX[t]), ink: ink(HEX[t]), soft: tint(HEX[t], 12) },
    ])
  ) as Record<NodeType, { base: string; ink: string; soft: string }>

/** 레이어 soft 배경 (타입 칩). */
export function layerTint(type: NodeType): string {
  return LAYER_COLOR[type].soft
}
