import { useState, type KeyboardEvent } from "react"
import {
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Plus,
  Trash2,
} from "lucide-react"
import { useNodes } from "@/nodes/NodesProvider"
import { DeleteNodeDialog } from "@/nodes/DeleteNodeDialog"
import { ProgressBadge, StatusBadge } from "@/nodes/NodeBadges"
import { PIXEL_ICONS } from "@/nodes/pixelIcons"
import { LAYER_COLOR } from "@/nodes/layerColors"
import { SubFeatureSections } from "@/ur/SubFeatureSections"
import {
  allowedChildTypes,
  TYPE_META,
  type NodeType,
} from "@/nodes/nodeGrammar"
import type { AppNode } from "@/lib/nodes"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

const INDENT = 16

/** 인라인 제목 입력 행: Enter 로 생성(연속 가능), Esc/빈값 blur 로 닫기. */
function InlineAdd({
  parentId,
  type,
  depth,
  onClose,
}: {
  parentId: string | null
  type: NodeType
  depth: number
  onClose: () => void
}) {
  const { createChild } = useNodes()
  const [value, setValue] = useState("")
  const [busy, setBusy] = useState(false)

  async function commit() {
    const title = value.trim()
    if (!title || busy) return
    setBusy(true)
    try {
      await createChild(parentId, type, title)
      setValue("") // 연속 입력
    } catch (e) {
      console.error("[nodes] 생성 실패:", e)
    } finally {
      setBusy(false)
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault()
      void commit()
    } else if (e.key === "Escape") {
      e.preventDefault()
      onClose()
    }
  }

  return (
    <div
      className="flex items-center gap-1 py-0.5"
      style={{ paddingLeft: depth * INDENT + 8 }}
    >
      <Input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => {
          if (!value.trim()) onClose()
        }}
        placeholder={`${TYPE_META[type].label} 제목 입력 후 Enter`}
        className="h-8"
        data-testid="inline-add-input"
      />
    </div>
  )
}

