import { useNodes } from "@/nodes/NodesProvider"
import { CATEGORY_COLOR } from "@/lib/statuses"
import { cn } from "@/lib/utils"

/** 비-잎 노드의 roll-up 진행바. 하위 작업 0개(null)면 중립 "—". */
export function ProgressBadge({ nodeId }: { nodeId: string }) {
  const { getProgress } = useNodes()
  const np = getProgress(nodeId)

  if (!np || np.total_tasks === 0 || np.progress === null) {
    return (
      <span
        className="text-muted-foreground/50 w-20 text-right text-xs"
        data-testid="node-progress"
        data-progress="none"
        title="하위 작업 없음"
      >
        —
      </span>
    )
  }

  const pct = Math.round(np.progress * 100)
  return (
    <span
      className="flex w-20 items-center gap-1.5"
      data-testid="node-progress"
      data-progress={String(pct)}
      title={`${np.done_tasks}/${np.total_tasks} 완료`}
    >
      <span className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
        <span
          className="bg-primary block h-full rounded-full transition-[width]"
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="text-muted-foreground w-8 text-right text-[11px] tabular-nums">
        {pct}%
      </span>
    </span>
  )
}

/** 작업 노드의 상태 뱃지. status.color 우선, 없으면 카테고리 기본색, 미지정이면 회색. */
export function StatusBadge({ statusId }: { statusId: string | null }) {
  const { getStatus } = useNodes()
  const status = getStatus(statusId)

  if (!status) {
    return (
      <span
        className="text-muted-foreground inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]"
        data-testid="status-badge"
        data-status="미지정"
      >
        미지정
      </span>
    )
  }

  const color = status.color ?? CATEGORY_COLOR[status.category]
  const dimmed = status.category === "취소됨"
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]",
        dimmed && "opacity-60"
      )}
      style={{ borderColor: color, color }}
      data-testid="status-badge"
      data-status={status.category}
      title={status.category}
    >
      <span
        className="size-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      {status.name}
    </span>
  )
}
