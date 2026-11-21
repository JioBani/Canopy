import { useNodes } from "@/nodes/NodesProvider"
import { ticketKey } from "@/nodes/nodeGrammar"
import type { AppNode } from "@/lib/nodes"
import { LayerChip, LayerIcon, TicketKey } from "@/components/ds"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

/** 경로 — 조상(루트→부모), 레이어 아이콘 + 제목. 클릭 시 점프. 길면 중간 생략. */
function Breadcrumb({
  ancestors,
  onJump,
}: {
  ancestors: AppNode[]
  onJump: (id: string) => void
}) {
  const collapsed = ancestors.length > 3
  const shown: (AppNode | null)[] = collapsed
    ? [ancestors[0], null, ancestors[ancestors.length - 1]]
    : ancestors
  const full = ancestors.map((a) => a.title).join(" / ")

  const nav = (
    <nav
      className="text-body text-fg-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1"
      aria-label="경로"
      data-testid="cover-breadcrumb"
    >
      {shown.map((a, i) => (
        <span key={a?.id ?? `gap-${i}`} className="flex min-w-0 items-center gap-2">
          {i > 0 && <span className="text-fg-disabled">/</span>}
          {a ? (
            <button
              type="button"
              onClick={() => onJump(a.id)}
              data-testid="breadcrumb-seg"
              className="hover:text-fg flex max-w-[260px] min-w-0 items-center gap-1.5 rounded-sm hover:underline"
            >
              <LayerIcon type={a.type} className="size-3.5" />
              <span className="truncate">{a.title}</span>
            </button>
          ) : (
            <span className="text-fg-3">…</span>
          )}
        </span>
      ))}
    </nav>
  )

  if (!collapsed) return nav
  return (
    <Tooltip>
      <TooltipTrigger asChild>{nav}</TooltipTrigger>
      <TooltipContent>{full}</TooltipContent>
    </Tooltip>
  )
}

/**
 * 상세 헤더 줄 — 경로 · 타입 칩 · 티켓키(복사). 제목은 아래 NodeDetail 이 담당.
 * (v1 의 레이어 틴트 커버 밴드는 폐지 — design-system-v2)
 */
export function CoverHeader({ node }: { node: AppNode }) {
  const { nodes, openNode } = useNodes()
  const ticket = ticketKey(node.type, node.ticket_number)

  const ancestors: AppNode[] = []
  let cur: AppNode | null = node.parent_id
    ? (nodes.find((n) => n.id === node.parent_id) ?? null)
    : null
  while (cur) {
    ancestors.unshift(cur)
    cur = cur.parent_id ? (nodes.find((n) => n.id === cur!.parent_id) ?? null) : null
  }

  return (
    <div
      className="flex min-h-8 flex-wrap items-center gap-x-4 gap-y-2"
      data-testid="cover-header"
      data-layer={node.type}
    >
      {ancestors.length > 0 ? (
        <Breadcrumb ancestors={ancestors} onJump={openNode} />
      ) : (
        <span className="text-body text-fg-3">최상위</span>
      )}
      <div className="ml-auto flex items-center gap-2" data-testid="cover-layer">
        <LayerChip type={node.type} data-testid="detail-type" />
        <TicketKey value={ticket} copy data-testid="detail-ticket" />
      </div>
    </div>
  )
}
