import { useState } from "react"
import { ChevronRight, Plus } from "lucide-react"
import { useNodes } from "@/nodes/NodesProvider"
import { useProjects } from "@/projects/ProjectProvider"
import { ticketKey } from "@/lib/validation"
import { StatusBadge } from "@/nodes/NodeBadges"
import { TaskChecklist } from "@/ur/TaskChecklist"
import { TaskUrLinks } from "@/ur/TaskUrLinks"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

/**
 * 세부기능/마스터데이터에 직접 달린 작업들.
 * compact(사이드바): 행 클릭 → 작업 선택(상세). full(상세): 접히는 카드 + 체크리스트/만족UR.
 */
export function WorkSection({
  parentId,
  featureId,
  compact = false,
}: {
  parentId: string
  /** 작업의 기능 조상(UR 피커 강조용). */
  featureId: string | null
  compact?: boolean
}) {
  const { childrenOf, openNode, createChild } = useNodes()
  const { currentProject } = useProjects()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState(false)
  const works = childrenOf(parentId).filter((n) => n.type === "작업")

  const tk = (num: number) =>
    currentProject ? ticketKey(currentProject.key_prefix, num) : `#${num}`

  // 사이드바(컴팩트)는 읽기/네비 전용 — 추가 어포던스 없음.
  if (compact && works.length === 0) {
    return (
      <p className="text-muted-foreground py-1 text-xs" data-testid="work-section">
        작업이 없습니다.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-1" data-testid="work-section">
      {/* 작업은 세부기능/마스터데이터 직속 생성(UR 무관). 풀 편집에서만 추가. */}
      {!compact && (
        <div className="flex items-center justify-end pb-0.5">
          {adding ? (
            <Input
              autoFocus
              placeholder="작업 제목 입력 후 Enter"
              className="h-7"
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
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => setAdding(true)}
              data-testid="add-work"
            >
              <Plus className="size-3.5" />작업
            </Button>
          )}
        </div>
      )}

      {works.length === 0 && (
        <p className="text-muted-foreground py-1 text-xs">작업이 없습니다.</p>
      )}

      {works.map((w) => {
        const open = !compact && expanded.has(w.id)
        if (compact) {
          return (
            <button
              key={w.id}
              type="button"
              onClick={() => openNode(w.id)}
              className="flex items-center gap-1.5 rounded-md px-1 py-1 text-left hover:bg-[var(--c-pink-bg)]"
              data-testid="work-row"
            >
              <code
                className="tnum shrink-0 font-mono text-[11px] font-semibold"
                style={{ color: "var(--c-plum)" }}
              >
                {tk(w.ticket_number)}
              </code>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="min-w-0 flex-1 truncate text-[13px]">
                    {w.title}
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-[360px]">
                  {w.title}
                </TooltipContent>
              </Tooltip>
              <StatusBadge statusId={w.status_id} />
            </button>
          )
        }
        return (
          <div
            key={w.id}
            className="border-border overflow-hidden rounded-[10px] border"
            data-testid="work-card"
          >
            <button
              type="button"
              onClick={() =>
                setExpanded((prev) => {
                  const n = new Set(prev)
                  if (n.has(w.id)) n.delete(w.id)
                  else n.add(w.id)
                  return n
                })
              }
              className="flex w-full items-center gap-2 px-2.5 py-2 text-left hover:bg-[var(--c-pink-bg)]/40"
              data-testid="work-card-header"
            >
              <ChevronRight
                className={cn(
                  "text-muted-foreground size-3.5 shrink-0 transition-transform",
                  open && "rotate-90"
                )}
              />
              <code
                className="tnum shrink-0 font-mono text-[11px] font-semibold"
                style={{ color: "var(--c-plum)" }}
              >
                {tk(w.ticket_number)}
              </code>
              <span className="min-w-0 flex-1 truncate text-[13px]">
                {w.title}
              </span>
              {w.domain && (
                <span
                  className="shrink-0 rounded-md px-1.5 py-0.5 text-[10.5px] font-medium"
                  style={{ background: "var(--c-pink-bg)", color: "var(--c-plum)" }}
                >
                  {w.domain}
                </span>
              )}
              <StatusBadge statusId={w.status_id} />
            </button>
            {open && (
              <div className="grid grid-cols-1 gap-4 border-t p-3 lg:grid-cols-2">
                <TaskChecklist workId={w.id} />
                <TaskUrLinks workId={w.id} featureId={featureId} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
