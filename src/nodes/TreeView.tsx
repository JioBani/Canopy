import { useState, type KeyboardEvent } from "react"
import {
  ChevronDown,
  ChevronRight,
  Circle,
  Cog,
  Database,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  Trash2,
  Wrench,
  type LucideIcon,
} from "lucide-react"
import { useNodes } from "@/nodes/NodesProvider"
import { DeleteNodeDialog } from "@/nodes/DeleteNodeDialog"
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

const ICONS: Record<NodeType, LucideIcon> = {
  컨텐츠: Package,
  기능: Cog,
  세부기능: Wrench,
  마스터데이터: Database,
  작업: Circle,
}

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
        className="h-7"
        data-testid="inline-add-input"
      />
    </div>
  )
}

/** 제목 인라인 편집: Enter 저장 / Esc·blur 취소. */
function RenameInput({
  initial,
  onSave,
  onCancel,
}: {
  initial: string
  onSave: (title: string) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState(initial)
  return (
    <Input
      autoFocus
      value={value}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault()
          const t = value.trim()
          if (t) onSave(t)
          else onCancel()
        } else if (e.key === "Escape") {
          e.preventDefault()
          onCancel()
        }
      }}
      onBlur={onCancel}
      className="h-7"
      data-testid="rename-input"
    />
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
        size="icon"
        className="size-6"
        onClick={(e) => {
          e.stopPropagation()
          onPick(allowed[0])
        }}
        data-testid="node-add"
        title={`${TYPE_META[allowed[0]].label} 추가`}
      >
        <Plus className="size-3.5" />
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-6"
          onClick={(e) => e.stopPropagation()}
          data-testid="node-add"
          title="자식 추가"
        >
          <Plus className="size-3.5" />
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
    renameNode,
  } = useNodes()
  const [addingType, setAddingType] = useState<NodeType | null>(null)
  const [editing, setEditing] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const kids = childrenOf(node.id)
  const hasKids = kids.length > 0
  const expanded = isExpanded(node.id)
  const Icon = ICONS[node.type]

  return (
    <div>
      <div
        className={cn(
          "group flex cursor-pointer items-center gap-1 rounded py-1 pr-1 hover:bg-accent/60",
          selectedId === node.id && "bg-accent"
        )}
        style={{ paddingLeft: depth * INDENT }}
        onClick={() => select(node.id)}
        data-testid="tree-node"
        data-node-type={node.type}
      >
        <button
          type="button"
          className="text-muted-foreground flex size-5 items-center justify-center"
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

        <Icon className={cn("size-4 shrink-0", TYPE_META[node.type].color)} />

        {editing ? (
          <RenameInput
            initial={node.title}
            onSave={(t) => {
              void renameNode(node.id, t)
              setEditing(false)
            }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <span
            className="flex-1 truncate text-sm"
            data-testid="node-title"
            onDoubleClick={(e) => {
              e.stopPropagation()
              setEditing(true)
            }}
          >
            {node.title}
          </span>
        )}

        {!editing && (
          <span className="flex items-center opacity-0 group-hover:opacity-100">
            <AddChildButton
              parentType={node.type}
              onPick={(t) => setAddingType(t)}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  onClick={(e) => e.stopPropagation()}
                  data-testid="node-more"
                  title="더보기"
                >
                  <MoreHorizontal className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={() => setEditing(true)}
                  data-testid="rename-action"
                >
                  <Pencil className="size-4" />
                  이름 변경
                </DropdownMenuItem>
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
        )}
      </div>

      {addingType && (
        <InlineAdd
          parentId={node.id}
          type={addingType}
          depth={depth + 1}
          onClose={() => setAddingType(null)}
        />
      )}

      {expanded &&
        kids.map((child) => (
          <TreeNodeRow key={child.id} node={child} depth={depth + 1} />
        ))}

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
      <div className="text-muted-foreground p-3 text-sm" data-testid="tree-loading">
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
        <p className="text-muted-foreground text-sm">
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
    <div className="flex flex-col gap-0.5 p-2">
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
          size="sm"
          className="mt-1 justify-start gap-1"
          onClick={() => setAddingRoot(true)}
          data-testid="root-add"
        >
          <Plus className="size-3.5" />컨텐츠
        </Button>
      )}
    </div>
  )
}
