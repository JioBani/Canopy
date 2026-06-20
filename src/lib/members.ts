import { supabase } from "@/lib/supabase"

export interface Member {
  id: string
  email: string | null
  display_name: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

/** 팀원 목록 (auth 동기화로 채워짐). */
export async function listMembers(): Promise<Member[]> {
  const { data, error } = await supabase
    .from("member")
    .select("*")
    .order("created_at", { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as Member[]
}

/** 표시명 (없으면 이메일, 그것도 없으면 id 축약). */
export function memberLabel(m: Member): string {
  return m.display_name || m.email || m.id.slice(0, 8)
}
