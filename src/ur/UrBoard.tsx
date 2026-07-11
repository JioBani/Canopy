import { useState, type DragEvent } from "react"
import { AlertTriangle, ChevronRight } from "lucide-react"
import type { AppNode } from "@/lib/nodes"
import { urKey, type Ur, type UrStatus } from "@/lib/ur"
import { UR_STATE_META, UrStateGlyph } from "@/ur/urStateGlyph"
import { ticketKey } from "@/nodes/nodeGrammar"
import { cn } from "@/lib/utils"

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
      className="flex cursor-grab flex-col gap-1.5 rounded-[10px] border bg-card p-2.5 shadow-xs transition-shadow hover:shadow-sm active:cursor-grabbing"
      style={{ borderColor: "var(--c-line)" }}
      data-testid="ur-board-card"
      data-ur-id={ur.id}
    >
      <div className="flex items-center gap-2">
        <code
          className="tnum font-mono text-[11px] font-semibold"
          style={{ color: "var(--c-plum)" }}
        >
          {urKey(ur.ticket_number)}
        </code>
      </div>
      <div className="line-clamp-3 text-[13px] leading-snug">{ur.text}</div>
      {ur.status === "오구현" && ur.misimpl_reason && (
        <div
          className="flex items-start gap-1 rounded-md px-1.5 py-1 text-[11px]"
          style={{ background: "var(--c-pink-bg)", color: "var(--c-ember)" }}
        >
          <AlertTriangle className="mt-px size-3 shrink-0" />
          <span className="line-clamp-2">{ur.misimpl_reason}</span>
        </div>
      )}
      {owner && (
        <div className="text-muted-foreground truncate text-[10.5px]">
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
    <div className="flex flex-1 gap-3 overflow-x-auto p-4" data-testid="ur-board">
      {UR_COLUMNS.map((status) => {
        const col = urs.filter((u) => u.status === status)
        const meta = UR_STATE_META[status]
        const isDone = status === "완료"
        const collapsed = isDone && !showDone
        return (
          <div
            key={status}
            className={cn(
              "flex flex-col rounded-[var(--radius-card)] border",
              collapsed ? "w-16 shrink-0" : "min-w-80 flex-1"
            )}
            style={{ background: "var(--c-bg-sunken)", borderColor: "var(--c-line)" }}
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
                <span className="tnum text-xs font-semibold">{col.length}</span>
                <ChevronRight className="text-muted-foreground size-4" />
                <span className="text-muted-foreground text-xs [writing-mode:vertical-rl]">
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
                    "flex items-center gap-2 px-3 py-2.5 text-left",
                    isDone && "hover:bg-[var(--c-pink-bg)]"
                  )}
                >
                  <UrStateGlyph status={status} style={{ width: 14, height: 14 }} />
                  <span className="font-display text-sm font-bold">
                    {meta.label}
                  </span>
                  <span
                    className="tnum text-muted-foreground text-xs"
                    data-testid="ur-board-column-count"
                  >
                    {col.length}
                  </span>
                </button>
                <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
                  {loading ? (
                    <div className="text-muted-foreground px-1 py-2 text-xs">
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
  )
}
