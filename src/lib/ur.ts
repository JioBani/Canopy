import { supabase } from "@/lib/supabase"

export interface UrGroup {
  id: string
  feature_id: string
  name: string
  sort_order: number
}

export interface Ur {
  id: string
  feature_id: string
  ur_group_id: string | null
  text: string
  sort_order: number
}

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
/** 주어진 기능들의 UR (피커용으로 배열 허용). */
export async function listUrs(featureIds: string[]): Promise<Ur[]> {
  if (featureIds.length === 0) return []
  const { data, error } = await supabase
    .from("ur")
    .select("id, feature_id, ur_group_id, text, sort_order")
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
    .select("id, feature_id, ur_group_id, text, sort_order")
    .single()
  if (error) throw new Error(error.message)
  return data as Ur
}

export async function updateUr(
  id: string,
  patch: Partial<Pick<Ur, "text" | "ur_group_id" | "sort_order">>
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
