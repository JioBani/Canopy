import { useState } from "react"
import { LayoutList, Plus } from "lucide-react"
import { useNodes } from "@/nodes/NodesProvider"
import { ticketKey } from "@/nodes/nodeGrammar"
import { StatusBadge } from "@/nodes/NodeBadges"
import { memberLabel } from "@/lib/members"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Section, StatusChip, TicketKey } from "@/components/ds"

/**
 * 세부기능/마스터데이터에 직접 달린 작업들.
 * full(상세): Section 카드 + 작업 추가. compact(사이드바 임베드): 보기/네비 전용 목록.
 * 행 클릭 → 작업 상세(openNode).
 */
export function WorkSection({
  parentId,
  compact = false,
}: {
  parentId: string
  compact?: boolean
}) {
  const { childrenOf, openNode, createChild, getStatus, members } = useNodes()
  const [adding, setAdding] = useState(false)
  const works = childrenOf(parentId).filter((n) => n.type === "작업")

  if (compact) {
    return (
      <div className="flex flex-col" data-testid="work-section">
        {works.length === 0 && (
          <p className="text-meta text-fg-3 px-2 py-1.5">작업이 없습니다.</p>
        )}
        {works.map((w) => (
          <button
            key={w.id}
            type="button"
            onClick={() => openNode(w.id)}
            title={`${ticketKey(w.type, w.ticket_number)} ${w.title}`}
            className="text-body text-fg hover:bg-hover flex min-h-8 items-center gap-2 rounded-md px-2 py-1 text-left"
            data-testid="work-row"
          >
            <span className="min-w-0 flex-1 truncate">{w.title}</span>
            <StatusBadge statusId={w.status_id} />
          </button>
        ))}
      </div>
    )
  }

  return (
    <Section
      icon={<LayoutList />}
      title="작업"
      count={works.length}
      flush
      data-testid="work-section"
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={() => setAdding(true)}
          data-testid="add-work"
        >
          <Plus />작업
        </Button>
      }
    >
      {adding && (
        <div className="border-line border-b px-5 py-3">
          <Input
            autoFocus
            placeholder="작업 제목을 입력하고 Enter (Esc 로 닫기)"
            data-testid="add-work-input"
            onKeyDown={(e) => {
              const v = (e.target as HTMLInputElement).value.trim()
              if (e.key === "Enter" && v) {
                void createChild(parentId, "작업", v).then(() => {
                  ;(e.target as HTMLInputElement).value = ""
                })
              } else if (e.key === "Escape") setAdding(false)
            }}
            onBlur={() => setAdding(false)}
          />
        </div>
      )}

      {works.length === 0 && !adding && (
        <p className="text-body text-fg-3 px-5 py-4">
          작업이 없습니다. <b className="text-fg-2 font-semibold">+ 작업</b>으로 추가하세요.
        </p>
      )}

      {works.map((w) => {
        const assignee = w.assignee_id
          ? members.find((m) => m.id === w.assignee_id)
          : undefined
        return (
          <button
            key={w.id}
            type="button"
            onClick={() => openNode(w.id)}
            className="border-line hover:bg-subtle flex min-h-11 w-full items-center gap-3 border-t px-5 py-2.5 text-left transition-colors first:border-t-0"
            data-testid="work-row"
          >
            <StatusChip status={getStatus(w.status_id)} data-testid="status-badge" />
            <TicketKey value={ticketKey(w.type, w.ticket_number)} className="hidden sm:inline" />
            <span className="text-body text-fg line-clamp-2 min-w-0 flex-1 font-medium">
              {w.title}
            </span>
            {w.domain && (
              <span className="text-label bg-sunken text-fg-2 shrink-0 rounded-md px-2 py-0.5">
                {w.domain}
              </span>
            )}
            {assignee && (
              <span
                className="text-micro inline-flex size-[22px] shrink-0 items-center justify-center rounded-full"
                style={{ background: assignee.color ?? "#F6D3E0", color: "#3B1D2A" }}
                title={memberLabel(assignee)}
              >
                {memberLabel(assignee).slice(0, 1).toUpperCase()}
              </span>
            )}
          </button>
        )
      })}
    </Section>
  )
}