/** 노드의 [+] — 허용 자식 타입이 1개면 바로, 여러 개면 드롭다운으로 선택. */
function AddChildButton({
  parentType,
  onPick,
}: {
  parentType: NodeType | null
  onPick: (type: NodeType) => void
}) {
  const allowed = allowedChildTypes(parentType)
  if (allowed.length === 0) return null

  if (allowed.length === 1) {
    return (
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={(e) => {
          e.stopPropagation()
          onPick(allowed[0])
        }}
        data-testid="node-add"
        title={`${TYPE_META[allowed[0]].label} 추가`}
      >
        <Plus className="size-4" />
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={(e) => e.stopPropagation()}
          data-testid="node-add"
          title="자식 추가"
        >
          <Plus className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {allowed.map((t) => (
          <DropdownMenuItem
            key={t}
            onSelect={() => onPick(t)}
            data-testid="add-type-option"
          >
            {TYPE_META[t].label} 추가
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function TreeNodeRow({ node, depth }: { node: AppNode; depth: number }) {
  const {
    childrenOf,
    isExpanded,
    toggleCollapse,
    selectedId,
    select,
  } = useNodes()
  const [addingType, setAddingType] = useState<NodeType | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const kids = childrenOf(node.id)
  const hasKids = kids.length > 0
  const expanded = isExpanded(node.id)
  const selected = selectedId === node.id
  const Icon = PIXEL_ICONS[node.type]
  // 레이어색은 타입 아이콘에만(텍스트/배경 색칠 금지).
  const iconColor = LAYER_COLOR[node.type].base

  return (
    <div className="relative">
      <div
        className={cn(
          "group text-body relative flex h-[34px] cursor-pointer items-center gap-1.5 rounded-md pr-2 transition-colors",
          selected
            ? "bg-selected text-fg font-semibold before:bg-brand before:absolute before:top-1.5 before:bottom-1.5 before:left-0 before:w-[3px] before:rounded-full before:content-['']"
            : "text-fg hover:bg-hover"
        )}
        style={{ paddingLeft: depth * INDENT + 2 }}
        onClick={() => select(node.id)}
        data-testid="tree-node"
        data-node-type={node.type}
      >
        <button
          type="button"
          className="text-fg-3 hover:text-fg flex size-5 shrink-0 items-center justify-center"
          onClick={(e) => {
            e.stopPropagation()
            if (hasKids) toggleCollapse(node.id)
          }}
          aria-label={hasKids ? (expanded ? "접기" : "펼치기") : undefined}
          data-testid="tree-toggle"
        >
          {hasKids ? (
            expanded ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )
          ) : null}
        </button>

        <Icon className="size-4 shrink-0" style={{ color: iconColor }} />

        <span
          className="min-w-0 flex-1 truncate"
          title={node.title}
          data-testid="node-title"
        >
          {node.title}
        </span>

        {/* 진행률/상태 — 액션 버튼은 hover 시 이 위에 겹쳐 뜸(제목 폭을 미리 잡아먹지 않음). */}
        <span className="flex shrink-0 items-center">
          {node.type === "작업" ? (
            <StatusBadge statusId={node.status_id} />
          ) : (
            <ProgressBadge nodeId={node.id} />
          )}
        </span>

        {/* 사이드바=보기/네비 전용: 이름/필드 편집은 상세에서. 구조(추가/삭제)만 유지. */}
        <span
          className={cn(
            "absolute top-1/2 right-1 flex -translate-y-1/2 items-center rounded-md opacity-0 group-hover:opacity-100 focus-within:opacity-100 has-[[data-state=open]]:opacity-100",
            selected ? "bg-selected" : "bg-hover"
          )}
        >
          <AddChildButton
            parentType={node.type}
            onPick={(t) => setAddingType(t)}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={(e) => e.stopPropagation()}
                data-testid="node-more"
                title="더보기"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => setDeleteOpen(true)}
                data-testid="delete-action"
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="size-4" />
                삭제
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </span>
      </div>

      {addingType && (
        <InlineAdd
          parentId={node.id}
          type={addingType}
          depth={depth + 1}
          onClose={() => setAddingType(null)}
        />
      )}

      {/* 세부기능 펼침 = 작업 raw 행 대신 UR/작업 임베드 패널(컴팩트) */}
      {expanded && node.type === "세부기능" && (
        <div
          className="py-1 pr-1"
          style={{ paddingLeft: (depth + 1) * INDENT }}
          onClick={(e) => e.stopPropagation()}
          data-testid="subfeature-embed"
        >
          <SubFeatureSections subFeatureId={node.id} compact />
        </div>
      )}

      {/* 그 외(컨텐츠/기능/마스터데이터 등): 자식 행 렌더 */}
      {expanded && hasKids && node.type !== "세부기능" && (
        <>
          {/* 가지 가이드선 */}
          <span
            aria-hidden
            className="bg-line absolute top-[34px] bottom-1 w-px"
            style={{ left: depth * INDENT + 12 }}
          />
          {kids.map((child) => (
            <TreeNodeRow key={child.id} node={child} depth={depth + 1} />
          ))}
        </>
      )}

      <DeleteNodeDialog
        node={node}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </div>
  )
}

export function TreeView() {
  const { loading, nodes, childrenOf } = useNodes()
  const [addingRoot, setAddingRoot] = useState(false)
  const roots = childrenOf(null)

  if (loading) {
    return (
      <div className="text-fg-3 text-body p-3" data-testid="tree-loading">
        트리 불러오는 중…
      </div>
    )
  }

  if (nodes.length === 0) {
    return (
      <div
        className="flex flex-col items-center gap-3 p-6 text-center"
        data-testid="empty-state"
      >
        <p className="text-body text-fg-2">
          아직 컨텐츠가 없습니다. 첫 컨텐츠를 추가해 시작하세요.
        </p>
        {addingRoot ? (
          <div className="w-full">
            <InlineAdd
              parentId={null}
              type="컨텐츠"
              depth={0}
              onClose={() => setAddingRoot(false)}
            />
          </div>
        ) : (
          <Button onClick={() => setAddingRoot(true)} data-testid="add-first-content">
            + 첫 컨텐츠 추가
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-px p-2">
      {roots.map((n) => (
        <TreeNodeRow key={n.id} node={n} depth={0} />
      ))}

      {addingRoot ? (
        <InlineAdd
          parentId={null}
          type="컨텐츠"
          depth={0}
          onClose={() => setAddingRoot(false)}
        />
      ) : (
        <Button
          variant="ghost"
          className="mt-1 h-8 justify-start gap-1.5 px-2"
          onClick={() => setAddingRoot(true)}
          data-testid="root-add"
        >
          <Plus className="size-4" />컨텐츠 추가
        </Button>
      )}
    </div>
  )
}
