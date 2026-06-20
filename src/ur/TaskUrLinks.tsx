import { useCallback, useEffect, useMemo, useState } from "react"
import { X } from "lucide-react"
import { useNodes } from "@/nodes/NodesProvider"
import {
  linkUrWork,
  listUrIdsForWork,
  listUrs,
  unlinkUrWork,
  type Ur,
} from "@/lib/ur"
import { Button } from "@/components/ui/button"

const selectClass =
  "border-input h-8 w-full rounded-md border bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"

export function TaskUrLinks({
  workId,
  featureId,
}: {
  workId: string
  featureId: string | null
}) {
  const { nodes } = useNodes()
  const [urs, setUrs] = useState<Ur[]>([])
  const [linkedIds, setLinkedIds] = useState<string[]>([])

  const featureTitle = useMemo(() => {
    const map = new Map<string, string>()
    nodes.filter((n) => n.type === "기능").forEach((n) => map.set(n.id, n.title))
    return map
  }, [nodes])

  const reload = useCallback(async () => {
    const featureIds = nodes
      .filter((n) => n.type === "기능")
      .map((n) => n.id)
    const [allUrs, linked] = await Promise.all([
      listUrs(featureIds),
      listUrIdsForWork(workId),
    ])
    setUrs(allUrs)
    setLinkedIds(linked)
  }, [nodes, workId])

  useEffect(() => {
    reload().catch((e) => console.error("[ur-link] 로드 실패:", e))
  }, [reload])

  const linkedSet = new Set(linkedIds)
  const linked = urs.filter((u) => linkedSet.has(u.id))
  const available = urs.filter((u) => !linkedSet.has(u.id))

  // 피커: 현재 기능 먼저, 그 외 기능 순. optgroup 그룹화.
  const groupedAvailable = useMemo(() => {
    const byFeature = new Map<string, Ur[]>()
    for (const u of available) {
      const arr = byFeature.get(u.feature_id) ?? []
      arr.push(u)
      byFeature.set(u.feature_id, arr)
    }
    const featureIds = [...byFeature.keys()].sort((a, b) => {
      if (a === featureId) return -1
      if (b === featureId) return 1
      return (featureTitle.get(a) ?? "").localeCompare(featureTitle.get(b) ?? "")
    })
    return featureIds.map((fid) => ({
      featureId: fid,
      label:
        (featureTitle.get(fid) ?? "기능") +
        (fid === featureId ? " (현재 기능)" : ""),
      items: byFeature.get(fid)!,
    }))
  }, [available, featureId, featureTitle])

  return (
    <div className="flex flex-col gap-2" data-testid="task-ur-links">
      <h3 className="font-display text-base font-bold">만족시키는 UR</h3>

      {linked.map((u) => (
        <div
          key={u.id}
          className="flex items-center gap-2 rounded border px-2 py-1 text-sm"
          data-testid="linked-ur"
        >
          <span className="flex-1">{u.text}</span>
          <span className="text-muted-foreground text-xs">
            {featureTitle.get(u.feature_id) ?? ""}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="size-5"
            onClick={async () => {
              await unlinkUrWork(u.id, workId)
              await reload()
            }}
            data-testid="unlink-ur"
            title="연결 해제"
          >
            <X className="size-3" />
          </Button>
        </div>
      ))}
      {linked.length === 0 && (
        <p className="text-muted-foreground text-xs">연결된 UR 이 없습니다.</p>
      )}

      <select
        className={selectClass}
        value=""
        onChange={async (e) => {
          if (!e.target.value) return
          await linkUrWork(e.target.value, workId)
          await reload()
        }}
        data-testid="ur-link-picker"
      >
        <option value="">+ UR 연결…</option>
        {groupedAvailable.map((g) => (
          <optgroup key={g.featureId} label={g.label}>
            {g.items.map((u) => (
              <option key={u.id} value={u.id}>
                {u.text}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  )
}
