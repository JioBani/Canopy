import { supabase } from "@/lib/supabase"

export interface WorkLog {
  id: string
  work_id: string
  member_id: string | null
  started_at: string
  ended_at: string | null
  duration_minutes: number | null
  note: string | null
  created_at: string
  updated_at: string
}

const COLS =
  "id, work_id, member_id, started_at, ended_at, duration_minutes, note, created_at, updated_at"

/** 작업의 로그 목록 (시작순). */
export async function listWorkLogs(workId: string): Promise<WorkLog[]> {
  const { data, error } = await supabase
    .from("work_log")
    .select(COLS)
    .eq("work_id", workId)
    .order("started_at", { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as WorkLog[]
}

/** 세션 시작 — started_at=now, ended_at=null(진행 중). member_id 기본=작업 담당자. */
export async function startWorkLog(
  workId: string,
  memberId: string | null
): Promise<WorkLog> {
  const { data, error } = await supabase
    .from("work_log")
    .insert({ work_id: workId, member_id: memberId })
    .select(COLS)
    .single()
  if (error) throw new Error(error.message)
  return data as WorkLog
}

/** 분 단위 경과(올림, 최소 0). started→ended. */
export function elapsedMinutes(startedAt: string, endedMs: number): number {
  const ms = endedMs - new Date(startedAt).getTime()
  return Math.max(0, Math.round(ms / 60000))
}

/** 세션 종료 — ended_at=now, duration 계산. note 는 건드리지 않음(행에서 편집). */
export async function stopWorkLog(id: string, startedAt: string): Promise<void> {
  const now = Date.now()
  const { error } = await supabase
    .from("work_log")
    .update({
      ended_at: new Date(now).toISOString(),
      duration_minutes: elapsedMinutes(startedAt, now),
    })
    .eq("id", id)
  if (error) throw new Error(error.message)
}

/** 로그 수정 — duration/note/작업자. */
export async function updateWorkLog(
  id: string,
  patch: {
    duration_minutes?: number
    note?: string | null
    member_id?: string | null
  }
): Promise<void> {
  const { error } = await supabase.from("work_log").update(patch).eq("id", id)
  if (error) throw new Error(error.message)
}

export async function deleteWorkLog(id: string): Promise<void> {
  const { error } = await supabase.from("work_log").delete().eq("id", id)
  if (error) throw new Error(error.message)
}

/** 종료된 로그 duration 합(분). */
export function loggedMinutes(logs: WorkLog[]): number {
  return logs.reduce((m, l) => m + (l.duration_minutes ?? 0), 0)
}

/** 분 → "Hh Mm" 표시. */
export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h > 0) return `${h}시간 ${m}분`
  return `${m}분`
}
