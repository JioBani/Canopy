import { Copy } from "lucide-react"
import { useNodes } from "@/nodes/NodesProvider"
import { PIXEL_ICONS } from "@/nodes/pixelIcons"
import { TYPE_META, ticketKey } from "@/nodes/nodeGrammar"
import { LAYER_COLOR, layerTint } from "@/nodes/layerColors"
import type { AppNode } from "@/lib/nodes"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

/** 큰 브레드크럼 — 조상 경로(루트→부모), 세그먼트 클릭 시 점프. 길면 중간 생략. */
function Breadcrumb({
  ancestors,
  onJump,
}: {
  ancestors: AppNode[]
  onJump: (id: string) => void
}) {
  const collapsed = ancestors.length > 3
  const shown: (AppNode | null)[] = collapsed
    ? [ancestors[0], null, ancestors[ancestors.length - 1]]
    : ancestors
  const full = ancestors.map((a) => a.title).join(" › ")

  const nav = (
    <nav
      className="flex items-center gap-1.5 text-[14px] font-medium"
      style={{ color: "var(--c-ink-2)" }}
      data-testid="cover-breadcrumb"
    >
      {shown.map((a, i) => (
        <span key={a?.id ?? `gap-${i}`} className="flex items-center gap-1.5">
          {i > 0 && <span style={{ color: "var(--c-ink-3)" }}>›</span>}
          {a ? (
            <button
              type="button"
              onClick={() => onJump(a.id)}
              data-testid="breadcrumb-seg"
              className="max-w-[200px] truncate transition-colors hover:text-[var(--c-ink)] hover:underline"
            >
              {a.title}
            </button>
          ) : (
            <span style={{ color: "var(--c-ink-3)" }}>…</span>
          )}
        </span>
      ))}
    </nav>
  )

  if (!collapsed) return nav
  return (
    <Tooltip>
      <TooltipTrigger asChild>{nav}</TooltipTrigger>
      <TooltipContent>{full}</TooltipContent>
    </Tooltip>
  )
}

/**
 * 상세 커버 밴드 — 레이어 칩(색+아이콘) + 큰 브레드크럼 + 티켓키.
 * 레이어색은 커버에만 등장(한 화면 한 색). 제목은 밴드 아래(NodeDetail) 가 담당.
 */
export function CoverHeader({ node }: { node: AppNode }) {
  const { nodes, openNode } = useNodes()
  const layer = LAYER_COLOR[node.type]
  const Icon = PIXEL_ICONS[node.type]
  const ticket = ticketKey(node.type, node.ticket_number)

  const ancestors: AppNode[] = []
  let cur: AppNode | null = node.parent_id
    ? (nodes.find((n) => n.id === node.parent_id) ?? null)
    : null
  while (cur) {
    ancestors.unshift(cur)
    cur = cur.parent_id ? (nodes.find((n) => n.id === cur!.parent_id) ?? null) : null
  }

  return (
    <div
      className="relative overflow-hidden rounded-t-[14px] border-b"
      style={{ background: layerTint(node.type), borderColor: "var(--c-line)" }}
      data-testid="cover-header"
      data-layer={node.type}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ background: layer.base }}
      />
      <div className="flex flex-col gap-1.5 px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5" data-testid="cover-layer">
            <Icon className="size-[15px] shrink-0" style={{ color: layer.base }} />
            <span
              className="text-[13px] font-bold"
              style={{ color: layer.ink }}
              data-testid="detail-type"
            >
              {TYPE_META[node.type].label}
            </span>
          </span>
          <code
            className="tnum ml-auto font-mono text-[11.5px] font-semibold"
            style={{ color: "var(--c-plum)" }}
            data-testid="detail-ticket"
          >
            {ticket}
          </code>
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            title="티켓키 복사"
            data-testid="copy-ticket"
            onClick={() => void navigator.clipboard?.writeText(ticket)}
          >
            <Copy className="size-3.5" />
          </Button>
        </div>
        {ancestors.length > 0 && (
          <Breadcrumb ancestors={ancestors} onJump={openNode} />
        )}
      </div>
    </div>
  )
}
