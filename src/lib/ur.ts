import { supabase } from "@/lib/supabase"

export interface UrGroup {
  id: string
  feature_id: string
  name: string
  sort_order: number
}

export type UrStatus = "완료" | "미구현" | "오구현"

export interface Ur {
  id: string
  /** 소유 세부기능 노드 id (컬럼명은 호환상 feature_id 유지). */
  feature_id: string
  ur_group_id: string | null
  /** 트리거 발급 번호 (키 = Requirement-{ticket_number}, 프로젝트 단위). */
  ticket_number: number
  text: string
  status: UrStatus
  misimpl_reason: string | null
  sort_order: number
}

// urKey 는 순수 포맷 함수라 nodeGrammar 에 두고 재노출(unit 테스트가 supabase 의존 회피).
export { urKey } from "@/nodes/nodeGrammar"

export interface UrCoverage {
  ur_id: string
  feature_id: string
  ur_group_id: string | null
  linked_work_count: number
  done_work_count: number
  is_uncovered: boolean
}

// ── ur_group ────────────────────────────────────────────────
export async function listUrGroups(featureId: string): Promise<UrGroup[]> {
  const { data, error } = await supabase
    .from("ur_group")
    .select("id, feature_id, name, sort_order")
    .eq("feature_id", featureId)
    .order("sort_order", { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as UrGroup[]
}

export async function insertUrGroup(
  featureId: string,
  name: string,
  sortOrder: number
): Promise<UrGroup> {
  const { data, error } = await supabase
    .from("ur_group")
    .insert({ feature_id: featureId, name: name.trim(), sort_order: sortOrder })
    .select("id, feature_id, name, sort_order")
    .single()
  if (error) throw new Error(error.message)
  return data as UrGroup
}

export async function renameUrGroup(id: string, name: string): Promise<void> {
  const { error } = await supabase
    .from("ur_group")
    .update({ name: name.trim() })
    .eq("id", id)
  if (error) throw new Error(error.message)
}

/** 그룹 삭제. FK on delete set null 로 소속 UR 은 미분류로 남는다. */
export async function deleteUrGroup(id: string): Promise<void> {
  const { error } = await supabase.from("ur_group").delete().eq("id", id)
  if (error) throw new Error(error.message)
}

// ── ur ──────────────────────────────────────────────────────
const UR_COLS =
  "id, feature_id, ur_group_id, ticket_number, text, status, misimpl_reason, sort_order"

/** 주어진 세부기능들의 UR (피커용으로 배열 허용). */
export async function listUrs(featureIds: string[]): Promise<Ur[]> {
  if (featureIds.length === 0) return []
  const { data, error } = await supabase
    .from("ur")
    .select(UR_COLS)
    .in("feature_id", featureIds)
    .order("sort_order", { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as Ur[]
}

export async function insertUr(input: {
  feature_id: string
  ur_group_id: string | null
  text: string
  sort_order: number
}): Promise<Ur> {
  const { data, error } = await supabase
    .from("ur")
    .insert({ ...input, text: input.text.trim() })
    .select(UR_COLS)
    .single()
  if (error) throw new Error(error.message)
  return data as Ur
}

export async function updateUr(
  id: string,
  patch: Partial<
    Pick<Ur, "text" | "ur_group_id" | "sort_order" | "status" | "misimpl_reason">
  >
): Promise<void> {
  const { error } = await supabase.from("ur").update(patch).eq("id", id)
  if (error) throw new Error(error.message)
}

export async function deleteUr(id: string): Promise<void> {
  const { error } = await supabase.from("ur").delete().eq("id", id)
  if (error) throw new Error(error.message)
}

// ── ur_coverage 뷰 ──────────────────────────────────────────
export async function listUrCoverageByFeature(
  featureId: string
): Promise<UrCoverage[]> {
  const { data, error } = await supabase
    .from("ur_coverage")
    .select("ur_id, feature_id, ur_group_id, linked_work_count, done_work_count, is_uncovered")
    .eq("feature_id", featureId)
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => ({
    ur_id: r.ur_id as string,
    feature_id: r.feature_id as string,
    ur_group_id: r.ur_group_id as string | null,
    linked_work_count: Number(r.linked_work_count),
    done_work_count: Number(r.done_work_count),
    is_uncovered: Boolean(r.is_uncovered),
  }))
}

/** 여러 기능의 커버리지를 청크로 조회(대시보드용 — feature 많아도 URL 길이 안전). */
export async function listUrCoverageByFeatures(
  featureIds: string[]
): Promise<UrCoverage[]> {
  const out: UrCoverage[] = []
  const CHUNK = 60
  for (let i = 0; i < featureIds.length; i += CHUNK) {
    const chunk = featureIds.slice(i, i + CHUNK)
    const { data, error } = await supabase
      .from("ur_coverage")
      .select(
        "ur_id, feature_id, ur_group_id, linked_work_count, done_work_count, is_uncovered"
      )
      .in("feature_id", chunk)
    if (error) throw new Error(error.message)
    for (const r of data ?? []) {
      out.push({
        ur_id: r.ur_id as string,
        feature_id: r.feature_id as string,
        ur_group_id: r.ur_group_id as string | null,
        linked_work_count: Number(r.linked_work_count),
        done_work_count: Number(r.done_work_count),
        is_uncovered: Boolean(r.is_uncovered),
      })
    }
  }
  return out
}

// ── ur_work_link (M:N) ──────────────────────────────────────
export async function listUrIdsForWork(workId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("ur_work_link")
    .select("ur_id")
    .eq("work_id", workId)
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => r.ur_id as string)
}

export async function linkUrWork(urId: string, workId: string): Promise<void> {
  const { error } = await supabase
    .from("ur_work_link")
    .insert({ ur_id: urId, work_id: workId })
  if (error) throw new Error(error.message)
}

export async function unlinkUrWork(urId: string, workId: string): Promise<void> {
  const { error } = await supabase
    .from("ur_work_link")
    .delete()
    .eq("ur_id", urId)
    .eq("work_id", workId)
  if (error) throw new Error(error.message)
}
