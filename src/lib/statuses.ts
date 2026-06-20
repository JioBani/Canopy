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

/** 카테고리 기본색 (기획서 §10). status.color 없을 때 fallback. */
export const CATEGORY_COLOR: Record<StatusCategory, string> = {
  할일: "#6b7280", // 회색
  진행중: "#3b82f6", // 파랑
  완료: "#22c55e", // 초록
  취소됨: "#ef4444", // 빨강(흐림 처리는 UI 에서)
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
