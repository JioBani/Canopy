import { useNodes } from "@/nodes/NodesProvider"
import { CATEGORY_COLOR } from "@/lib/statuses"
import { BLOOM_GLYPH, CATEGORY_TEXT_COLOR } from "@/nodes/bloomGlyph"

/**
 * 비-잎 노드의 roll-up 진행바 — 레트로 EXP 칸(4칸) + 정확한 %(Pretendard tnum).
 * 하위 작업 0개(null)면 중립 "—".
 */
export function ProgressBadge({ nodeId }: { nodeId: string }) {
  const { getProgress } = useNodes()
  const np = getProgress(nodeId)

  if (!np || np.total_urs === 0 || np.progress === null) {
    return (
      <span
        className="w-[68px] text-right text-xs"
        style={{ color: "var(--c-ink-3)" }}
        data-testid="node-progress"
        data-progress="none"
        title="요구사항 없음"
      >
        —
      </span>
    )
  }

  const cells = 4
  const pct = Math.round(np.progress * 100)
  const filled = Math.round(np.progress * cells)
  return (
    <span
      className="flex w-[68px] items-center justify-end gap-1.5"
      data-testid="node-progress"
      data-progress={String(pct)}
      title={`요구사항 ${np.done_urs}/${np.total_urs} 완료`}
    >
      <span className="flex gap-[2.5px]">
        {Array.from({ length: cells }).map((_, i) => (
          <span
            key={i}
            className="size-[9px] rounded-[1.5px]"
            style={{
              background: i < filled ? "var(--primary)" : "var(--c-exp-empty)",
            }}
          />
        ))}
      </span>
      <span
        className="tnum w-7 text-right text-[10.5px]"
        style={{ color: "var(--c-plum)" }}
      >
        {pct}%
      </span>
    </span>
  )
}

/**
 * 작업 상태 뱃지 — 벚꽃 개화 글리프 + 라벨(테두리/배경 없는 인라인).
 * 색: status.color 우선 → 카테고리 개화색. 라벨 텍스트색은 대비 규칙(plum/peach-d/mist).
 */
export function StatusBadge({ statusId }: { statusId: string | null }) {
  const { getStatus } = useNodes()
  const status = getStatus(statusId)

  if (!status) {
    return (
      <span
        className="inline-flex items-center gap-1 text-[11.5px] font-medium"
        style={{ color: "var(--c-ink-3)" }}
        data-testid="status-badge"
        data-status="미지정"
      >
        <span
          className="inline-block size-[9px] rounded-full border"
          style={{ borderColor: "var(--c-ink-3)" }}
        />
        미지정
      </span>
    )
  }

  const Glyph = BLOOM_GLYPH[status.category]
  const glyphColor = status.color ?? CATEGORY_COLOR[status.category]
  const textColor = CATEGORY_TEXT_COLOR[status.category]
  return (
    <span
      className="inline-flex items-center gap-1 text-[11.5px] font-medium"
      style={{ color: textColor }}
      data-testid="status-badge"
      data-status={status.category}
      title={status.category}
    >
      <Glyph style={{ color: glyphColor }} className="size-[14px] shrink-0" />
      {status.name}
    </span>
  )
}
