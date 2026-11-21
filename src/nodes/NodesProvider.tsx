import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import {
  deleteNode,
  insertNode,
  listNodeProgress,
  listNodes,
  updateNode,
  type AppNode,
  type NodeProgress,
} from "@/lib/nodes"
import { listStatuses, type Status } from "@/lib/statuses"
import { listMembers, type Member } from "@/lib/members"
import { ticketKey, TICKET_PREFIX, type NodeType } from "@/nodes/nodeGrammar"
import { toast } from "sonner"
import { buildPath, navigate, parseRoute, useUrl, type AppView } from "@/lib/router"

interface NodesContextValue {
  nodes: AppNode[]
  loading: boolean
  reload: () => Promise<void>
  childrenOf: (parentId: string | null) => AppNode[]
  descendantCount: (id: string) => number
  selectedId: string | null
  select: (id: string | null) => void
  /** 워크스페이스 뷰(트리/보드) — 카드·검색 점프가 트리로 전환할 수 있게 공유. */
  view: "tree" | "board" | "dashboard"
  setView: (v: "tree" | "board" | "dashboard") => void
  /** 노드로 점프: 선택 + 트리뷰 전환 (보드 카드·검색 결과용). */
  openNode: (id: string) => void
  isExpanded: (id: string) => boolean
  toggleCollapse: (id: string) => void
  createChild: (
    parentId: string | null,
    type: NodeType,
    title: string,
    /** select=false 면 생성 후 현재 화면에 머문다(예: UR 아래 "+ 작업"). 기본 true. */
    opts?: { select?: boolean }
  ) => Promise<AppNode>
  renameNode: (id: string, title: string) => Promise<void>
  removeNode: (id: string) => Promise<void>
  /** 노드 필드 부분 수정 (상태 변경 시 진행률 자동 갱신). */
  updateFields: (
    id: string,
    patch: Partial<
      Pick<
        AppNode,
        | "title"
        | "body"
        | "status_id"
        | "domain"
        | "assignee_id"
        | "time_spent_minutes"
        | "fields"
      >
    >
  ) => Promise<void>
  /** node_progress roll-up (없으면 undefined). */
  getProgress: (nodeId: string) => NodeProgress | undefined
  /** 진행률 재조회(생략 시 전체). UR 변경 등 외부 요인 반영용. */
  refreshProgress: (ids?: string[]) => Promise<void>
  /** 멤버 목록 재조회(멤버 수동 관리 후 반영). */
  refreshMembers: () => Promise<void>
  /** status_id → 상태 (없으면 undefined). */
  getStatus: (statusId: string | null) => Status | undefined
  /** member_id → 멤버 (없으면 undefined). */
  getMember: (memberId: string | null) => Member | undefined
  statuses: Status[]
  members: Member[]
}

const NodesContext = createContext<NodesContextValue | undefined>(undefined)

type View = AppView

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PREFIX_TO_TYPE = Object.fromEntries(
  Object.entries(TICKET_PREFIX).map(([t, p]) => [p.toLowerCase(), t as NodeType])
)

/** URL 의 nodeRef(티켓키 "Task-4" 또는 uuid) → 노드. */
function resolveNodeRef(ref: string, nodes: AppNode[]): AppNode | undefined {
  if (UUID_RE.test(ref)) return nodes.find((n) => n.id === ref)
  const m = /^([A-Za-z]+)-(\d+)$/.exec(ref)
  if (!m) return undefined
  const type = PREFIX_TO_TYPE[m[1].toLowerCase()]
  const num = Number(m[2])
  return nodes.find((n) => n.type === type && n.ticket_number === num)
}

/** 노드 → URL 용 참조(티켓키). */
export function nodeRefOf(n: AppNode): string {
  return ticketKey(n.type, n.ticket_number)
}

