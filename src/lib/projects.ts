import { supabase } from "@/lib/supabase"

export interface Project {
  id: string
  name: string
  key_prefix: string
  ticket_seq: number
  created_at: string
  updated_at: string
}

/** 프로젝트 목록 (생성순). */
export async function listProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from("project")
    .select("*")
    .order("created_at", { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as Project[]
}

/**
 * 프로젝트 생성. 기본 상태 4종은 DB 트리거가 시드하므로 프론트에서 추가하지 않는다.
 * 호출 전 name/key_prefix 는 검증/정규화되어 있어야 한다 (lib/validation).
 */
export async function insertProject(
  name: string,
  keyPrefix: string
): Promise<Project> {
  const { data, error } = await supabase
    .from("project")
    .insert({ name: name.trim(), key_prefix: keyPrefix })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return data as Project
}
