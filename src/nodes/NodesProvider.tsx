import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
import type { NodeType } from "@/nodes/nodeGrammar"

interface NodesContextValue {
  nodes: AppNode[]
  loading: boolean
  reload: () => Promise<void>
  childrenOf: (parentId: string | null) => AppNode[]
  descendantCount: (id: string) => number
  selectedId: string | null
  select: (id: string | null) => void
  isExpanded: (id: string) => boolean
  toggleCollapse: (id: string) => void
  createChild: (
    parentId: string | null,
    type: NodeType,
    title: string
  ) => Promise<AppNode>
  renameNode: (id: string, title: string) => Promise<void>
  removeNode: (id: string) => Promise<void>
  /** node_progress roll-up (없으면 undefined). */
  getProgress: (nodeId: string) => NodeProgress | undefined
  /** status_id → 상태 (없으면 undefined). */
  getStatus: (statusId: string | null) => Status | undefined
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
  // 기본은 펼침. collapsed 에 든 id 만 접힘.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [statuses, setStatuses] = useState<Status[]>([])
  const [progress, setProgress] = useState<Map<string, NodeProgress>>(new Map())

  /** 주어진(또는 현재) 노드들의 진행률을 뷰에서 다시 가져온다. loading 토글 없음. */
  const refreshProgress = useCallback(async (ids: string[]) => {
    const rows = await listNodeProgress(ids)
    setProgress(new Map(rows.map((r) => [r.node_id, r])))
  }, [])

  const reload = useCallback(async () => {
    setLoading(true)
    const [list, statusList] = await Promise.all([
      listNodes(projectId),
      listStatuses(projectId),
    ])
    setNodes(list)
    setStatuses(statusList)
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
    (id: string) => !collapsed.has(id),
    [collapsed]
  )

  const toggleCollapse = useCallback((id: string) => {
    setCollapsed((prev) => {
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
      const created = await insertNode({
        project_id: projectId,
        parent_id: parentId,
        type,
        title,
        sort_order: sortOrder,
      })
      const nextNodes = [...nodes, created]
      setNodes(nextNodes)
      if (parentId) {
        // 부모를 펼쳐 새 자식이 보이게.
        setCollapsed((prev) => {
          const next = new Set(prev)
          next.delete(parentId)
          return next
        })
      }
      setSelectedId(created.id)
      // 새 노드로 인해 조상 진행률이 바뀌므로 갱신.
      await refreshProgress(nextNodes.map((n) => n.id))
      return created
    },
    [nodes, projectId, refreshProgress]
  )

  const renameNode = useCallback(async (id: string, title: string) => {
    const updated = await updateNode(id, { title: title.trim() })
    setNodes((prev) => prev.map((n) => (n.id === id ? updated : n)))
  }, [])

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
      isExpanded,
      toggleCollapse,
      createChild,
      renameNode,
      removeNode,
      getProgress,
      getStatus,
    }),
    [
      nodes,
      loading,
      reload,
      childrenOf,
      descendantCount,
      selectedId,
      isExpanded,
      toggleCollapse,
      createChild,
      renameNode,
      removeNode,
      getProgress,
      getStatus,
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
