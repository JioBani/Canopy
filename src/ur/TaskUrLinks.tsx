import { useCallback, useEffect, useMemo, useState } from "react"
import { X } from "lucide-react"
import { useNodes } from "@/nodes/NodesProvider"
import {
  linkUrWork,
  listUrIdsForWork,
  listUrs,
  unlinkUrWork,
  urKey,
  type Ur,
} from "@/lib/ur"
import { UrStateGlyph } from "@/ur/urStateGlyph"
import { Button } from "@/components/ui/button"
import { Picker, type PickerGroup } from "@/components/ui/picker"

export function TaskUrLinks({
  workId,
  featureId,
  editable = false,
}: {
  workId: string
  /** 강조할 소유 세부기능 id (작업의 부모). */
  featureId: string | null
  editable?: boolean
}) {
  const { nodes } = useNodes()
  const [urs, setUrs] = useState<Ur[]>([])
  const [linkedIds, setLinkedIds] = useState<string[]>([])

  // UR 은 세부기능 소유 → 세부기능 제목으로 그룹/표시
  const featureTitle = useMemo(() => {
    const map = new Map<string, string>()
    nodes
      .filter((n) => n.type === "세부기능")
      .forEach((n) => map.set(n.id, n.title))
    return map
  }, [nodes])

  const reload = useCallback(async () => {
    const featureIds = nodes
      .filter((n) => n.type === "세부기능")
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

  // 피커: 현재 기능 먼저, 그 외 기능 순. 그룹화.
  const groups: PickerGroup[] = useMemo(() => {
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
      key: fid,
      label:
        (featureTitle.get(fid) ?? "세부기능") +
        (fid === featureId ? " (현재)" : ""),
      items: byFeature.get(fid)!.map((u) => ({
        value: u.id,
        label: `${urKey(u.ticket_number)}  ${u.text}`,
      })),
    }))
  }, [available, featureId, featureTitle])

  return (
    <section className="flex flex-col gap-2.5" data-testid="task-ur-links">
      <h3 className="font-display text-[15px] font-bold">만족시키는 UR</h3>

      <div className="flex flex-col gap-1.5">
        {linked.map((u) => (
          <div
            key={u.id}
            className="group/lu border-border bg-card flex items-start gap-2 rounded-[10px] border px-3 py-2.5"
            data-testid="linked-ur"
          >
            <UrStateGlyph
              status={u.status}
              className="mt-0.5 size-[15px] shrink-0"
            />
            <div className="flex-1">
              <p className="text-[13.5px] leading-relaxed">{u.text}</p>
              <p
                className="mt-0.5 text-[11px]"
                style={{ color: "var(--c-ink-3)" }}
              >
                <code
                  className="tnum font-mono font-semibold"
                  style={{ color: "var(--c-plum)" }}
                  data-testid="ur-key"
                >
                  {urKey(u.ticket_number)}
                </code>
                {" · "}
                {featureTitle.get(u.feature_id) ?? ""}
              </p>
            </div>
            {editable && (
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive size-6 shrink-0 opacity-0 group-hover/lu:opacity-100"
                onClick={async () => {
                  await unlinkUrWork(u.id, workId)
                  await reload()
                }}
                data-testid="unlink-ur"
                title="연결 해제"
              >
                <X className="size-3.5" />
              </Button>
            )}
          </div>
        ))}
        {linked.length === 0 && (
          <p className="text-muted-foreground text-[13px]">
            연결된 UR 이 없습니다.
          </p>
        )}
      </div>

      {editable && (
        <Picker
          triggerLabel="UR 연결"
          placeholder="UR 검색…"
          empty="연결할 UR 이 없습니다."
          groups={groups}
          onPick={async (urId) => {
            await linkUrWork(urId, workId)
            await reload()
          }}
          testid="ur-link-picker"
        />
      )}
    </section>
  )
}
