import { useCallback, useEffect, useState } from "react"
import { Lock, X } from "lucide-react"
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
import { LayerIcon, Section, TicketKey } from "@/components/ds"

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
    <Section
      icon={<Lock />}
      title="선제조건"
      count={links.length || undefined}
      meta="먼저 끝나야 하는 항목"
      data-testid="task-blocks"
      actions={
        editable && (
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
        )
      }
    >
      {links.length === 0 ? (
        <p className="text-body text-fg-3">선제조건이 없습니다.</p>
      ) : (
        <div className="border-line overflow-hidden rounded-lg border">
          {links.map((l) => {
            const n = nodeById.get(l.to_node_id)
            return (
              <div
                key={l.id}
                className="group/bl border-line flex min-h-11 items-center gap-3 border-t px-4 py-2.5 first:border-t-0"
                data-testid="block-link"
              >
                {n && <LayerIcon type={n.type} />}
                <TicketKey value={tk(l.to_node_id)} />
                <span className="text-body text-fg min-w-0 flex-1 font-medium">
                  {titleOf(l.to_node_id)}
                </span>
                {editable && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="hover:text-danger shrink-0 opacity-0 group-hover/bl:opacity-100 focus-visible:opacity-100"
                    onClick={async () => {
                      await removeNodeLink(l.id)
                      await reload()
                    }}
                    data-testid="block-remove"
                    title="선제조건 제거"
                  >
                    <X />
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Section>
  )
}
