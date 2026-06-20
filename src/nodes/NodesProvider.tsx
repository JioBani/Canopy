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
import type { NodeType } from "@/nodes/nodeGrammar"

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
    title: string
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

export function NodesProvider({
  projectId,
  children,
}: {
  projectId: string
  children: ReactNode
}) {
  const [nodes, setNodes] = useState<AppNode[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [view, setView] = useState<"tree" | "board" | "dashboard">("tree")
  // 기본은 접힘(컴팩트). expanded 에 든 id 만 펼침.
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const openNode = useCallback((id: string) => {
    setSelectedId(id)
    setView("tree")
  }, [])
  const [statuses, setStatuses] = useState<Status[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [progress, setProgress] = useState<Map<string, NodeProgress>>(new Map())

  // 현재 노드 스냅샷 ref — refreshProgress 가 nodes 의존 없이(안정 identity) 전체 id 를
  // 읽게 해 reload→setNodes→refreshProgress 재생성→reload 무한루프를 막는다.
  const nodesRef = useRef<AppNode[]>([])
  useEffect(() => {
    nodesRef.current = nodes
  }, [nodes])

  // ── 브라우저 히스토리 연동 ───────────────────────────────────────────
  // 뷰/선택 노드를 history 에 쌓아 "뒤로가기"가 앱을 벗어나지 않고 이전 화면으로
  // 돌아가게 한다. popstate 로 인한 상태 복원 중엔 새 항목을 push 하지 않는다.
  const poppingRef = useRef(false)
  const firstNavRef = useRef(true)

  useEffect(() => {
    history.replaceState({ canopy: { view, selectedId } }, "")
    const onPop = (e: PopStateEvent) => {
      const s = (
        e.state as {
          canopy?: {
            view: "tree" | "board" | "dashboard"
            selectedId: string | null
          }
        } | null
      )?.canopy
      poppingRef.current = true
      setView(s?.view ?? "tree")
      setSelectedId(s?.selectedId ?? null)
      // 상태 반영(및 push 스킵) 후 플래그 해제(매크로태스크).
      setTimeout(() => {
        poppingRef.current = false
      }, 0)
    }
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
    // 마운트 1회만 (초기 항목 태깅 + 리스너 등록).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (firstNavRef.current) {
      firstNavRef.current = false
      return
    }
    if (poppingRef.current) return // 뒤로/앞으로 복원 중엔 push 안 함
    history.pushState({ canopy: { view, selectedId } }, "")
  }, [view, selectedId])

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

  const reload = useCallback(async () => {
    setLoading(true)
    const [list, statusList, memberList] = await Promise.all([
      listNodes(projectId),
      listStatuses(projectId),
      listMembers(),
    ])
    setNodes(list)
    setStatuses(statusList)
    setMembers(memberList)
    await refreshProgress(list.map((n) => n.id))
    setLoading(false)
  }, [projectId, refreshProgress])

  useEffect(() => {
    reload().catch((e) => {
      console.error("[nodes] 로드 실패:", e)
      setLoading(false)
    })
  }, [reload])

  const childrenOf = useCallback(
    (parentId: string | null) =>
      nodes.filter((n) => n.parent_id === parentId),
    [nodes]
  )

  const descendantCount = useCallback(
    (id: string): number => {
      let count = 0
      const stack = [id]
      while (stack.length) {
        const cur = stack.pop()!
        for (const n of nodes) {
          if (n.parent_id === cur) {
            count += 1
            stack.push(n.id)
          }
        }
      }
      return count
    },
    [nodes]
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
    async (parentId: string | null, type: NodeType, title: string) => {
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
      setSelectedId(created.id)
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
      setSelectedId((cur) => (cur && toRemove.has(cur) ? null : cur))
      await refreshProgress(remaining.map((n) => n.id))
    },
    [nodes, refreshProgress]
  )

  const value: NodesContextValue = useMemo(
    () => ({
      nodes,
      loading,
      reload,
      childrenOf,
      descendantCount,
      selectedId,
      select: setSelectedId,
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
      view,
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
