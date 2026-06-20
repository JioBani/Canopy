import { supabase } from "@/lib/supabase"
import type { NodeType } from "@/nodes/nodeGrammar"

export type NodeDomain =
  | "기획"
  | "디자인"
  | "사운드"
  | "구현"
  | "밸런싱"
  | "기타"

export interface AppNode {
  id: string
  project_id: string
  parent_id: string | null
  type: NodeType
  ticket_number: number
  title: string
  body: string | null
  sort_order: number
  status_id: string | null
  domain: NodeDomain | null
  assignee_id: string | null
  created_at: string
  updated_at: string
}

/** 프로젝트의 모든 노드 (정렬: sort_order, 동률 시 생성순). */
export async function listNodes(projectId: string): Promise<AppNode[]> {
  const { data, error } = await supabase
    .from("node")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as AppNode[]
}

/** 노드 생성. ticket_number 는 DB 트리거가 발급. */
export async function insertNode(input: {
  project_id: string
  parent_id: string | null
  type: NodeType
  title: string
  sort_order?: number
}): Promise<AppNode> {
  const { data, error } = await supabase
    .from("node")
    .insert({
      project_id: input.project_id,
      parent_id: input.parent_id,
      type: input.type,
      title: input.title.trim(),
      sort_order: input.sort_order ?? 0,
    })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return data as AppNode
}

/** 제목/본문/상태/도메인/작업자 등 수정. */
export async function updateNode(
  id: string,
  patch: Partial<
    Pick<
      AppNode,
      "title" | "body" | "sort_order" | "status_id" | "domain" | "assignee_id"
    >
  >
): Promise<AppNode> {
  const { data, error } = await supabase
    .from("node")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return data as AppNode
}

/** 노드 삭제 (DB FK on delete cascade 로 하위 트리도 제거). */
export async function deleteNode(id: string): Promise<void> {
  const { error } = await supabase.from("node").delete().eq("id", id)
  if (error) throw new Error(error.message)
}

export interface NodeProgress {
  node_id: string
  total_tasks: number
  done_tasks: number
  /** 완료 비율(0~1). 하위 작업 0개면 null. */
  progress: number | null
}

/** node_progress 뷰에서 주어진 노드들의 roll-up 진행률을 조회. */
export async function listNodeProgress(
  nodeIds: string[]
): Promise<NodeProgress[]> {
  if (nodeIds.length === 0) return []
  const { data, error } = await supabase
    .from("node_progress")
    .select("node_id, total_tasks, done_tasks, progress")
    .in("node_id", nodeIds)
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => ({
    node_id: r.node_id as string,
    total_tasks: Number(r.total_tasks),
    done_tasks: Number(r.done_tasks),
    progress: r.progress === null ? null : Number(r.progress),
  }))
}
