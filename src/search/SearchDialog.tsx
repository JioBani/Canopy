import { useEffect, useMemo, useState } from "react"
import { Search } from "lucide-react"
import { useNodes } from "@/nodes/NodesProvider"
import { memberLabel } from "@/lib/members"
import {
  NODE_TYPES,
  TYPE_META,
  ticketKey,
  type NodeType,
} from "@/nodes/nodeGrammar"
import type { AppNode, NodeDomain } from "@/lib/nodes"
import { PIXEL_ICONS } from "@/nodes/pixelIcons"
import { LAYER_COLOR } from "@/nodes/layerColors"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FilterSelect } from "@/components/ui/filter-select"

const DOMAINS: NodeDomain[] = [
  "기획",
  "디자인",
  "사운드",
  "구현",
  "밸런싱",
  "기타",
]

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
  const [q, setQ] = useState("")
  const [fType, setFType] = useState("")
  const [fStatus, setFStatus] = useState("")
  const [fDomain, setFDomain] = useState("")
  const [fAssignee, setFAssignee] = useState("")
  const [fContent, setFContent] = useState("")

  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])
  const contents = nodes.filter((n) => n.type === "컨텐츠")

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
          const key = ticketKey(n.type, n.ticket_number).toLowerCase()
          const hay = `${n.title} ${n.body ?? ""} ${key}`.toLowerCase()
          if (!hay.includes(text)) return false
        }
        return true
      })
      .slice(0, 50)
  }, [nodes, byId, q, fType, fStatus, fDomain, fAssignee, fContent])

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="제목·설명·티켓키 검색…"
        className="border-border h-10 w-full rounded-[10px] border bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
        data-testid="search-input"
      />
      <div className="flex flex-wrap gap-2">
        <FilterSelect
          value={fType}
          onChange={setFType}
          allLabel="타입"
          items={NODE_TYPES.map((t) => ({ value: t, label: t }))}
          testid="search-type"
        />
        <FilterSelect
          value={fStatus}
          onChange={setFStatus}
          allLabel="상태"
          items={statuses.map((s) => ({
            value: s.id,
            label: `${s.category} / ${s.name}`,
          }))}
          testid="search-status"
        />
        <FilterSelect
          value={fDomain}
          onChange={setFDomain}
          allLabel="도메인"
          items={DOMAINS.map((d) => ({ value: d, label: d }))}
          testid="search-domain"
        />
        <FilterSelect
          value={fAssignee}
          onChange={setFAssignee}
          allLabel="담당자"
          items={members.map((m) => ({ value: m.id, label: memberLabel(m) }))}
          testid="search-assignee"
        />
        <FilterSelect
          value={fContent}
          onChange={setFContent}
          allLabel="컨텐츠"
          items={contents.map((c) => ({ value: c.id, label: c.title }))}
          testid="search-content"
        />
      </div>

      <div
        className="flex max-h-[50vh] min-w-0 flex-col gap-0.5 overflow-x-hidden overflow-y-auto"
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
                className="flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-[var(--c-pink-bg)]"
              >
                <Icon
                  className="size-4 shrink-0"
                  style={{ color: LAYER_COLOR[n.type as NodeType].base }}
                />
                <code
                  className="tnum shrink-0 font-mono text-[11px] font-semibold"
                  style={{ color: "var(--c-plum)" }}
                >
                  {ticketKey(n.type, n.ticket_number)}
                </code>
                <span className="min-w-0 flex-1 truncate text-[13px]">
                  {n.title}
                </span>
                {anc.path.length > 0 && (
                  <span className="text-muted-foreground hidden max-w-[35%] shrink-0 truncate text-[11px] sm:block">
                    {anc.path.join(" / ")}
                  </span>
                )}
                <span
                  className="shrink-0 text-[10.5px] whitespace-nowrap"
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
        className="text-muted-foreground border-border flex h-8 w-9 items-center justify-center gap-2 rounded-lg border bg-[var(--c-bg-sunken)] text-[13px] transition-colors hover:bg-[#EFE7EC] sm:w-[200px] sm:justify-start sm:px-2.5"
      >
        <Search className="size-3.5 shrink-0" />
        <span className="hidden flex-1 text-left sm:block">검색</span>
        <kbd className="tnum hidden rounded bg-card px-1.5 py-0.5 text-[10px] font-medium shadow-xs sm:inline-block">
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
