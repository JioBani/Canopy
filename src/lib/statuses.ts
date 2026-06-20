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

/** 카테고리 기본색 (Pixel Blossom 개화 램프). status.color 없을 때 fallback. */
export const CATEGORY_COLOR: Record<StatusCategory, string> = {
  할일: "#ABA2A8", // mist
  진행중: "#EC9A78", // peach
  완료: "#E88AAB", // sakura
  취소됨: "#ABA2A8", // mist(흐림)
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

/** fromId 상태를 쓰는 노드들을 toId(또는 미지정=null)로 옮긴다. */
export async function reassignStatusNodes(
  fromId: string,
  toId: string | null
): Promise<void> {
  const { error } = await supabase
    .from("node")
    .update({ status_id: toId })
    .eq("status_id", fromId)
  if (error) throw new Error(error.message)
}
