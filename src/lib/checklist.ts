import { supabase } from "@/lib/supabase"

export interface ChecklistItem {
  id: string
  work_id: string
  text: string
  done: boolean
  sort_order: number
}

export async function listChecklist(workId: string): Promise<ChecklistItem[]> {
  const { data, error } = await supabase
    .from("task_checklist")
    .select("id, work_id, text, done, sort_order")
    .eq("work_id", workId)
    .order("sort_order", { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as ChecklistItem[]
}

export async function insertChecklistItem(
  workId: string,
  text: string,
  sortOrder: number
): Promise<ChecklistItem> {
  const { data, error } = await supabase
    .from("task_checklist")
    .insert({ work_id: workId, text: text.trim(), sort_order: sortOrder })
    .select("id, work_id, text, done, sort_order")
    .single()
  if (error) throw new Error(error.message)
  return data as ChecklistItem
}

export async function updateChecklistItem(
  id: string,
  patch: Partial<Pick<ChecklistItem, "text" | "done" | "sort_order">>
): Promise<void> {
  const { error } = await supabase.from("task_checklist").update(patch).eq("id", id)
  if (error) throw new Error(error.message)
}

export async function deleteChecklistItem(id: string): Promise<void> {
  const { error } = await supabase.from("task_checklist").delete().eq("id", id)
  if (error) throw new Error(error.message)
}
