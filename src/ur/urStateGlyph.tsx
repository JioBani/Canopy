import { AlertTriangle, Circle, CheckCircle2, type LucideProps } from "lucide-react"
import type { UrStatus } from "@/lib/ur"

/** UR 3상태 — 작업 개화글리프(꽃)와 분리한 원/경고 언어(혼동 방지). */
export const UR_STATE_META: Record<
  UrStatus,
  { color: string; label: string }
> = {
  미구현: { color: "var(--c-mist)", label: "미구현" },
  완료: { color: "var(--c-sakura)", label: "완료" },
  오구현: { color: "var(--c-ember)", label: "오구현" },
}

export const UR_STATES: UrStatus[] = ["미구현", "완료", "오구현"]

/** 상태별 글리프: ○ 미구현 / ● 완료 / ⚠ 오구현. */
export function UrStateGlyph({
  status,
  ...props
}: { status: UrStatus } & LucideProps) {
  const color = UR_STATE_META[status].color
  if (status === "완료")
    return <CheckCircle2 {...props} style={{ color, ...props.style }} />
  if (status === "오구현")
    return <AlertTriangle {...props} style={{ color, ...props.style }} />
  return <Circle {...props} style={{ color, ...props.style }} />
}
