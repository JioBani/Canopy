import { useEffect, useMemo, useState } from "react"
import { Search } from "lucide-react"
import { useNodes } from "@/nodes/NodesProvider"
import { useProjects } from "@/projects/ProjectProvider"
import { ticketKey } from "@/lib/validation"
import { memberLabel } from "@/lib/members"
import { NODE_TYPES, TYPE_META, type NodeType } from "@/nodes/nodeGrammar"
import type { AppNode, NodeDomain } from "@/lib/nodes"
import { PIXEL_ICONS } from "@/nodes/pixelIcons"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const DOMAINS: NodeDomain[] = [
  "기획",
  "디자인",
  "사운드",
  "구현",
  "밸런싱",
  "기타",
]
const selectClass =
  "h-8 rounded-[9px] border border-transparent bg-[#F5F2F4] px-2 text-xs outline-none hover:bg-[#EFE7EC] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"

function ancestorsOf(node: AppNode, byId: Map<string, AppNode>) {
  let contentId: string | null = null
  let featureId: string | null = null
  const path: string[] = []
  let cur: AppNode | null = node.parent_id
    ? (byId.get(node.parent_id) ?? null)
    : null
  while (cur) {
    path.unshift(cur.title)
    if (cur.type === "기능") featureId = cur.id
    if (cur.type === "컨텐츠") contentId = cur.id
    cur = cur.parent_id ? (byId.get(cur.parent_id) ?? null) : null
  }
  return { contentId, featureId, path }
}

function SearchBody({ onClose }: { onClose: () => void }) {
  const { nodes, statuses, members, getStatus, openNode } = useNodes()
  const { currentProject } = useProjects()
  const [q, setQ] = useState("")
  const [fType, setFType] = useState("")
  const [fStatus, setFStatus] = useState("")
  const [fDomain, setFDomain] = useState("")
  const [fAssignee, setFAssignee] = useState("")
  const [fContent, setFContent] = useState("")

  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])
  const contents = nodes.filter((n) => n.type === "컨텐츠")
  const prefix = currentProject?.key_prefix ?? ""

  const results = useMemo(() => {
    const text = q.trim().toLowerCase()
    return nodes
      .map((n) => ({ n, anc: ancestorsOf(n, byId) }))
      .filter(({ n, anc }) => {
        if (fType && n.type !== fType) return false
        if (fStatus && n.status_id !== fStatus) return false
        if (fDomain && n.domain !== fDomain) return false
        if (fAssignee && n.assignee_id !== fAssignee) return false
        if (fContent && anc.contentId !== fContent) return false
        if (text) {
          const key = ticketKey(prefix, n.ticket_number).toLowerCase()
          const hay = `${n.title} ${n.body ?? ""} ${key}`.toLowerCase()
          if (!hay.includes(text)) return false
        }
        return true
      })
      .slice(0, 50)
  }, [nodes, byId, q, fType, fStatus, fDomain, fAssignee, fContent, prefix])

  return (
    <div className="flex flex-col gap-3">
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="제목·설명·티켓키 검색…"
        className="h-10 rounded-[10px] border bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
        data-testid="search-input"
      />
      <div className="flex flex-wrap gap-2">
        <select
          className={selectClass}
          value={fType}
          onChange={(e) => setFType(e.target.value)}
          data-testid="search-type"
        >
          <option value="">타입</option>
          {NODE_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          className={selectClass}
          value={fStatus}
          onChange={(e) => setFStatus(e.target.value)}
          data-testid="search-status"
        >
          <option value="">상태</option>
          {statuses.map((s) => (
            <option key={s.id} value={s.id}>
              {s.category} / {s.name}
            </option>
          ))}
        </select>
        <select
          className={selectClass}
          value={fDomain}
          onChange={(e) => setFDomain(e.target.value)}
          data-testid="search-domain"
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
          data-testid="search-assignee"
        >
          <option value="">담당자</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {memberLabel(m)}
            </option>
          ))}
        </select>
        <select
          className={selectClass}
          value={fContent}
          onChange={(e) => setFContent(e.target.value)}
          data-testid="search-content"
        >
          <option value="">컨텐츠</option>
          {contents.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </div>

      <div
        className="flex max-h-[50vh] flex-col gap-0.5 overflow-y-auto"
        data-testid="search-results"
      >
        {results.length === 0 ? (
          <p className="text-muted-foreground px-1 py-6 text-center text-sm">
            결과가 없습니다.
          </p>
        ) : (
          results.map(({ n, anc }) => {
            const Icon = PIXEL_ICONS[n.type as NodeType]
            const status = getStatus(n.status_id)
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => {
                  openNode(n.id)
                  onClose()
                }}
                data-testid="search-result"
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-[var(--c-pink-bg)]"
              >
                <Icon
                  className="size-4 shrink-0"
                  style={{
                    color:
                      n.type === "컨텐츠"
                        ? "var(--c-sakura)"
                        : "var(--c-ink-3)",
                  }}
                />
                <code
                  className="tnum shrink-0 font-mono text-[11px] font-semibold"
                  style={{ color: "var(--c-plum)" }}
                >
                  {ticketKey(prefix, n.ticket_number)}
                </code>
                <span className="flex-1 truncate text-[13px]">{n.title}</span>
                {anc.path.length > 0 && (
                  <span className="text-muted-foreground hidden truncate text-[11px] sm:block">
                    {anc.path.join(" / ")}
                  </span>
                )}
                <span
                  className="text-muted-foreground shrink-0 text-[10.5px]"
                  style={{ color: "var(--c-ink-3)" }}
                >
                  {TYPE_META[n.type as NodeType].label}
                  {status ? ` · ${status.name}` : ""}
                </span>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}

export function SearchButton() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="search-open"
        className="text-muted-foreground border-border flex h-8 w-[200px] items-center gap-2 rounded-lg border bg-[var(--c-bg-sunken)] px-2.5 text-[13px] transition-colors hover:bg-[#EFE7EC]"
      >
        <Search className="size-3.5 shrink-0" />
        <span className="flex-1 text-left">검색</span>
        <kbd className="tnum rounded bg-card px-1.5 py-0.5 text-[10px] font-medium shadow-xs">
          ⌘K
        </kbd>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          data-testid="search-dialog"
          className="top-[12%] translate-y-0 sm:max-w-2xl"
        >
          <DialogHeader>
            <DialogTitle>검색</DialogTitle>
          </DialogHeader>
          <SearchBody onClose={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  )
}
