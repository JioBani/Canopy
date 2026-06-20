import { supabase } from "@/lib/supabase"

export interface Member {
  id: string
  email: string | null
  display_name: string | null
  avatar_url: string | null
  /** 아바타 색(선택). */
  color: string | null
  created_at: string
  updated_at: string
}

/** 팀원 목록 (수동 관리). */
export async function listMembers(): Promise<Member[]> {
  const { data, error } = await supabase
    .from("member")
    .select("*")
    .order("created_at", { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as Member[]
}

/** 멤버 생성 (수동). id 는 DB 가 발급(gen_random_uuid). */
export async function insertMember(
  displayName: string,
  color?: string | null
): Promise<Member> {
  const { data, error } = await supabase
    .from("member")
    .insert({ display_name: displayName.trim(), color: color ?? null })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return data as Member
}

/** 멤버 수정 (이름/색). */
export async function updateMember(
  id: string,
  patch: { display_name?: string; color?: string | null }
): Promise<Member> {
  const { data, error } = await supabase
    .from("member")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return data as Member
}

/** 멤버 삭제. 담당 작업의 assignee_id 는 FK(ON DELETE SET NULL)로 자동 해제. */
export async function deleteMember(id: string): Promise<void> {
  const { error } = await supabase.from("member").delete().eq("id", id)
  if (error) throw new Error(error.message)
}

/** 표시명 (없으면 이메일, 그것도 없으면 id 축약). */
export function memberLabel(m: Member): string {
  return m.display_name || m.email || m.id.slice(0, 8)
}
