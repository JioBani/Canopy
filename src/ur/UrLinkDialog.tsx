import { useCallback, useEffect, useState } from "react"
import { Check, ChevronRight } from "lucide-react"
import { useNodes } from "@/nodes/NodesProvider"
import {
  linkUrWork,
  listUrGroups,
  listUrIdsForWork,
  listUrs,
  unlinkUrWork,
  urKey,
  type Ur,
} from "@/lib/ur"
import { UR_STATE_META, UrStateGlyph } from "@/ur/urStateGlyph"
import { PIXEL_ICONS } from "@/nodes/pixelIcons"
import { LAYER_COLOR } from "@/nodes/layerColors"
import { TYPE_META } from "@/nodes/nodeGrammar"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

/** ur_group_id 별로 묶기 — [그룹키, UR목록]. 미분류는 null 키, 맨 뒤. */
function groupUrs(urs: Ur[]): Array<[string | null, Ur[]]> {
  const m = new Map<string | null, Ur[]>()
  for (const u of urs) {
    const arr = m.get(u.ur_group_id)
    if (arr) arr.push(u)
    else m.set(u.ur_group_id, [u])
  }
  const entries = [...m.entries()]
  entries.sort((a, b) => (a[0] === null ? 1 : b[0] === null ? -1 : 0))
  return entries
}

