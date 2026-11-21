import { useEffect, useMemo, useState, type DragEvent } from "react"
import { ClipboardList } from "lucide-react"
import { useNodes } from "@/nodes/NodesProvider"
import { memberLabel } from "@/lib/members"
import { ticketKey, TYPE_META, type NodeType } from "@/nodes/nodeGrammar"
import { LAYER_COLOR } from "@/nodes/layerColors"
import { PIXEL_ICONS } from "@/nodes/pixelIcons"
import type { StatusCategory } from "@/lib/statuses"
import type { AppNode, NodeDomain } from "@/lib/nodes"
import { BLOOM_GLYPH } from "@/nodes/bloomGlyph"
import { CATEGORY_TONE, statusTone } from "@/lib/statusTone"
import { Count, TicketKey } from "@/components/ds"
import { FilterSelect } from "@/components/ui/filter-select"
import { listUrs, updateUr, type Ur, type UrStatus } from "@/lib/ur"
import { UrBoard } from "@/ur/UrBoard"
import { getPriority, PRIORITIES, PRIORITY_COLOR } from "@/lib/fields"
import { cn } from "@/lib/utils"
import { useQueryParam } from "@/lib/router"

const CATEGORIES: StatusCategory[] = ["할일", "진행중", "완료", "취소됨"]
/** 보드 레이어: 노드 타입 + 요구사항(UR, 노드 아님). */
type BoardLayer = NodeType | "요구사항"
/** 보드 레이어 선택지 (작업 기본, 마지막에 요구사항). */
const LAYERS: NodeType[] = ["작업", "세부기능", "기능", "컨텐츠", "마스터데이터"]
const LAYER_TABS: BoardLayer[] = [...LAYERS, "요구사항"]
const DOMAINS: NodeDomain[] = [
  "기획",
  "디자인",
  "사운드",
  "구현",
  "밸런싱",
  "기타",
]

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
  const { getStatus, getMember, openNode } = useNodes()
  const status = getStatus(node.status_id)
  const assignee = node.assignee_id ? getMember(node.assignee_id) : undefined
  const priority = getPriority(node.fields)
  const ticket = ticketKey(node.type, node.ticket_number)

  function onDragStart(e: DragEvent<HTMLDivElement>) {
    e.dataTransfer.setData("text/plain", node.id)
    e.dataTransfer.effectAllowed = "move"
  }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={() => openNode(node.id)}
      className="border-line bg-surface hover:border-line-strong flex cursor-grab flex-col gap-2 rounded-lg border p-3 transition-colors active:cursor-grabbing"
      data-testid="board-card"
      data-task-id={node.id}
    >
      <div className="flex items-center gap-2">
        <TicketKey value={ticket} />
        {status && (
          <span className="ml-auto inline-flex" title={status.name}>
            {(() => {
              const G = BLOOM_GLYPH[status.category]
              return <G className="size-4" style={{ color: statusTone(status).fg }} />
            })()}
          </span>
        )}
      </div>
      <div className="text-body text-fg line-clamp-3 font-medium">{node.title}</div>
      <div className="flex items-center gap-2">
        {priority && (
          <span
            className="text-label bg-sunken text-fg-2 inline-flex items-center gap-1.5 rounded-md px-2 py-0.5"
            data-testid="board-card-priority"
            data-priority={priority}
            title={`우선순위: ${priority}`}
          >
            <span
              className="size-2 rounded-full"
              style={{ background: PRIORITY_COLOR[priority] }}
            />
            {priority}
          </span>
        )}
        {node.domain && (
          <span
            className="text-label bg-sunken text-fg-2 rounded-md px-2 py-0.5"
          >
            {node.domain}
          </span>
        )}
        {assignee && (
          <span
            className="text-micro ml-auto inline-flex size-[22px] items-center justify-center rounded-full"
            style={{ background: assignee.color ?? "#F6D3E0", color: "#3B1D2A" }}
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
  const { nodes, statuses, members, updateFields, openNode } = useNodes()
  // 레이어·필터 = URL query (공유 가능, 변경은 replace) — ?layer=&domain=&assignee=&content=&feature=&priority=
  const [layerQ, setLayerQ] = useQueryParam("layer")
  const layer: BoardLayer = (LAYER_TABS as string[]).includes(layerQ)
    ? (layerQ as BoardLayer)
    : "작업"
  const setLayer = (l: BoardLayer) => setLayerQ(l === "작업" ? null : l)
  const [fDomain, setFDomain] = useQueryParam("domain")
  const [fAssignee, setFAssignee] = useQueryParam("assignee")
  const [fContent, setFContent] = useQueryParam("content")
  const [fFeature, setFFeature] = useQueryParam("feature")
  const [fPriority, setFPriority] = useQueryParam("priority")

  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])
  const statusById = useMemo(
    () => new Map(statuses.map((s) => [s.id, s])),
    [statuses]
  )
  const contents = nodes.filter((n) => n.type === "컨텐츠")
  const features = nodes.filter((n) => n.type === "기능")

  // 도메인/담당 필터는 작업 레이어에만 의미. 컨텐츠/기능 조상 필터는 그 조상이 있는 레이어만.
  const isTaskLayer = layer === "작업"
  const isUrLayer = layer === "요구사항"
  // UR 은 세부기능 소유 → 컨텐츠/기능 조상 있음. 컨텐츠 레이어만 컨텐츠 필터 숨김.
  const showContentFilter = layer !== "컨텐츠"
  const showFeatureFilter =
    isUrLayer ||
    layer === "작업" ||
    layer === "세부기능" ||
    layer === "마스터데이터"

  const cards = useMemo(() => {
    return nodes
      .filter((n) => n.type === layer)
      .map((n) => ({ node: n, anc: ancestorsOf(n, byId) }))
      .filter(({ node, anc }) => {
        if (showContentFilter && fContent && anc.contentId !== fContent)
          return false
        if (showFeatureFilter && fFeature && anc.featureId !== fFeature)
          return false
        if (isTaskLayer && fDomain && node.domain !== fDomain) return false
        if (isTaskLayer && fAssignee && node.assignee_id !== fAssignee)
          return false
        if (fPriority && getPriority(node.fields) !== fPriority) return false
        return true
      })
      .map(({ node }) => node)
  }, [
    nodes,
    byId,
    layer,
    isTaskLayer,
    showContentFilter,
    showFeatureFilter,
    fDomain,
    fAssignee,
    fContent,
    fFeature,
    fPriority,
  ])

  // ── 요구사항(UR) 레이어 ────────────────────────────────────────────
  // UR 은 노드가 아니라 세부기능 소유 별도 엔티티 → 보드 진입 시 별도 로드.
  const subFeatureIds = useMemo(
    () => nodes.filter((n) => n.type === "세부기능").map((n) => n.id),
    [nodes]
  )
  const [urs, setUrs] = useState<Ur[] | null>(null)

  useEffect(() => {
    if (!isUrLayer) return
    let alive = true
    setUrs(null)
    listUrs(subFeatureIds)
      .then((rows) => {
        if (alive) setUrs(rows)
      })
      .catch((e) => {
        console.error("[board] UR 로드 실패:", e)
        if (alive) setUrs([])
      })
    return () => {
      alive = false
    }
  }, [isUrLayer, subFeatureIds])

  // 컨텐츠/기능 필터를 소유 세부기능의 조상 기준으로 적용.
  const urCards = useMemo(() => {
    if (!urs) return []
    return urs.filter((u) => {
      const owner = byId.get(u.feature_id)
      if (!owner) return false
      const anc = ancestorsOf(owner, byId)
      if (fContent && anc.contentId !== fContent) return false
      if (fFeature && anc.featureId !== fFeature) return false
      return true
    })
  }, [urs, byId, fContent, fFeature])

  async function updateUrStatus(id: string, status: UrStatus) {
    setUrs((prev) =>
      prev ? prev.map((u) => (u.id === id ? { ...u, status } : u)) : prev
    )
    try {
      await updateUr(id, { status })
    } catch (e) {
      console.error("[board] UR 상태 변경 실패:", e)
      // 실패 시 서버 상태로 되돌림.
      listUrs(subFeatureIds)
        .then(setUrs)
        .catch(() => {})
    }
  }

  function categoryOf(node: AppNode): StatusCategory | "미지정" {
    const s = node.status_id ? statusById.get(node.status_id) : undefined
    return s?.category ?? "미지정"
  }

  const hasUnassigned = cards.some((t) => categoryOf(t) === "미지정")
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
      {/* 레이어 선택 + 필터 */}
      <div className="border-line bg-surface flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
        <span className="text-label text-fg-2 mr-1">레이어</span>
        <div
          className="bg-sunken flex flex-wrap items-center gap-0.5 rounded-lg p-[3px]"
          role="tablist"
        >
          {LAYER_TABS.map((l) => {
            const Icon = l === "요구사항" ? ClipboardList : PIXEL_ICONS[l]
            const color =
              l === "요구사항" ? "var(--ds-fg-2)" : LAYER_COLOR[l].base
            const label = l === "요구사항" ? "요구사항" : TYPE_META[l].label
            const active = layer === l
            return (
              <button
                key={l}
                type="button"
                onClick={() => setLayer(l)}
                aria-pressed={active}
                data-testid={`board-layer-${l}`}
                className={cn(
                  "text-body flex items-center gap-1.5 rounded-md px-2.5 py-1 font-semibold transition-colors",
                  active
                    ? "bg-surface text-fg ring-line ring-1"
                    : "text-fg-2 hover:text-fg"
                )}
              >
                <Icon className="size-4" style={{ color }} />
                {label}
              </button>
            )
          })}
        </div>

        <span className="bg-line mx-1 h-5 w-px" />
        <span className="text-label text-fg-2 mr-1">필터</span>
        {showContentFilter && (
          <FilterSelect
            value={fContent}
            onChange={setFContent}
            allLabel="컨텐츠"
            items={contents.map((c) => ({ value: c.id, label: c.title }))}
            testid="board-filter-content"
          />
        )}
        {showFeatureFilter && (
          <FilterSelect
            value={fFeature}
            onChange={setFFeature}
            allLabel="기능"
            items={features.map((f) => ({ value: f.id, label: f.title }))}
            testid="board-filter-feature"
          />
        )}
        {!isUrLayer && (
          <FilterSelect
            value={fPriority}
            onChange={setFPriority}
            allLabel="우선순위"
            items={PRIORITIES.map((p) => ({ value: p, label: p }))}
            testid="board-filter-priority"
          />
        )}
        {isTaskLayer && (
          <>
            <FilterSelect
              value={fDomain}
              onChange={setFDomain}
              allLabel="도메인"
              items={DOMAINS.map((d) => ({ value: d, label: d }))}
              testid="board-filter-domain"
            />
            <FilterSelect
              value={fAssignee}
              onChange={setFAssignee}
              allLabel="담당자"
              items={members.map((m) => ({ value: m.id, label: memberLabel(m) }))}
              testid="board-filter-assignee"
            />
          </>
        )}
      </div>

      {/* 컬럼 */}
      {isUrLayer ? (
        <UrBoard
          urs={urCards}
          loading={urs === null}
          byId={byId}
          onOpenOwner={openNode}
          onChangeStatus={updateUrStatus}
        />
      ) : (
      <div className="flex flex-1 gap-3 overflow-x-auto p-4">
        {columns.map((col) => {
          const colTasks = cards.filter((t) => categoryOf(t) === col)
          const tone =
            col === "미지정"
              ? null
              : (CATEGORY_TONE[col as StatusCategory] ?? null)
          const G = tone ? BLOOM_GLYPH[col as StatusCategory] : null
          return (
            <div
              key={col}
              className="bg-sunken border-line rounded-card flex w-[300px] shrink-0 flex-col border"
              data-testid="board-column"
              data-category={col}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => void onDropTo(e, col)}
            >
              <div className="flex items-center gap-2 px-3 py-3">
                {G && tone ? (
                  <G className="size-4" style={{ color: tone.fg }} />
                ) : (
                  <span className="border-fg-3 size-3.5 rounded-full border border-dashed" />
                )}
                <span className="text-subheading text-fg">{col}</span>
                <Count data-testid="board-column-count">{colTasks.length}</Count>
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
      )}
    </div>
  )
}
