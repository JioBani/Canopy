import { useCallback, useEffect, useMemo, useState } from "react"
import { Link2, X } from "lucide-react"
import { useNodes } from "@/nodes/NodesProvider"
import {
  listUrIdsForWork,
  listUrs,
  unlinkUrWork,
  updateUr,
  urKey,
  type Ur,
  type UrStatus,
} from "@/lib/ur"
import { UrStateMenu } from "@/ur/UrStateMenu"
import { UrLinkDialog } from "@/ur/UrLinkDialog"
import { Button } from "@/components/ui/button"
import { Section, TicketKey } from "@/components/ds"

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
  const { nodes, refreshProgress } = useNodes()
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

  const changeStatus = useCallback(
    async (urId: string, status: UrStatus) => {
      await updateUr(urId, { status })
      await reload()
      await refreshProgress()
    },
    [reload, refreshProgress]
  )

  return (
    <Section
      icon={<Link2 />}
      title="충족하는 요구사항"
      count={linked.length || undefined}
      flush
      data-testid="task-ur-links"
      actions={
        editable && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDialogOpen(true)}
            data-testid="ur-link-open"
          >
            <Link2 />요구사항 연결
          </Button>
        )
      }
    >
      {linked.length === 0 && (
        <p className="text-body text-fg-3 px-5 py-4">
          연결된 요구사항이 없습니다.
          {editable && " ‘요구사항 연결’로 이 작업이 충족하는 요구사항을 고르세요."}
        </p>
      )}
      {linked.map((u) => (
        <div
          key={u.id}
          className="group/lu border-line grid grid-cols-[20px_minmax(0,1fr)_auto] items-start gap-3 border-t px-5 py-3 first:border-t-0"
          data-testid="linked-ur"
        >
          <div className="mt-px flex">
            <UrStateMenu
              // 상태가 바뀌면 메뉴를 새로 마운트 — 직전 메뉴의 바깥클릭 감지가 남아 재오픈을 즉시 닫는 문제 방지
              key={u.status}
              status={u.status}
              size={18}
              testid="linked-ur-state"
              onChange={(s) => void changeStatus(u.id, s)}
            />
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-body text-fg">
              <TicketKey
                value={urKey(u.ticket_number)}
                className="mr-2 font-medium"
                data-testid="ur-key"
              />
              {u.text}
            </p>
            {featureTitle.get(u.feature_id) && (
              <p className="text-meta text-fg-3">{featureTitle.get(u.feature_id)}</p>
            )}
          </div>
          {editable ? (
            <Button
              variant="ghost"
              size="icon-sm"
              className="hover:text-danger shrink-0 opacity-0 group-hover/lu:opacity-100 focus-visible:opacity-100"
              onClick={async () => {
                await unlinkUrWork(u.id, workId)
                await reload()
              }}
              data-testid="unlink-ur"
              title="연결 해제"
            >
              <X />
            </Button>
          ) : (
            <span />
          )}
        </div>
      ))}

      {editable && (
        <UrLinkDialog
          workId={workId}
          subFeatureId={parentSub}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onChanged={() => void reload()}
        />
      )}
    </Section>
  )
}
