import type { NodeType } from "@/nodes/nodeGrammar"

/**
 * 레이어(계층 타입) 색 — design-system-v2.
 * 아이콘(base)과 타입 칩(ink 글자 + soft 배경)에서만 쓴다. 본문 텍스트·넓은 배경 틴트 금지.
 */
export const LAYER_COLOR: Record<NodeType, { base: string; ink: string; soft: string }> = {
  컨텐츠: { base: "#D9669A", ink: "#9E3566", soft: "#FBEBF2" },
  기능: { base: "#8F75D1", ink: "#5B42A3", soft: "#F0ECFA" },
  세부기능: { base: "#4F8FD1", ink: "#2C5F9E", soft: "#E8F1FB" },
  마스터데이터: { base: "#3DA588", ink: "#1F6E59", soft: "#E4F5EF" },
  작업: { base: "#D08E2C", ink: "#8A5A12", soft: "#FBF1E1" },
}

/** 레이어 soft 배경 (타입 칩). */
export function layerTint(type: NodeType): string {
  return LAYER_COLOR[type].soft
}
