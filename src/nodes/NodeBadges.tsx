import { useNodes } from "@/nodes/NodesProvider"
import { statusTone } from "@/lib/statusTone"
import { BLOOM_GLYPH } from "@/nodes/bloomGlyph"
import { cn } from "@/lib/utils"

/**
 * 비-잎 노드의 roll-up 진행률 — 숫자 하나(design-system-v2: 제목 폭 우선).
 * 100% = 완료색, 0% = 흐리게, 요구사항 없음 = "—".
 */
export function ProgressBadge({ nodeId }: { nodeId: string }) {
  const { getProgress } = useNodes()
  const np = getProgress(nodeId)

  if (!np || np.total_urs === 0 || np.progress === null) {
    return (
      <span
        className="text-meta text-fg-disabled w-10 text-right"
        data-testid="node-progress"
        data-progress="none"
        title="요구사항 없음"
      >
        —
      </span>
    )
  }

  const pct = Math.round(np.progress * 100)
  return (
    <span
      className={cn(
        "text-meta tnum w-10 text-right font-medium",
        pct >= 100 ? "text-st-done" : pct === 0 ? "text-fg-disabled" : "text-fg-3"
      )}
      data-testid="node-progress"
      data-progress={String(pct)}
      title={`요구사항 ${np.done_urs}/${np.total_urs} 완료`}
    >
      {pct}%
    </span>
  )
}

/**
 * 작업 상태 — 글리프 + 이름 (트리·목록용 인라인, 배경 없음).
 * 색: 사용자 지정 상태색 → 카테고리 의미색.
 */
export function StatusBadge({ statusId }: { statusId: string | null }) {
  const { getStatus } = useNodes()
  const status = getStatus(statusId)

  if (!status) {
    return (
      <span
        className="text-meta text-fg-3 inline-flex items-center gap-1 whitespace-nowrap"
        data-testid="status-badge"
        data-status="미지정"
      >
        <span className="border-fg-3 inline-block size-3 rounded-full border border-dashed" />
        미지정
      </span>
    )
  }

  const Glyph = BLOOM_GLYPH[status.category]
  const tone = statusTone(status)
  return (
    <span
      className={cn(
        "text-meta inline-flex items-center gap-1 font-medium whitespace-nowrap",
        status.category === "취소됨" && "line-through"
      )}
      style={{ color: tone.fg }}
      data-testid="status-badge"
      data-status={status.category}
      title={status.category}
    >
      <Glyph className="size-3.5 shrink-0" />
      {status.name}
    </span>
  )
}
