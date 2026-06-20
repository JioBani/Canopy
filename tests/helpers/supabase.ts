import { createClient, type SupabaseClient } from "@supabase/supabase-js"

/**
 * 백엔드 E2E 는 로컬 Supabase(supabase start) 를 대상으로 한다.
 * 아래 키는 로컬 전용 공개 데모 키 (실 프로젝트와 무관, 커밋 안전).
 * 포트는 config.toml 에서 546xx 로 remap 했다 (Windows 예약 포트 회피).
 */
export const LOCAL_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54621"

export const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"

export const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"

/** 익명(비로그인) 클라이언트 — RLS 거부 검증용. */
export function anonClient(): SupabaseClient {
  return createClient(LOCAL_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** service_role 클라이언트 — RLS 우회. 셋업/정리/관리 작업용. */
export function adminClient(): SupabaseClient {
  return createClient(LOCAL_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

let userSeq = 0

/**
 * 새 테스트 유저를 만들고 그 유저로 인증된 클라이언트를 돌려준다.
 * (이메일 확인 off 전제 → signUp 즉시 세션)
 */
export async function authedClient(): Promise<{
  client: SupabaseClient
  userId: string
  email: string
}> {
  userSeq += 1
  const email = `test_${process.pid}_${userSeq}_${Math.floor(
    performance.now()
  )}@example.com`
  const password = "password123"

  const client = createClient(LOCAL_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await client.auth.signUp({ email, password })
  if (error) throw new Error(`테스트 유저 생성 실패: ${error.message}`)
  const userId = data.user?.id
  if (!userId) throw new Error("테스트 유저 id 없음")
  return { client, userId, email }
}

/** 프로젝트 생성 (admin). 기본상태 자동시드 트리거가 함께 돈다. */
export async function createProject(
  admin: SupabaseClient,
  name = "테스트 프로젝트",
  keyPrefix = "TP"
): Promise<string> {
  const { data, error } = await admin
    .from("project")
    .insert({ name, key_prefix: keyPrefix })
    .select("id")
    .single()
  if (error) throw new Error(`프로젝트 생성 실패: ${error.message}`)
  return data.id as string
}

/** 노드 생성 헬퍼 (admin). ticket_number 는 트리거가 발급. */
export async function createNode(
  admin: SupabaseClient,
  fields: {
    project_id: string
    type: string
    title: string
    parent_id?: string | null
    status_id?: string | null
    domain?: string | null
  }
) {
  return admin.from("node").insert(fields).select("*").single()
}

/** 정리: 주어진 프로젝트들을 삭제 (cascade 로 하위 노드/상태/링크 제거). */
export async function cleanupProjects(admin: SupabaseClient, ids: string[]) {
  if (ids.length === 0) return
  await admin.from("project").delete().in("id", ids)
}

/** 모든 프로젝트 삭제 (E2E 클린 슬레이트용). */
export async function wipeAllProjects(admin: SupabaseClient) {
  const { data } = await admin.from("project").select("id")
  await cleanupProjects(
    admin,
    (data ?? []).map((r) => r.id as string)
  )
}
