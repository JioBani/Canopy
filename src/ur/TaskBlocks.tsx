import { useCallback, useEffect, useState } from "react"
import { Link2, X } from "lucide-react"
import { useNodes } from "@/nodes/NodesProvider"
import {
  addNodeLink,
  listLinksFrom,
  removeNodeLink,
  type NodeLink,
} from "@/lib/nodeLinks"
import { ticketKey } from "@/nodes/nodeGrammar"
import { Button } from "@/components/ui/button"
import { Picker, type PickerGroup } from "@/components/ui/picker"

export function TaskBlocks({
  nodeId,
  editable = false,
}: {
  nodeId: string
  editable?: boolean
}) {
  const { nodes } = useNodes()
  const [links, setLinks] = useState<NodeLink[]>([])

  const reload = useCallback(async () => {
    setLinks(await listLinksFrom(nodeId, "blocks"))
  }, [nodeId])

  useEffect(() => {
    reload().catch((e) => console.error("[blocks] 로드 실패:", e))
  }, [reload])

  const nodeById = new Map(nodes.map((n) => [n.id, n]))
  const tk = (id: string) => {
    const n = nodeById.get(id)
    if (!n) return "#?"
    return ticketKey(n.type, n.ticket_number)
  }
  const titleOf = (id: string) => nodeById.get(id)?.title ?? id.slice(0, 8)

  const linkedTo = new Set(links.map((l) => l.to_node_id))
  const candidates = nodes.filter((n) => n.id !== nodeId && !linkedTo.has(n.id))
  const groups: PickerGroup[] = [
    {
      key: "all",
      items: candidates.map((n) => ({
        value: n.id,
        label: `${tk(n.id)} ${n.title}`,
      })),
    },
  ]

  return (
    <section className="flex flex-col gap-2.5" data-testid="task-blocks">
      <h3 className="font-display text-[15px] font-bold">선제조건 (blocks)</h3>

      <div className="flex flex-col gap-1.5">
        {links.map((l) => (
          <div
            key={l.id}
            className="group/bl border-border bg-card flex items-center gap-2 rounded-[10px] border px-3 py-2 text-[13.5px]"
            data-testid="block-link"
          >
            <Link2
              className="size-3.5 shrink-0"
              style={{ color: "var(--c-ink-3)" }}
            />
            <code
              className="tnum shrink-0 font-mono text-[11.5px] font-semibold"
              style={{ color: "var(--c-plum)" }}
            >
              {tk(l.to_node_id)}
            </code>
            <span className="flex-1 truncate">{titleOf(l.to_node_id)}</span>
            {editable && (
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive size-6 shrink-0 opacity-0 group-hover/bl:opacity-100"
                onClick={async () => {
                  await removeNodeLink(l.id)
                  await reload()
                }}
                data-testid="block-remove"
                title="제거"
              >
                <X className="size-3.5" />
              </Button>
            )}
          </div>
        ))}
        {links.length === 0 && (
          <p className="text-muted-foreground text-[13px]">선제조건이 없습니다.</p>
        )}
      </div>

      {editable && (
        <Picker
          triggerLabel="선제조건 추가"
          placeholder="티켓·제목 검색…"
          empty="추가할 노드가 없습니다."
          groups={groups}
          onPick={async (toId) => {
            await addNodeLink(nodeId, toId, "blocks")
            await reload()
          }}
          testid="block-picker"
        />
      )}
    </section>
  )
}