/** 한 세부기능의 UR 목록(그룹 헤더 + 행). 선택은 draft 기준(즉시 반영 X). */
function SubUrList({
  urs,
  groupName,
  selected,
  onToggle,
  onSetMany,
}: {
  urs: Ur[]
  groupName: (id: string) => string
  selected: Set<string>
  onToggle: (u: Ur) => void
  onSetMany: (ids: string[], on: boolean) => void
}) {
  if (urs.length === 0)
    return (
      <p className="text-muted-foreground py-1 pl-2 text-[12.5px]">
        요구사항이 없습니다.
      </p>
    )
  return (
    <div className="flex flex-col gap-2">
      {groupUrs(urs).map(([gid, list]) => {
        const ids = list.map((u) => u.id)
        const allSel = list.every((u) => selected.has(u.id))
        const anySel = list.some((u) => selected.has(u.id))
        const incompleteUnsel = list
          .filter((u) => u.status !== "완료" && !selected.has(u.id))
          .map((u) => u.id)
        return (
          <div key={gid ?? "none"} className="flex flex-col gap-0.5">
            <div className="flex flex-wrap items-center gap-1.5 py-0.5">
              <span
                className="text-[11px] font-semibold"
                style={{ color: "var(--c-ink-3)" }}
                data-testid="ur-link-group-name"
              >
                {gid ? groupName(gid) : "미분류"} · {list.length}
              </span>
              {!allSel && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-[11px]"
                  onClick={() => onSetMany(ids, true)}
                  data-testid="ur-link-group-all"
                >
                  전체 연결
                </Button>
              )}
              {incompleteUnsel.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-[11px]"
                  onClick={() => onSetMany(incompleteUnsel, true)}
                  data-testid="ur-link-group-incomplete"
                >
                  미완료만 연결
                </Button>
              )}
              {anySel && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground h-6 px-1.5 text-[11px]"
                  onClick={() => onSetMany(ids, false)}
                  data-testid="ur-link-group-clear"
                >
                  전체 해제
                </Button>
              )}
            </div>
            {list.map((u) => {
              const isSel = selected.has(u.id)
              const meta = UR_STATE_META[u.status]
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => onToggle(u)}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
                    isSel ? "bg-[var(--c-pink-bg)]" : "hover:bg-[var(--c-pink-bg)]/50"
                  )}
                  data-testid="ur-link-row"
                  data-linked={isSel ? "true" : "false"}
                >
                  <span
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded border",
                      isSel
                        ? "border-[var(--c-sakura)] bg-[var(--c-sakura)] text-white"
                        : "border-[var(--c-line-2)]"
                    )}
                  >
                    {isSel && <Check className="size-3" />}
                  </span>
                  <span
                    className="inline-flex shrink-0 items-center gap-1"
                    style={{ color: meta.color }}
                  >
                    <UrStateGlyph status={u.status} className="size-[15px]" />
                    <span className="text-[11px] font-semibold">{meta.label}</span>
                  </span>
                  <code
                    className="tnum shrink-0 font-mono text-[11px] font-semibold"
                    style={{ color: "var(--c-plum)" }}
                  >
                    {urKey(u.ticket_number)}
                  </code>
                  <span className="min-w-0 flex-1 text-[13px]">{u.text}</span>
                </button>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

export function UrLinkDialog({
  workId,
  subFeatureId,
  open,
  onOpenChange,
  onChanged,
}: {
  workId: string
  /** 작업의 부모 세부기능 id (마스터데이터 밑이면 null). */
  subFeatureId: string | null
  open: boolean
  onOpenChange: (v: boolean) => void
  onChanged: () => void
}) {
  const { nodes, childrenOf } = useNodes()
  const [linked, setLinked] = useState<Set<string>>(new Set()) // DB 원본
  const [draft, setDraft] = useState<Set<string>>(new Set()) // 편집 중(완료 시 반영)
  const [ursBySub, setUrsBySub] = useState<Map<string, Ur[]>>(new Map())
  const [groupNames, setGroupNames] = useState<Map<string, string>>(new Map())
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  const subName = (id: string) => nodes.find((n) => n.id === id)?.title ?? "세부기능"

  const loadSub = useCallback(async (subId: string) => {
    const [u, groups] = await Promise.all([
      listUrs([subId]),
      listUrGroups(subId),
    ])
    setUrsBySub((prev) => new Map(prev).set(subId, u))
    if (groups.length)
      setGroupNames((prev) => {
        const n = new Map(prev)
        groups.forEach((g) => n.set(g.id, g.name))
        return n
      })
  }, [])

  useEffect(() => {
    if (!open) return
    listUrIdsForWork(workId)
      .then((ids) => {
        setLinked(new Set(ids))
        setDraft(new Set(ids))
      })
      .catch((e) => console.error("[ur-link] 로드 실패:", e))
    setExpanded(new Set())
    if (subFeatureId) void loadSub(subFeatureId)
  }, [open, workId, subFeatureId, loadSub])

  function toggle(u: Ur) {
    setDraft((p) => {
      const n = new Set(p)
      if (n.has(u.id)) n.delete(u.id)
      else n.add(u.id)
      return n
    })
  }
  function setMany(ids: string[], on: boolean) {
    setDraft((p) => {
      const n = new Set(p)
      ids.forEach((id) => (on ? n.add(id) : n.delete(id)))
      return n
    })
  }

  async function save() {
    setSaving(true)
    try {
      const toAdd = [...draft].filter((id) => !linked.has(id))
      const toRemove = [...linked].filter((id) => !draft.has(id))
      for (const id of toAdd) await linkUrWork(id, workId)
      for (const id of toRemove) await unlinkUrWork(id, workId)
      onChanged()
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  function toggleExpand(id: string) {
    setExpanded((p) => {
      const n = new Set(p)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
    if (nodes.find((x) => x.id === id)?.type === "세부기능") void loadSub(id)
  }

  const contents = childrenOf(null).filter((n) => n.type === "컨텐츠")
  const pendingCount =
    [...draft].filter((id) => !linked.has(id)).length +
    [...linked].filter((id) => !draft.has(id)).length

  function TreeRow({ id, depth }: { id: string; depth: number }) {
    const node = nodes.find((n) => n.id === id)
    if (!node) return null
    if (node.id === subFeatureId) return null // 현재 세부기능은 상단 섹션에
    const Icon = PIXEL_ICONS[node.type]
    const isSub = node.type === "세부기능"
    const kids = childrenOf(node.id).filter((c) => c.type !== "작업")
    const openRow = expanded.has(node.id)
    return (
      <div className="flex flex-col">
        <button
          type="button"
          onClick={() => toggleExpand(node.id)}
          className="flex items-center gap-1.5 rounded-md py-1 text-left text-[13px] hover:bg-[var(--c-pink-bg)]/40"
          style={{ paddingLeft: depth * 14 + 4 }}
          data-testid="ur-tree-node"
        >
          <ChevronRight
            className={cn(
              "text-muted-foreground size-3.5 shrink-0 transition-transform",
              openRow && "rotate-90"
            )}
          />
          <Icon
            className="size-4 shrink-0"
            style={{ color: LAYER_COLOR[node.type].base }}
          />
          <span className="truncate">{node.title}</span>
          <span
            className="text-[10.5px]"
            style={{ color: "var(--c-ink-3)" }}
          >
            {TYPE_META[node.type].label}
          </span>
        </button>
        {openRow && (
          <div style={{ paddingLeft: depth * 14 + 18 }}>
            {isSub ? (
              <SubUrList
                urs={ursBySub.get(node.id) ?? []}
                groupName={(g) => groupNames.get(g) ?? "그룹"}
                selected={draft}
                onToggle={toggle}
                onSetMany={setMany}
              />
            ) : (
              kids.map((c) => <TreeRow key={c.id} id={c.id} depth={depth + 1} />)
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="ur-link-dialog"
        className="max-h-[85vh] overflow-y-auto sm:max-w-3xl"
      >
        <DialogHeader>
          <DialogTitle>요구사항 연결</DialogTitle>
          <DialogDescription>
            이 작업이 만족시키는 요구사항을 고른 뒤 <b>완료</b>를 누르면 반영됩니다.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* 현재 세부기능 — 강조 카드, 기본 펼침 */}
          {subFeatureId && (
            <div
              className="flex flex-col gap-1.5 rounded-[12px] border-2 p-3"
              style={{
                borderColor: "var(--c-sakura)",
                background: "var(--c-pink-bg)",
              }}
              data-testid="ur-link-current"
            >
              <div className="flex items-center gap-2">
                <span
                  className="rounded-md px-1.5 py-0.5 text-[10.5px] font-bold text-white"
                  style={{ background: "var(--c-sakura)" }}
                >
                  현재 세부기능
                </span>
                <span className="font-display text-[14px] font-bold">
                  {subName(subFeatureId)}
                </span>
              </div>
              <SubUrList
                urs={ursBySub.get(subFeatureId) ?? []}
                groupName={(g) => groupNames.get(g) ?? "그룹"}
                selected={draft}
                onToggle={toggle}
                onSetMany={setMany}
              />
            </div>
          )}

          {/* 다른 요구사항 — 계층 트리(아이콘+텍스트), 접힘 기본 */}
          <div className="flex flex-col gap-0.5" data-testid="ur-link-tree">
            <span
              className="mb-1 text-[12px] font-bold"
              style={{ color: "var(--c-ink-2)" }}
            >
              다른 요구사항
            </span>
            {contents.map((c) => (
              <TreeRow key={c.id} id={c.id} depth={0} />
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="ur-link-cancel"
          >
            취소
          </Button>
          <Button onClick={() => void save()} disabled={saving} data-testid="ur-link-save">
            완료{pendingCount > 0 ? ` (${pendingCount})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
