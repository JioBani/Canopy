import { useMemo, useState, type DragEvent } from "react"
import { useNodes } from "@/nodes/NodesProvider"
import { useProjects } from "@/projects/ProjectProvider"
import { memberLabel } from "@/lib/members"
import { ticketKey } from "@/lib/validation"
import type { StatusCategory } from "@/lib/statuses"
import type { AppNode, NodeDomain } from "@/lib/nodes"
import { BLOOM_GLYPH, CATEGORY_TEXT_COLOR } from "@/nodes/bloomGlyph"
import { CATEGORY_COLOR } from "@/lib/statuses"

const CATEGORIES: StatusCategory[] = ["할일", "진행중", "완료", "취소됨"]
const DOMAINS: NodeDomain[] = [
  "기획",
  "디자인",
  "사운드",
  "구현",
  "밸런싱",
  "기타",
]

const selectClass =
  "h-8 rounded-[9px] border border-transparent bg-[#F5F2F4] px-2.5 text-sm outline-none hover:bg-[#EFE7EC] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"

/** 작업의 조상 컨텐츠/기능 id. */
function ancestorsOf(
  node: AppNode,
  byId: Map<string, AppNode>
): { contentId: string | null; featureId: string | null } {
  let contentId: string | null = null
  let featureId: string | null = null
  let cur: AppNode | null = node.parent_id
    ? (byId.get(node.parent_id) ?? null)
    : null
  while (cur) {
    if (cur.type === "기능") featureId = cur.id
    if (cur.type === "컨텐츠") contentId = cur.id
    cur = cur.parent_id ? (byId.get(cur.parent_id) ?? null) : null
  }
  return { contentId, featureId }
}

function BoardCard({ node }: { node: AppNode }) {
  const { getStatus, getMember } = useNodes()
  const { currentProject } = useProjects()
  const status = getStatus(node.status_id)
  const assignee = node.assignee_id ? getMember(node.assignee_id) : undefined
  const ticket = currentProject
    ? ticketKey(currentProject.key_prefix, node.ticket_number)
    : `#${node.ticket_number}`

  function onDragStart(e: DragEvent<HTMLDivElement>) {
    e.dataTransfer.setData("text/plain", node.id)
    e.dataTransfer.effectAllowed = "move"
  }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="flex cursor-grab flex-col gap-2 rounded-[10px] border bg-card p-2.5 shadow-xs active:cursor-grabbing"
      style={{ borderColor: "var(--c-line)" }}
      data-testid="board-card"
      data-task-id={node.id}
    >
      <div className="flex items-center gap-2">
        <code
          className="tnum font-mono text-[11px] font-semibold"
          style={{ color: "var(--c-plum)" }}
        >
          {ticket}
        </code>
        {status && (
          <span
            className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium"
            style={{ color: CATEGORY_TEXT_COLOR[status.category] }}
          >
            {(() => {
              const G = BLOOM_GLYPH[status.category]
              return (
                <G
                  className="size-3"
                  style={{
                    color: status.color ?? CATEGORY_COLOR[status.category],
                  }}
                />
              )
            })()}
          </span>
        )}
      </div>
      <div className="line-clamp-2 text-[13px] leading-snug">{node.title}</div>
      <div className="flex items-center gap-2">
        {node.domain && (
          <span
            className="rounded-md px-1.5 py-0.5 text-[10.5px] font-medium"
            style={{ background: "var(--c-pink-bg)", color: "var(--c-plum)" }}
          >
            {node.domain}
          </span>
        )}
        {assignee && (
          <span
            className="ml-auto inline-flex size-5 items-center justify-center rounded-full text-[10px] font-semibold text-white"
            style={{ background: "var(--c-sakura)" }}
            title={memberLabel(assignee)}
          >
            {memberLabel(assignee).slice(0, 1).toUpperCase()}
          </span>
        )}
      </div>
    </div>
  )
}

