import { useNodes } from "@/nodes/NodesProvider"
import { ProgressBadge, StatusBadge } from "@/nodes/NodeBadges"
import { PIXEL_ICONS } from "@/nodes/pixelIcons"
import { LAYER_COLOR } from "@/nodes/layerColors"
import { TYPE_META } from "@/nodes/nodeGrammar"

/**
 * 상세 패널 드릴다운 — 비-잎 노드의 "한 단계 아래" 자식 목록을 클릭 가능한 네비로.
 * 행 = 타입아이콘 + 제목 + 진행바/상태뱃지. 클릭 → openNode(트리행과 동일 메커니즘).
 */
export function ChildNav({ parentId }: { parentId: string }) {
  const { childrenOf, openNode } = useNodes()
  const kids = childrenOf(parentId)

  if (kids.length === 0) {
    return (
      <p
        className="text-muted-foreground py-1 text-xs"
        data-testid="child-nav-empty"
      >
        하위 항목이 없습니다.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-1" data-testid="child-nav">
      {kids.map((k) => {
        const Icon = PIXEL_ICONS[k.type]
        return (
          <button
            key={k.id}
            type="button"
            onClick={() => openNode(k.id)}
            className="group flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-[var(--c-pink-bg)]"
            data-testid="child-nav-row"
            data-node-type={k.type}
          >
            <Icon
              className="size-4 shrink-0"
              style={{ color: LAYER_COLOR[k.type].base }}
            />
            <span className="min-w-0 flex-1 truncate text-[13.5px]">
              {k.title}
            </span>
            <span
              className="text-[10.5px] font-medium"
              style={{ color: "var(--c-ink-3)" }}
            >
              {TYPE_META[k.type].label}
            </span>
            {k.type === "작업" ? (
              <StatusBadge statusId={k.status_id} />
            ) : (
              <ProgressBadge nodeId={k.id} />
            )}
          </button>
        )
      })}
    </div>
  )
}
