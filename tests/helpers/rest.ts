/**
 * Playwright 스펙 전용 경량 admin REST 헬퍼 (fetch 기반).
 * Playwright 러너는 @supabase/supabase-js(ESM) import 시 모듈 로더 에러를 내므로
 * SDK 대신 PostgREST 를 직접 호출한다. service_role 키로 RLS 우회.
 * 로컬 전용 공개 데모 키이므로 커밋 안전.
 */
const URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54621"
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"

function headers() {
  return {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  }
}

export async function restGet<T = unknown>(query: string): Promise<T[]> {
  const res = await fetch(`${URL}/rest/v1/${query}`, { headers: headers() })
  if (!res.ok) throw new Error(`REST GET 실패 ${res.status}: ${await res.text()}`)
  return (await res.json()) as T[]
}

export async function restDelete(query: string): Promise<void> {
  const res = await fetch(`${URL}/rest/v1/${query}`, {
    method: "DELETE",
    headers: headers(),
  })
  if (!res.ok) throw new Error(`REST DELETE 실패 ${res.status}: ${await res.text()}`)
}

export async function restPost(
  table: string,
  body: Record<string, unknown> | Record<string, unknown>[]
): Promise<void> {
  const res = await fetch(`${URL}/rest/v1/${table}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`REST POST 실패 ${res.status}: ${await res.text()}`)
}

export async function restPatch(
  query: string,
  body: Record<string, unknown>
): Promise<void> {
  const res = await fetch(`${URL}/rest/v1/${query}`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`REST PATCH 실패 ${res.status}: ${await res.text()}`)
}

/** 모든 프로젝트 삭제 (cascade). E2E 클린 슬레이트용. */
export async function wipeAllProjects(): Promise<void> {
  await restDelete("project?id=not.is.null")
}
