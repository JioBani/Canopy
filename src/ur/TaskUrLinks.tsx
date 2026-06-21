import { useCallback, useEffect, useMemo, useState } from "react"
import { Link2, X } from "lucide-react"
import { useNodes } from "@/nodes/NodesProvider"
import {
  listUrIdsForWork,
  listUrs,
  unlinkUrWork,
  urKey,
  type Ur,
} from "@/lib/ur"
import { UrStateGlyph } from "@/ur/urStateGlyph"
import { UrLinkDialog } from "@/ur/UrLinkDialog"
import { Button } from "@/components/ui/button"

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
  const [dialogOpen, setDialogOpen] = useState(false)

  // 작업의 부모가 세부기능이면 그 id, (마스터데이터 밑이면) null
  const parentSub =
    nodes.find((n) => n.id === featureId)?.type === "세부기능" ? featureId : null

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
        <>
          <Button
            variant="outline"
            size="sm"
            className="w-fit gap-1.5"
            onClick={() => setDialogOpen(true)}
            data-testid="ur-link-open"
          >
            <Link2 className="size-3.5" />UR 연결
          </Button>
          <UrLinkDialog
            workId={workId}
            subFeatureId={parentSub}
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            onChanged={() => void reload()}
          />
        </>
      )}
    </section>
  )
}