export function BoardView() {
  const { nodes, statuses, members, updateFields } = useNodes()
  const [fDomain, setFDomain] = useState("")
  const [fAssignee, setFAssignee] = useState("")
  const [fContent, setFContent] = useState("")
  const [fFeature, setFFeature] = useState("")

  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])
  const statusById = useMemo(
    () => new Map(statuses.map((s) => [s.id, s])),
    [statuses]
  )
  const contents = nodes.filter((n) => n.type === "컨텐츠")
  const features = nodes.filter((n) => n.type === "기능")

  const tasks = useMemo(() => {
    return nodes
      .filter((n) => n.type === "작업")
      .map((n) => ({ node: n, anc: ancestorsOf(n, byId) }))
      .filter(({ node, anc }) => {
        if (fDomain && node.domain !== fDomain) return false
        if (fAssignee && node.assignee_id !== fAssignee) return false
        if (fContent && anc.contentId !== fContent) return false
        if (fFeature && anc.featureId !== fFeature) return false
        return true
      })
      .map(({ node }) => node)
  }, [nodes, byId, fDomain, fAssignee, fContent, fFeature])

  function categoryOf(node: AppNode): StatusCategory | "미지정" {
    const s = node.status_id ? statusById.get(node.status_id) : undefined
    return s?.category ?? "미지정"
  }

  const hasUnassigned = tasks.some((t) => categoryOf(t) === "미지정")
  const columns: (StatusCategory | "미지정")[] = hasUnassigned
    ? ["미지정", ...CATEGORIES]
    : CATEGORIES

  async function onDropTo(
    e: DragEvent<HTMLDivElement>,
    col: StatusCategory | "미지정"
  ) {
    e.preventDefault()
    const id = e.dataTransfer.getData("text/plain")
    if (!id) return
    let statusId: string | null = null
    if (col !== "미지정") {
      const target = statuses
        .filter((s) => s.category === col)
        .sort((a, b) => a.sort_order - b.sort_order)[0]
      if (!target) return // 해당 카테고리에 상태 없음
      statusId = target.id
    }
    const node = byId.get(id)
    if (node && node.status_id !== statusId) {
      await updateFields(id, { status_id: statusId })
    }
  }

  return (
    <div className="flex h-full flex-col" data-testid="board-view">
      {/* 필터 */}
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
        <span className="text-muted-foreground text-xs">필터</span>
        <select
          className={selectClass}
          value={fContent}
          onChange={(e) => setFContent(e.target.value)}
          data-testid="board-filter-content"
        >
          <option value="">컨텐츠</option>
          {contents.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
        <select
          className={selectClass}
          value={fFeature}
          onChange={(e) => setFFeature(e.target.value)}
          data-testid="board-filter-feature"
        >
          <option value="">기능</option>
          {features.map((f) => (
            <option key={f.id} value={f.id}>
              {f.title}
            </option>
          ))}
        </select>
        <select
          className={selectClass}
          value={fDomain}
          onChange={(e) => setFDomain(e.target.value)}
          data-testid="board-filter-domain"
        >
          <option value="">도메인</option>
          {DOMAINS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select
          className={selectClass}
          value={fAssignee}
          onChange={(e) => setFAssignee(e.target.value)}
          data-testid="board-filter-assignee"
        >
          <option value="">담당자</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {memberLabel(m)}
            </option>
          ))}
        </select>
      </div>

      {/* 컬럼 */}
      <div className="flex flex-1 gap-3 overflow-x-auto p-4">
        {columns.map((col) => {
          const colTasks = tasks.filter((t) => categoryOf(t) === col)
          const accent =
            col === "미지정"
              ? "var(--c-ink-3)"
              : (CATEGORY_COLOR[col as StatusCategory] ?? "var(--c-ink-3)")
          return (
            <div
              key={col}
              className="flex w-72 shrink-0 flex-col rounded-[var(--radius-card)] border"
              style={{ background: "var(--c-bg-sunken)", borderColor: "var(--c-line)" }}
              data-testid="board-column"
              data-category={col}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => void onDropTo(e, col)}
            >
              <div className="flex items-center gap-2 px-3 py-2.5">
                <span
                  className="size-2.5 rounded-full"
                  style={{ background: accent }}
                />
                <span className="font-display text-sm font-bold">{col}</span>
                <span
                  className="tnum text-muted-foreground text-xs"
                  data-testid="board-column-count"
                >
                  {colTasks.length}
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
                {colTasks.map((t) => (
                  <BoardCard key={t.id} node={t} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
