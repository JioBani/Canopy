import { useState, type DragEvent } from "react"
import { AlertTriangle, ChevronRight } from "lucide-react"
import type { AppNode } from "@/lib/nodes"
import { urKey, type Ur, type UrStatus } from "@/lib/ur"
import { UR_STATE_META, UrStateGlyph } from "@/ur/urStateGlyph"
import { ticketKey } from "@/nodes/nodeGrammar"
import { cn } from "@/lib/utils"
import { Count, TicketKey } from "@/components/ds"

/** 좌→우 컬럼 순서: 미작업 · 오작업 · 완료 (완료는 기본 접힘 — 수가 많아서). */
const UR_COLUMNS: UrStatus[] = ["미구현", "오구현", "완료"]

function UrCard({
  ur,
  owner,
  onOpenOwner,
}: {
  ur: Ur
  owner: AppNode | undefined
  onOpenOwner: (id: string) => void
}) {
  function onDragStart(e: DragEvent<HTMLDivElement>) {
    e.dataTransfer.setData("text/plain", ur.id)
    e.dataTransfer.effectAllowed = "move"
  }
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={() => onOpenOwner(ur.feature_id)}
      className="border-line bg-surface hover:border-line-strong flex cursor-grab flex-col gap-2 rounded-lg border p-3 transition-colors active:cursor-grabbing"
      data-testid="ur-board-card"
      data-ur-id={ur.id}
    >
      <div className="flex items-center gap-2">
        <TicketKey value={urKey(ur.ticket_number)} />
      </div>
      <div className="text-body text-fg line-clamp-4">{ur.text}</div>
      {ur.status === "오구현" && ur.misimpl_reason && (
        <div
          className="text-meta bg-danger-soft text-danger flex items-start gap-1.5 rounded-md px-2 py-1.5"
        >
          <AlertTriangle className="mt-px size-3.5 shrink-0" />
          <span className="line-clamp-2">{ur.misimpl_reason}</span>
        </div>
      )}
      {owner && (
        <div className="text-meta text-fg-3 truncate">
          {ticketKey("세부기능", owner.ticket_number)} · {owner.title}
        </div>
      )}
    </div>
  )
}

/**
 * 요구사항(UR) 칸반 — 노드가 아닌 UR 을 3상태(미작업/오작업/완료) 컬럼으로.
 * 카드 드래그로 status 변경. 완료 컬럼은 기본 접힘(개수만) — 펼치면 카드 표시.
 */
export function UrBoard({
  urs,
  loading,
  byId,
  onOpenOwner,
  onChangeStatus,
}: {
  urs: Ur[]
  loading: boolean
  byId: Map<string, AppNode>
  onOpenOwner: (id: string) => void
  onChangeStatus: (id: string, status: UrStatus) => void | Promise<void>
}) {
  const [showDone, setShowDone] = useState(false)

  function onDropTo(e: DragEvent<HTMLDivElement>, status: UrStatus) {
    e.preventDefault()
    const id = e.dataTransfer.getData("text/plain")
    if (id) void onChangeStatus(id, status)
  }

  return (
    <div className="min-h-0 flex-1 overflow-x-auto">
    <div
      className="mx-auto flex h-full max-w-[1760px] min-w-max justify-center gap-4 px-6 py-5"
      data-testid="ur-board"
    >
      {UR_COLUMNS.map((status) => {
        const col = urs.filter((u) => u.status === status)
        const meta = UR_STATE_META[status]
        const isDone = status === "완료"
        const collapsed = isDone && !showDone
        return (
          <div
            key={status}
            className={cn(
              "bg-sunken border-line rounded-card flex flex-col border",
              collapsed ? "w-16 shrink-0" : "max-w-[400px] min-w-[280px] grow basis-[300px]"
            )}
            data-testid="ur-board-column"
            data-status={status}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => onDropTo(e, status)}
          >
            {collapsed ? (
              <button
                type="button"
                onClick={() => setShowDone(true)}
                title={`완료 ${col.length} — 펼치기`}
                data-testid="ur-board-done-toggle"
                className="flex flex-1 flex-col items-center gap-2 px-2 py-3"
              >
                <UrStateGlyph status="완료" style={{ width: 16, height: 16 }} />
                <span className="tnum text-label text-fg">{col.length}</span>
                <ChevronRight className="text-fg-3 size-4" />
                <span className="text-label text-fg-2 [writing-mode:vertical-rl]">
                  완료
                </span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={isDone ? () => setShowDone(false) : undefined}
                  data-testid={isDone ? "ur-board-done-toggle" : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-t-card px-3 py-3 text-left",
                    isDone && "hover:bg-hover"
                  )}
                >
                  <UrStateGlyph status={status} style={{ width: 16, height: 16 }} />
                  <span className="text-subheading text-fg">{meta.label}</span>
                  <Count data-testid="ur-board-column-count">{col.length}</Count>
                </button>
                <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
                  {loading ? (
                    <div className="text-body text-fg-3 px-1 py-2">
                      불러오는 중…
                    </div>
                  ) : (
                    col.map((u) => (
                      <UrCard
                        key={u.id}
                        ur={u}
                        owner={byId.get(u.feature_id)}
                        onOpenOwner={onOpenOwner}
                      />
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        )
      })}
    </div>
    </div>
  )
}
