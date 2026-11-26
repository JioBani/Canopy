import { supabase } from "@/lib/supabase"

export type StatusCategory = "할일" | "진행중" | "완료" | "취소됨"

export interface Status {
  id: string
  project_id: string
  name: string
  category: StatusCategory
  color: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

/** 카테고리 기본색 (design-system-v2 의미색). 새 상태 생성 시 기본값·차트용. 칩은 statusTone() 사용. */
export const CATEGORY_COLOR: Record<StatusCategory, string> = {
  할일: "#4B5563",
  진행중: "#1D5FD1",
  완료: "#16794A",
  취소됨: "#6B7280",
}

/** 프로젝트의 상태 목록 (카테고리 순서 → sort_order). */
export async function listStatuses(projectId: string): Promise<Status[]> {
  const { data, error } = await supabase
    .from("status")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as Status[]
}

export async function insertStatus(input: {
  project_id: string
  name: string
  category: StatusCategory
  color: string | null
  sort_order: number
}): Promise<Status> {
  const { data, error } = await supabase
    .from("status")
    .insert({ ...input, name: input.name.trim() })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return data as Status
}

export async function updateStatus(
  id: string,
  patch: Partial<Pick<Status, "name" | "color" | "sort_order">>
): Promise<void> {
  const { error } = await supabase.from("status").update(patch).eq("id", id)
  if (error) throw new Error(error.message)
}

export async function deleteStatus(id: string): Promise<void> {
  const { error } = await supabase.from("status").delete().eq("id", id)
  if (error) throw new Error(error.message)
}

/** 이 상태를 쓰는 노드 수 (삭제 가드용). */
export async function countNodesUsingStatus(statusId: string): Promise<number> {
  const { count, error } = await supabase
    .from("node")
    .select("id", { count: "exact", head: true })
    .eq("status_id", statusId)
  if (error) throw new Error(error.message)
  return count ?? 0
}

/** fromId 상태를 쓰는 노드들을 toId 로 옮긴다(노드 상태는 필수 — 0012). */
export async function reassignStatusNodes(
  fromId: string,
  toId: string
): Promise<void> {
  const { error } = await supabase
    .from("node")
    .update({ status_id: toId })
    .eq("status_id", fromId)
  if (error) throw new Error(error.message)
}

/**
 * 새 노드의 기본 상태 — DB default_todo_status_id 와 같은 규칙:
 * '할일' 분류 중 이름이 '할일'인 상태 우선, 없으면 sort_order 최소.
 */
export function defaultTodoStatus<T extends Pick<Status, "category" | "name" | "sort_order">>(
  statuses: T[]
): T | undefined {
  const todo = statuses.filter((s) => s.category === "할일")
  return (
    todo.find((s) => s.name === "할일") ??
    [...todo].sort((a, b) => a.sort_order - b.sort_order)[0]
  )
}
