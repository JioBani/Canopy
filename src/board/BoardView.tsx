import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react"
import { Check, ClipboardList, Plus } from "lucide-react"
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { toast } from "sonner"
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
import { getPriority, PRIORITIES, withPriority, type Priority } from "@/lib/fields"
import { PriorityBadge, PriorityIcon } from "@/components/priority"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  BOARD_SORTS,
  getBoardRank,
  parseBoardSort,
  planReorder,
  sortCards,
  withBoardRank,
} from "@/board/boardOrder"
import { cn } from "@/lib/utils"
import { useQueryParam } from "@/lib/router"

const CATEGORIES: StatusCategory[] = ["할일", "진행중", "완료", "취소됨"]
type Column = StatusCategory | "미지정"
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

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e))
const stop = (e: { stopPropagation: () => void }) => e.stopPropagation()

/** 카드 위 우선순위 — 클릭하면 바로 고르는 메뉴(상세를 열지 않고, 드래그도 시작하지 않음). */
function CardPriority({ node }: { node: AppNode }) {
  const { updateFields } = useNodes()
  const priority = getPriority(node.fields)

  function pick(p: Priority | null) {
    if (p === priority) return
    updateFields(node.id, { fields: withPriority(node.fields, p) }).catch((e: unknown) =>
      toast.error("우선순위를 바꾸지 못했습니다", { description: errText(e) })
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onPointerDown={stop}
          onClick={stop}
          onKeyDown={stop}
          data-testid="board-card-priority"
          data-priority={priority ?? ""}
          title={priority ? `우선순위: ${priority} — 눌러서 변경` : "우선순위 지정"}
          className={cn(
            "focus-visible:ring-brand rounded-md outline-none focus-visible:ring-2",
            !priority &&
              "text-label text-fg-3 hover:text-fg-2 hover:bg-hover inline-flex items-center gap-1 px-1.5 py-0.5 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
          )}
        >
          {priority ? (
            <PriorityBadge priority={priority} />
          ) : (
            <>
              <Plus className="size-3.5" />
              우선순위
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="min-w-40"
        onClick={stop}
        onPointerDown={stop}
        data-testid="board-priority-menu"
      >
        {[...PRIORITIES].reverse().map((p) => (
          <DropdownMenuItem
            key={p}
            onSelect={() => pick(p)}
            data-testid="board-priority-option"
            data-value={p}
          >
            <PriorityIcon priority={p} />
            <span className="flex-1">{p}</span>
            {p === priority && <Check className="text-fg-2 size-4" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => pick(null)}
          data-testid="board-priority-option"
          data-value=""
        >
          <span className="border-fg-3 size-3.5 rounded-full border border-dashed" />
          <span className="flex-1">미지정</span>
          {!priority && <Check className="text-fg-2 size-4" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function CardBody({ node, overlay = false }: { node: AppNode; overlay?: boolean }) {
  const { getStatus, getMember } = useNodes()
  const status = getStatus(node.status_id)
  const assignee = node.assignee_id ? getMember(node.assignee_id) : undefined
  const priority = getPriority(node.fields)
  const ticket = ticketKey(node.type, node.ticket_number)
  return (
    <div
      className={cn(
        "border-line bg-surface hover:border-line-strong group flex flex-col gap-2 rounded-lg border p-3 transition-colors",
        overlay && "border-line-strong shadow-pop rotate-1"
      )}
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
      <div className="flex min-h-6 flex-wrap items-center gap-2">
        {overlay ? (
          priority && <PriorityBadge priority={priority} />
        ) : (
          <CardPriority node={node} />
        )}
        {node.domain && (
          <span className="text-label bg-sunken text-fg-2 rounded-md px-2 py-0.5">
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

/** 드래그 가능한 카드 — 마우스·터치(길게 누르기)·키보드(Space) 지원. 클릭/Enter = 상세 열기. */
function SortableCard({
  node,
  onOpen,
}: {
  node: AppNode
  onOpen: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: node.id })
  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(node.id)}
      onKeyDown={(e) => {
        listeners?.onKeyDown?.(e)
        if (e.key === "Enter" && !e.defaultPrevented) onOpen(node.id)
      }}
      aria-roledescription="보드 카드"
      className={cn(
        "focus-visible:ring-brand cursor-grab rounded-lg outline-none focus-visible:ring-2 active:cursor-grabbing",
        isDragging && "opacity-40"
      )}
      data-testid="board-card"
      data-task-id={node.id}
    >
      <CardBody node={node} />
    </div>
  )
}

/** 상태 열 — 빈 열에도 놓을 수 있게 droppable. 끌고 있는 카드가 위에 오면 테두리 강조. */
function BoardColumn({
  col,
  ids,
  header,
  children,
}: {
  col: Column
  ids: string[]
  header: ReactNode
  children: ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${col}` })
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "bg-sunken border-line rounded-card flex w-[300px] shrink-0 flex-col border transition-colors",
        isOver && "border-brand"
      )}
      data-testid="board-column"
      data-category={col}
    >
      {header}
      <SortableContext id={`col:${col}`} items={ids} strategy={verticalListSortingStrategy}>
        <div className="flex min-h-16 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
          {children}
        </div>
      </SortableContext>
    </div>
  )
}

export function BoardView() {
  const { nodes, statuses, members, updateFields, openNode } = useNodes()
  // 레이어·필터·정렬 = URL query (공유 가능, 변경은 replace)
  // ?layer=&domain=&assignee=&content=&feature=&priority=&sort=
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
  // 열 안 정렬 기준 — manual(기본, URL 생략) | priority | updated
  const [sortQ, setSortQ] = useQueryParam("sort")
  const sort = parseBoardSort(sortQ)

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

  function categoryOf(node: AppNode): Column {
    const s = node.status_id ? statusById.get(node.status_id) : undefined
    return s?.category ?? "미지정"
  }

  const hasUnassigned = cards.some((t) => categoryOf(t) === "미지정")
  const columns: Column[] = hasUnassigned ? ["미지정", ...CATEGORIES] : CATEGORIES

  // ── 드래그(dnd-kit) ─────────────────────────────────────────────
  // 열별 카드 id(정렬 반영). 드래그 중엔 미리보기 사본(dragItems)을 그리고, 놓으면 낙관 반영.
  const columnsMap = useMemo(() => {
    const m: Record<string, string[]> = {}
    for (const c of columns) m[c] = []
    for (const n of sortCards(cards, sort)) m[categoryOf(n)]?.push(n.id)
    return m
    // columns·categoryOf 는 cards·statusById 에서 파생
  }, [cards, sort, statusById])
  const [dragItems, setDragItems] = useState<Record<string, string[]> | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const lastDragEnd = useRef(0)
  const view = dragItems ?? columnsMap

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] },
    })
  )

  function colOf(items: Record<string, string[]>, id: string): Column | null {
    if (id.startsWith("col:")) return id.slice(4) as Column
    return (Object.keys(items).find((c) => items[c].includes(id)) as Column) ?? null
  }

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id))
    setDragItems(columnsMap)
  }

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over) return
    const aid = String(active.id)
    const oid = String(over.id)
    setDragItems((prev) => {
      const cur = prev ?? columnsMap
      const from = colOf(cur, aid)
      const to = colOf(cur, oid)
      if (!from || !to || from === to) return prev
      const toArr = [...cur[to]]
      const overIdx = oid.startsWith("col:") ? toArr.length : toArr.indexOf(oid)
      toArr.splice(overIdx < 0 ? toArr.length : overIdx, 0, aid)
      return { ...cur, [from]: cur[from].filter((x) => x !== aid), [to]: toArr }
    })
  }

  function onDragCancel() {
    setDragItems(null)
    setActiveId(null)
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    const cur = dragItems ?? columnsMap
    setDragItems(null)
    setActiveId(null)
    lastDragEnd.current = Date.now()
    if (!over) return
    const id = String(active.id)
    const col = colOf(cur, id)
    if (!col) return
    let ordered = cur[col]
    const oid = String(over.id)
    if (!oid.startsWith("col:") && oid !== id && ordered.includes(oid)) {
      ordered = arrayMove(ordered, ordered.indexOf(id), ordered.indexOf(oid))
    }
    void persistMove(id, col, ordered)
  }

  /** 놓은 결과 저장 — 열이 바뀌면 상태, 수동 정렬이면 board_rank. 낙관 반영 + 실패 시 원복·안내. */
  async function persistMove(id: string, col: Column, ordered: string[]) {
    const node = byId.get(id)
    if (!node) return
    const statusChanged = col !== categoryOf(node)
    const orderChanged = ordered.join() !== (columnsMap[col] ?? []).join()
    if (!statusChanged && !orderChanged) return

    let statusId: string | null = null
    if (statusChanged && col !== "미지정") {
      const target = statuses
        .filter((s) => s.category === col)
        .sort((a, b) => a.sort_order - b.sort_order)[0]
      if (!target) {
        toast.warning(`'${col}' 분류에 상태가 없습니다`, {
          description: "상태 설정에서 이 분류의 상태를 추가하세요.",
        })
        return
      }
      statusId = target.id
    }

    if (sort !== "manual" && !statusChanged) {
      toast.info("카드 순서는 정렬을 '수동 순서'로 두었을 때 바꿀 수 있습니다")
      return
    }
    const ranks =
      sort === "manual"
        ? planReorder(ordered, id, (x) => getBoardRank(byId.get(x)?.fields))
        : new Map<string, number>()

    const jobs: Promise<void>[] = []
    const movedPatch: Parameters<typeof updateFields>[1] = {}
    if (statusChanged) movedPatch.status_id = statusId
    const movedRank = ranks.get(id)
    if (movedRank !== undefined) movedPatch.fields = withBoardRank(node.fields, movedRank)
    if (Object.keys(movedPatch).length) jobs.push(updateFields(id, movedPatch))
    for (const [x, r] of ranks) {
      if (x === id) continue
      const n = byId.get(x)
      if (n) jobs.push(updateFields(x, { fields: withBoardRank(n.fields, r) }))
    }
    try {
      await Promise.all(jobs)
    } catch (e) {
      toast.error(statusChanged ? "상태를 바꾸지 못했습니다" : "순서를 바꾸지 못했습니다", {
        description: errText(e),
      })
    }
  }

  function openCard(id: string) {
    if (Date.now() - lastDragEnd.current < 300) return // 드래그 직후 클릭 무시
    openNode(id)
  }

  const activeNode = activeId ? byId.get(activeId) : undefined

  return (
    <div className="flex h-full flex-col" data-testid="board-view">
      {/* 레이어 선택 + 필터 + 정렬 */}
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
            items={[...PRIORITIES].reverse().map((p) => ({
              value: p,
              label: p,
              icon: <PriorityIcon priority={p} />,
            }))}
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
        {!isUrLayer && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-label text-fg-2">정렬</span>
            <FilterSelect
              value={sort === "manual" ? "" : sort}
              onChange={(v) => setSortQ(v || null)}
              allLabel={BOARD_SORTS[0].label}
              items={BOARD_SORTS.slice(1)}
              testid="board-sort"
            />
          </div>
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
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          onDragCancel={onDragCancel}
          accessibility={{
            screenReaderInstructions: {
              draggable:
                "Space 로 집고 화살표로 옮긴 뒤 Space 로 놓습니다. Esc 로 취소합니다. Enter 는 상세 열기.",
            },
          }}
        >
          <div className="flex flex-1 gap-3 overflow-x-auto p-4">
            {columns.map((col) => {
              const ids = view[col] ?? []
              const tone =
                col === "미지정" ? null : (CATEGORY_TONE[col] ?? null)
              const G = col === "미지정" ? null : BLOOM_GLYPH[col]
              return (
                <BoardColumn
                  key={col}
                  col={col}
                  ids={ids}
                  header={
                    <div className="flex items-center gap-2 px-3 py-3">
                      {G && tone ? (
                        <G className="size-4" style={{ color: tone.fg }} />
                      ) : (
                        <span className="border-fg-3 size-3.5 rounded-full border border-dashed" />
                      )}
                      <span className="text-subheading text-fg">{col}</span>
                      <Count data-testid="board-column-count">{ids.length}</Count>
                    </div>
                  }
                >
                  {ids.map((id) => {
                    const n = byId.get(id)
                    return n ? <SortableCard key={id} node={n} onOpen={openCard} /> : null
                  })}
                </BoardColumn>
              )
            })}
          </div>
          <DragOverlay dropAnimation={null}>
            {activeNode ? (
              <div className="w-[284px] cursor-grabbing">
                <CardBody node={activeNode} overlay />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  )
}
