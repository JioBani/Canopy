import { useCallback, useEffect, useState } from "react"
import { Check, ChevronRight, Link2 } from "lucide-react"
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
import { UrStateGlyph } from "@/ur/urStateGlyph"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

/** ur_group_id 별로 묶기 — [그룹키, UR목록]. 미분류는 null 키, 맨 뒤. */
function groupUrs(urs: Ur[]): Array<[string | null, Ur[]]> {
  const m = new Map<string | null, Ur[]>()
  for (const u of urs) {
    const k = u.ur_group_id
    const arr = m.get(k)
    if (arr) arr.push(u)
    else m.set(k, [u])
  }
  const entries = [...m.entries()]
  entries.sort((a, b) => (a[0] === null ? 1 : b[0] === null ? -1 : 0))
  return entries
}

/** 한 세부기능의 UR 목록(그룹 헤더 + 행). 연결 토글 + 그룹 일괄연결. */
function SubUrList({
  urs,
  groupName,
  linked,
  onToggle,
  onLinkGroup,
}: {
  urs: Ur[]
  groupName: (id: string) => string
  linked: Set<string>
  onToggle: (u: Ur) => void
  onLinkGroup: (urs: Ur[]) => void
}) {
  if (urs.length === 0)
    return (
      <p className="text-muted-foreground py-1 pl-2 text-[12.5px]">
        요구사항이 없습니다.
      </p>
    )
  return (
    <div className="flex flex-col gap-1.5">
      {groupUrs(urs).map(([gid, list]) => {
        const allLinked = list.every((u) => linked.has(u.id))
        return (
          <div key={gid ?? "none"} className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2 py-0.5">
              <span
                className="text-[11px] font-semibold"
                style={{ color: "var(--c-ink-3)" }}
                data-testid="ur-link-group-name"
              >
                {gid ? groupName(gid) : "미분류"} · {list.length}
              </span>
              {!allLinked && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 gap-1 px-1.5 text-[11px]"
                  onClick={() => onLinkGroup(list)}
                  data-testid="ur-link-group-all"
                >
                  <Link2 className="size-3" />그룹 전체 연결
                </Button>
              )}
            </div>
            {list.map((u) => {
              const isLinked = linked.has(u.id)
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => onToggle(u)}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
                    isLinked
                      ? "bg-[var(--c-pink-bg)]"
                      : "hover:bg-[var(--c-pink-bg)]/50"
                  )}
                  data-testid="ur-link-row"
                  data-linked={isLinked ? "true" : "false"}
                >
                  <span
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded border",
                      isLinked
                        ? "border-[var(--c-sakura)] bg-[var(--c-sakura)] text-white"
                        : "border-[var(--c-line-2)]"
                    )}
                  >
                    {isLinked && <Check className="size-3" />}
                  </span>
                  <UrStateGlyph status={u.status} className="size-[15px] shrink-0" />
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
  const [linked, setLinked] = useState<Set<string>>(new Set())
  const [ursBySub, setUrsBySub] = useState<Map<string, Ur[]>>(new Map())
  const [groupNames, setGroupNames] = useState<Map<string, string>>(new Map())
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

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

  // 열릴 때: 연결 상태 새로고침 + 현재 세부기능 UR 로드 + 펼침
  useEffect(() => {
    if (!open) return
    listUrIdsForWork(workId)
      .then((ids) => setLinked(new Set(ids)))
      .catch((e) => console.error("[ur-link] 로드 실패:", e))
    if (subFeatureId) void loadSub(subFeatureId)
  }, [open, workId, subFeatureId, loadSub])

  async function toggle(u: Ur) {
    if (linked.has(u.id)) {
      await unlinkUrWork(u.id, workId)
      setLinked((p) => {
        const n = new Set(p)
        n.delete(u.id)
        return n
      })
    } else {
      await linkUrWork(u.id, workId)
      setLinked((p) => new Set(p).add(u.id))
    }
    onChanged()
  }
  async function linkGroup(list: Ur[]) {
    for (const u of list) if (!linked.has(u.id)) await linkUrWork(u.id, workId)
    setLinked((p) => {
      const n = new Set(p)
      list.forEach((u) => n.add(u.id))
      return n
    })
    onChanged()
  }

  function toggleExpand(id: string) {
    setExpanded((p) => {
      const n = new Set(p)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
    const node = nodes.find((x) => x.id === id)
    if (node?.type === "세부기능") void loadSub(id)
  }

  const contents = childrenOf(null).filter((n) => n.type === "컨텐츠")

  // 트리 한 줄(컨텐츠/기능/세부기능). 세부기능 펼침 시 UR 목록.
  function TreeRow({ id, depth }: { id: string; depth: number }) {
    const node = nodes.find((n) => n.id === id)
    if (!node) return null
    // 현재 세부기능은 상단 섹션에서 이미 보이므로 트리에선 생략
    if (node.id === subFeatureId) return null
    const isSub = node.type === "세부기능"
    const kids = childrenOf(node.id).filter(
      (c) => c.type !== "작업" // 작업은 트리에 안 보임
    )
    const open = expanded.has(node.id)
    return (
      <div className="flex flex-col">
        <button
          type="button"
          onClick={() => toggleExpand(node.id)}
          className="flex items-center gap-1 rounded-md py-1 text-left text-[13px] hover:bg-[var(--c-pink-bg)]/40"
          style={{ paddingLeft: depth * 14 + 4 }}
          data-testid="ur-tree-node"
        >
          <ChevronRight
            className={cn(
              "text-muted-foreground size-3.5 shrink-0 transition-transform",
              open && "rotate-90"
            )}
          />
          <span className="truncate">{node.title}</span>
        </button>
        {open && (
          <div style={{ paddingLeft: depth * 14 + 18 }}>
            {isSub ? (
              <SubUrList
                urs={ursBySub.get(node.id) ?? []}
                groupName={(g) => groupNames.get(g) ?? "그룹"}
                linked={linked}
                onToggle={toggle}
                onLinkGroup={linkGroup}
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
            이 작업이 만족시키는 요구사항을 선택하세요. 현재 세부기능이 위에 있고,
            다른 요구사항은 아래 트리에서 펼쳐 고릅니다.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* 현재 세부기능 (기본 펼침) */}
          {subFeatureId && (
            <div className="flex flex-col gap-1" data-testid="ur-link-current">
              <span className="text-[12px] font-bold">
                현재 세부기능 · {subName(subFeatureId)}
              </span>
              <SubUrList
                urs={ursBySub.get(subFeatureId) ?? []}
                groupName={(g) => groupNames.get(g) ?? "그룹"}
                linked={linked}
                onToggle={toggle}
                onLinkGroup={linkGroup}
              />
            </div>
          )}

          {/* 전체 프로젝트 트리 (접힘 기본, 드릴다운) */}
          <div className="flex flex-col gap-0.5 border-t pt-3" data-testid="ur-link-tree">
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
      </DialogContent>
    </Dialog>
  )
}
