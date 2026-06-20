import type { SVGProps } from "react"
import type { NodeType } from "@/nodes/nodeGrammar"

const base = (p: SVGProps<SVGSVGElement>) => ({
  width: 16,
  height: 16,
  viewBox: "0 0 16 16",
  fill: "currentColor",
  shapeRendering: "crispEdges" as const,
  ...p,
})

// 컨텐츠 = 픽셀 벚꽃나무
export const IconContent = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="6" y="1" width="4" height="2" />
    <rect x="4" y="3" width="8" height="2" />
    <rect x="2" y="5" width="12" height="2" />
    <rect x="4" y="7" width="8" height="2" />
    <rect x="7" y="9" width="2" height="5" opacity=".4" />
  </svg>
)
// 기능 = 픽셀 블록 2x2
export const IconFeature = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="2" y="2" width="5" height="5" />
    <rect x="9" y="2" width="5" height="5" opacity=".5" />
    <rect x="2" y="9" width="5" height="5" opacity=".5" />
    <rect x="9" y="9" width="5" height="5" />
  </svg>
)
// 세부기능 = 픽셀 노드-플로우
export const IconSubFeature = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="2" y="2" width="3" height="3" />
    <rect x="11" y="6" width="3" height="3" />
    <rect x="2" y="11" width="3" height="3" />
    <rect x="5" y="3" width="6" height="1.6" opacity=".5" />
    <rect x="5" y="11.4" width="6" height="1.6" opacity=".5" />
  </svg>
)
// 마스터데이터 = 픽셀 카드 스택
export const IconMasterData = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="3" y="2" width="8" height="10" opacity=".4" />
    <rect x="5" y="4" width="8" height="10" />
  </svg>
)
// 작업 = 픽셀 체크박스(빈 프레임)
export const IconTask = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="2" y="2" width="12" height="2" />
    <rect x="2" y="12" width="12" height="2" />
    <rect x="2" y="2" width="2" height="12" />
    <rect x="12" y="2" width="2" height="12" />
  </svg>
)

export const PIXEL_ICONS: Record<
  NodeType,
  (p: SVGProps<SVGSVGElement>) => React.JSX.Element
> = {
  컨텐츠: IconContent,
  기능: IconFeature,
  세부기능: IconSubFeature,
  마스터데이터: IconMasterData,
  작업: IconTask,
}
