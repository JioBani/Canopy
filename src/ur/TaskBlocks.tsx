import { useCallback, useEffect, useState } from "react"
import { X } from "lucide-react"
import { useNodes } from "@/nodes/NodesProvider"
import { useProjects } from "@/projects/ProjectProvider"
import {
  addNodeLink,
  listLinksFrom,
  removeNodeLink,
  type NodeLink,
} from "@/lib/nodeLinks"
import { ticketKey } from "@/lib/validation"
import { Button } from "@/components/ui/button"

const selectClass =
  "border-input h-8 w-full rounded-md border bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"

export function TaskBlocks({ nodeId }: { nodeId: string }) {
  const { nodes } = useNodes()
  const { currentProject } = useProjects()
  const [links, setLinks] = useState<NodeLink[]>([])

  const reload = useCallback(async () => {
    setLinks(await listLinksFrom(nodeId, "blocks"))
  }, [nodeId])

  useEffect(() => {
    reload().catch((e) => console.error("[blocks] 로드 실패:", e))
  }, [reload])

  const nodeById = new Map(nodes.map((n) => [n.id, n]))
  const label = (id: string) => {
    const n = nodeById.get(id)
    if (!n) return id.slice(0, 8)
    const key = currentProject
      ? ticketKey(currentProject.key_prefix, n.ticket_number)
      : `#${n.ticket_number}`
    return `${key} ${n.title}`
  }

  const linkedTo = new Set(links.map((l) => l.to_node_id))
  const candidates = nodes.filter((n) => n.id !== nodeId && !linkedTo.has(n.id))

  return (
    <div className="flex flex-col gap-2" data-testid="task-blocks">
      <h3 className="text-sm font-semibold">선제조건 (blocks)</h3>

      {links.map((l) => (
        <div
          key={l.id}
          className="flex items-center gap-2 rounded border px-2 py-1 text-sm"
          data-testid="block-link"
        >
          <span className="flex-1 truncate">⛓ {label(l.to_node_id)}</span>
          <Button
            variant="ghost"
            size="icon"
            className="size-5"
            onClick={async () => {
              await removeNodeLink(l.id)
              await reload()
            }}
            data-testid="block-remove"
            title="제거"
          >
            <X className="size-3" />
          </Button>
        </div>
      ))}
      {links.length === 0 && (
        <p className="text-muted-foreground text-xs">선제조건이 없습니다.</p>
      )}

      <select
        className={selectClass}
        value=""
        onChange={async (e) => {
          if (!e.target.value) return
          await addNodeLink(nodeId, e.target.value, "blocks")
          await reload()
        }}
        data-testid="block-picker"
      >
        <option value="">+ 선제조건 추가…</option>
        {candidates.map((n) => (
          <option key={n.id} value={n.id}>
            {label(n.id)}
          </option>
        ))}
      </select>
    </div>
  )
}
