import { supabase } from "@/lib/supabase"

export type NodeLinkType = "blocks" | "relates"

export interface NodeLink {
  id: string
  from_node_id: string
  to_node_id: string
  type: NodeLinkType
}

/** from 노드가 가리키는 특정 타입 링크 목록. */
export async function listLinksFrom(
  fromNodeId: string,
  type: NodeLinkType
): Promise<NodeLink[]> {
  const { data, error } = await supabase
    .from("node_link")
    .select("id, from_node_id, to_node_id, type")
    .eq("from_node_id", fromNodeId)
    .eq("type", type)
  if (error) throw new Error(error.message)
  return (data ?? []) as NodeLink[]
}

export async function addNodeLink(
  fromNodeId: string,
  toNodeId: string,
  type: NodeLinkType
): Promise<NodeLink> {
  const { data, error } = await supabase
    .from("node_link")
    .insert({ from_node_id: fromNodeId, to_node_id: toNodeId, type })
    .select("id, from_node_id, to_node_id, type")
    .single()
  if (error) throw new Error(error.message)
  return data as NodeLink
}

export async function removeNodeLink(id: string): Promise<void> {
  const { error } = await supabase.from("node_link").delete().eq("id", id)
  if (error) throw new Error(error.message)
}