export function NodesProvider({
  projectId,
  children,
}: {
  projectId: string
  children: ReactNode
}) {
  const [nodes, setNodes] = useState<AppNode[]>([])
  const [loading, setLoading] = useState(true)
  // ── 화면/선택 = URL 이 정본 (src/lib/router.ts) ─────────────────────────
  const { pathname } = useUrl()
  const route = parseRoute(pathname)
  const view: View = route.view
  const nodeRef = route.nodeRef
  const selectedNode = useMemo(
    () => (nodeRef ? resolveNodeRef(nodeRef, nodes) : undefined),
    [nodeRef, nodes]
  )
  const selectedId = selectedNode?.id ?? null
  // 보드/대시보드에 갔다가 트리로 돌아올 때 마지막 선택을 복원하기 위한 기억.
  const lastTreeRefRef = useRef<string | null>(nodeRef)
  useEffect(() => {
    if (view === "tree") lastTreeRefRef.current = nodeRef
  }, [view, nodeRef])

  // 기본은 접힘(컴팩트). expanded 에 든 id 만 펼침.
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const nodesForNavRef = useRef<AppNode[]>([])
  useEffect(() => {
    nodesForNavRef.current = nodes
  }, [nodes])

  /** 트리에서 노드 선택(null = 선택 해제) — history push. */
  const select = useCallback(
    (id: string | null) => {
      const n = id ? nodesForNavRef.current.find((x) => x.id === id) : undefined
      navigate(buildPath(projectId, "tree", n ? nodeRefOf(n) : null))
    },
    [projectId]
  )
  const setView = useCallback(
    (v: View) => {
      navigate(buildPath(projectId, v, v === "tree" ? lastTreeRefRef.current : null))
    },
    [projectId]
  )
  const openNode = select
  const [statuses, setStatuses] = useState<Status[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [progress, setProgress] = useState<Map<string, NodeProgress>>(new Map())

  // 현재 노드 스냅샷 ref — refreshProgress 가 nodes 의존 없이(안정 identity) 전체 id 를
  // 읽게 해 reload→setNodes→refreshProgress 재생성→reload 무한루프를 막는다.
  const nodesRef = useRef<AppNode[]>([])
  useEffect(() => {
    nodesRef.current = nodes
  }, [nodes])

  // ── 딥링크 정합 ────────────────────────────────────────────────────
  // 1) 링크의 노드를 찾으면 조상을 펼쳐 트리에서 보이게(최초 1회/노드 변경 시).
  // 2) 못 찾으면(삭제·오타) 안내 후 트리 루트로 replace.
  const revealedRef = useRef<string | null>(null)
  useEffect(() => {
    if (loading || !nodeRef || view !== "tree") return
    if (!selectedNode) {
      toast.warning(`링크의 항목(${nodeRef})을 찾을 수 없습니다`, {
        description: "삭제되었거나 다른 프로젝트의 항목입니다. 트리로 이동했습니다.",
      })
      navigate(buildPath(projectId, "tree"), { replace: true })
      return
    }
    if (revealedRef.current === selectedNode.id) return
    revealedRef.current = selectedNode.id
    const ancestors: string[] = []
    let cur = selectedNode.parent_id
    while (cur) {
      ancestors.push(cur)
      cur = nodes.find((n) => n.id === cur)?.parent_id ?? null
    }
    if (ancestors.length) {
      setExpanded((prev) => {
        if (ancestors.every((a) => prev.has(a))) return prev
        const next = new Set(prev)
        ancestors.forEach((a) => next.add(a))
        return next
      })
    }
  }, [loading, nodeRef, selectedNode, view, nodes, projectId])

  /** 주어진(생략 시 현재 전체) 노드들의 진행률을 뷰에서 다시 가져온다. loading 토글 없음. */
  const refreshProgress = useCallback(async (ids?: string[]) => {
    const target = ids ?? nodesRef.current.map((n) => n.id)
    const rows = await listNodeProgress(target)
    setProgress(new Map(rows.map((r) => [r.node_id, r])))
  }, [])

  /** 멤버 목록 재조회(멤버 수동 관리 후 담당자 셀렉트 반영용). */
  const refreshMembers = useCallback(async () => {
    setMembers(await listMembers())
  }, [])

  /** 노드/상태/멤버/진행도를 서버에서 다시 가져온다. loading 토글 없음(백그라운드 최신화용). */
  const refresh = useCallback(async () => {
    const [list, statusList, memberList] = await Promise.all([
      listNodes(projectId),
      listStatuses(projectId),
      listMembers(),
    ])
    setNodes(list)
    setStatuses(statusList)
    setMembers(memberList)
    // 진행도(재귀 뷰)는 비차단으로 뒤따라 채운다.
    void refreshProgress(list.map((n) => n.id)).catch((e) =>
      console.error("[nodes] 진행도 로드 실패:", e)
    )
  }, [projectId, refreshProgress])

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      await refresh()
    } finally {
      setLoading(false) // 트리 즉시 렌더 — 진행도는 refresh 내부에서 비차단으로 뒤따른다
    }
  }, [refresh])

  useEffect(() => {
    reload().catch((e) => {
      console.error("[nodes] 로드 실패:", e)
      setLoading(false)
    })
  }, [reload])

  // ── 뷰 전환·창 포커스 시 백그라운드 최신화 ─────────────────────────────
  // 외부(다른 멤버/CLI/다른 탭)의 변경이 뷰 이동·복귀 시 보이도록 조용히 재조회한다.
  // (nodes 참조가 갱신되면 보드/대시보드의 UR 조회 이펙트도 파생 배열을 통해 연쇄 재조회됨.)
  const prevViewRef = useRef<View>(view)
  useEffect(() => {
    // 최초 마운트(위 reload 가 처리) 및 projectId 변경으로 인한 refresh 재생성 시엔 스킵 — 실제 뷰 전환만.
    if (prevViewRef.current === view) return
    prevViewRef.current = view
    void refresh().catch((e) => console.error("[nodes] 뷰 전환 최신화 실패:", e))
  }, [view, refresh])

  useEffect(() => {
    const onFocus = () =>
      void refresh().catch((e) => console.error("[nodes] 포커스 최신화 실패:", e))
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [refresh])

  // parent_id → 자식 목록 맵(한 번 계산) — childrenOf/descendantCount 가 매 호출 전체
  // 필터링하던 O(n²) 트리 렌더 비용을 제거.
  const childrenMap = useMemo(() => {
    const m = new Map<string | null, AppNode[]>()
    for (const n of nodes) {
      const arr = m.get(n.parent_id)
      if (arr) arr.push(n)
      else m.set(n.parent_id, [n])
    }
    return m
  }, [nodes])

  const childrenOf = useCallback(
    (parentId: string | null) => childrenMap.get(parentId) ?? [],
    [childrenMap]
  )

  const descendantCount = useCallback(
    (id: string): number => {
      let count = 0
      const stack = [id]
      while (stack.length) {
        const kids = childrenMap.get(stack.pop()!)
        if (!kids) continue
        count += kids.length
        for (const k of kids) stack.push(k.id)
      }
      return count
    },
    [childrenMap]
  )

  const isExpanded = useCallback(
    (id: string) => expanded.has(id),
    [expanded]
  )

  const toggleCollapse = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const createChild = useCallback(
    async (
      parentId: string | null,
      type: NodeType,
      title: string,
      opts: { select?: boolean } = {}
    ) => {
      const siblings = nodes.filter((n) => n.parent_id === parentId)
      const sortOrder =
        siblings.reduce((m, s) => Math.max(m, s.sort_order), -1) + 1
      // 기본 상태 = 할일 카테고리 기본(가장 앞) 상태 (Jira식 To Do 시작, 전 타입).
      const defaultStatus = statuses
        .filter((s) => s.category === "할일")
        .sort((a, b) => a.sort_order - b.sort_order)[0]
      const created = await insertNode({
        project_id: projectId,
        parent_id: parentId,
        type,
        title,
        sort_order: sortOrder,
        status_id: defaultStatus?.id ?? null,
      })
      const nextNodes = [...nodes, created]
      setNodes(nextNodes)
      if (parentId) {
        // 부모를 펼쳐 새 자식이 보이게.
        setExpanded((prev) => {
          const next = new Set(prev)
          next.add(parentId)
          return next
        })
      }
      nodesForNavRef.current = nextNodes
      if (opts.select !== false) navigate(buildPath(projectId, "tree", nodeRefOf(created)))
      // 새 노드로 인해 조상 진행률이 바뀌므로 갱신.
      await refreshProgress(nextNodes.map((n) => n.id))
      return created
    },
    [nodes, projectId, refreshProgress, statuses]
  )

  const renameNode = useCallback(async (id: string, title: string) => {
    const updated = await updateNode(id, { title: title.trim() })
    setNodes((prev) => prev.map((n) => (n.id === id ? updated : n)))
  }, [])

  const updateFields = useCallback<NodesContextValue["updateFields"]>(
    async (id, patch) => {
      const updated = await updateNode(id, patch)
      const next = nodes.map((n) => (n.id === id ? updated : n))
      setNodes(next)
      // 상태 변경은 조상 진행률에 영향 → 즉시 갱신(가시성 핵심).
      if ("status_id" in patch) {
        await refreshProgress(next.map((n) => n.id))
      }
    },
    [nodes, refreshProgress]
  )

  const statusById = useMemo(
    () => new Map(statuses.map((s) => [s.id, s])),
    [statuses]
  )

  const getProgress = useCallback(
    (nodeId: string) => progress.get(nodeId),
    [progress]
  )

  const getStatus = useCallback(
    (statusId: string | null) =>
      statusId ? statusById.get(statusId) : undefined,
    [statusById]
  )

  const memberById = useMemo(
    () => new Map(members.map((m) => [m.id, m])),
    [members]
  )
  const getMember = useCallback(
    (memberId: string | null) =>
      memberId ? memberById.get(memberId) : undefined,
    [memberById]
  )

  const removeNode = useCallback(
    async (id: string) => {
      await deleteNode(id)
      // 삭제된 노드 + 하위 트리를 로컬 상태에서 제거.
      const toRemove = new Set<string>([id])
      let grew = true
      while (grew) {
        grew = false
        for (const n of nodes) {
          if (n.parent_id && toRemove.has(n.parent_id) && !toRemove.has(n.id)) {
            toRemove.add(n.id)
            grew = true
          }
        }
      }
      const remaining = nodes.filter((n) => !toRemove.has(n.id))
      setNodes(remaining)
      if (selectedId && toRemove.has(selectedId)) {
        const parent = remaining.find((n) => n.id === nodes.find((x) => x.id === id)?.parent_id)
        navigate(buildPath(projectId, "tree", parent ? nodeRefOf(parent) : null), { replace: true })
      }
      await refreshProgress(remaining.map((n) => n.id))
    },
    [nodes, refreshProgress, selectedId, projectId]
  )

  const value: NodesContextValue = useMemo(
    () => ({
      nodes,
      loading,
      reload,
      childrenOf,
      descendantCount,
      selectedId,
      select,
      view,
      setView,
      openNode,
      isExpanded,
      toggleCollapse,
      createChild,
      renameNode,
      removeNode,
      updateFields,
      getProgress,
      refreshProgress,
      refreshMembers,
      getStatus,
      getMember,
      statuses,
      members,
    }),
    [
      nodes,
      loading,
      reload,
      childrenOf,
      descendantCount,
      selectedId,
      select,
      view,
      setView,
      openNode,
      isExpanded,
      toggleCollapse,
      createChild,
      renameNode,
      removeNode,
      updateFields,
      getProgress,
      refreshProgress,
      refreshMembers,
      getStatus,
      getMember,
      statuses,
      members,
    ]
  )

  return <NodesContext.Provider value={value}>{children}</NodesContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useNodes() {
  const ctx = useContext(NodesContext)
  if (!ctx) {
    throw new Error("useNodes 는 <NodesProvider> 내부에서만 사용할 수 있습니다.")
  }
  return ctx
}
