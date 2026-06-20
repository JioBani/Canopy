import { useState } from "react"
import { Plus } from "lucide-react"
import { useNodes } from "@/nodes/NodesProvider"
import { useProjects } from "@/projects/ProjectProvider"
import { ticketKey } from "@/lib/validation"
import { StatusBadge } from "@/nodes/NodeBadges"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

/**
 * 세부기능/마스터데이터에 직접 달린 작업들 — 컴팩트 리스트.
 * 행 클릭 → 작업 상세 페이지(openNode). 작업내용/연결UR/편집은 작업 상세에서.
 * full(상세, !compact): 작업 추가 어포던스 노출. compact(사이드바): 보기/네비 전용.
 */
export function WorkSection({
  parentId,
  compact = false,
}: {
  parentId: string
  compact?: boolean
}) {
  const { childrenOf, openNode, createChild } = useNodes()
  const { currentProject } = useProjects()
  const [adding, setAdding] = useState(false)
  const works = childrenOf(parentId).filter((n) => n.type === "작업")

  const tk = (num: number) =>
    currentProject ? ticketKey(currentProject.key_prefix, num) : `#${num}`

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

      {works.map((w) => (
        <button
          key={w.id}
          type="button"
          onClick={() => openNode(w.id)}
          className="flex items-center gap-1.5 rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-[var(--c-pink-bg)]"
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
            <TooltipContent className="max-w-[360px]">{w.title}</TooltipContent>
          </Tooltip>
          {!compact && w.domain && (
            <span
              className="shrink-0 rounded-md px-1.5 py-0.5 text-[10.5px] font-medium"
              style={{ background: "var(--c-pink-bg)", color: "var(--c-plum)" }}
            >
              {w.domain}
            </span>
          )}
          <StatusBadge statusId={w.status_id} />
        </button>
      ))}
    </div>
  )
}
