import { ChevronRight } from "lucide-react"
import { useNodes } from "@/nodes/NodesProvider"
import { ProgressBadge, StatusBadge } from "@/nodes/NodeBadges"
import { ticketKey } from "@/nodes/nodeGrammar"
import { LayerIcon, TicketKey } from "@/components/ds"

/**
 * 상세 패널 드릴다운 — 비-잎 노드의 "한 단계 아래" 자식 목록 (Section flush 바디).
 * 행 = 타입아이콘 + 제목 + 티켓키 + 진행률/상태. 클릭 → openNode.
 */
export function ChildNav({ parentId }: { parentId: string }) {
  const { childrenOf, openNode } = useNodes()
  const kids = childrenOf(parentId)

  if (kids.length === 0) {
    return (
      <p className="text-body text-fg-3 px-5 py-4" data-testid="child-nav-empty">
        하위 항목이 없습니다. 왼쪽 트리에서 항목 옆 + 로 추가하세요.
      </p>
    )
  }

  return (
    <div className="flex flex-col" data-testid="child-nav">
      {kids.map((k) => (
        <button
          key={k.id}
          type="button"
          onClick={() => openNode(k.id)}
          className="group border-line hover:bg-subtle flex min-h-11 items-center gap-3 border-t px-5 py-2.5 text-left transition-colors first:border-t-0"
          data-testid="child-nav-row"
          data-node-type={k.type}
        >
          <LayerIcon type={k.type} />
          <span className="text-body text-fg min-w-0 flex-1 font-medium">{k.title}</span>
          <TicketKey
            value={ticketKey(k.type, k.ticket_number)}
            className="hidden sm:inline"
            data-testid="child-nav-key"
          />
          <span className="shrink-0">
            {k.type === "작업" ? (
              <StatusBadge statusId={k.status_id} />
            ) : (
              <ProgressBadge nodeId={k.id} />
            )}
          </span>
          <ChevronRight className="text-fg-3 group-hover:text-fg size-4 shrink-0" />
        </button>
      ))}
    </div>
  )
}
