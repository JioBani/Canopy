import { useMemo, useState } from "react"
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  LayoutList,
  Link2,
  Plus,
  Unlink,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { useNodes } from "@/nodes/NodesProvider"
import { ticketKey } from "@/nodes/nodeGrammar"
import { linkUrWork, unlinkUrWork, urKey, type Ur } from "@/lib/ur"
import { memberLabel } from "@/lib/members"
import type { AppNode } from "@/lib/nodes"
import { setQuery } from "@/lib/router"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Count, Section, StatusChip, TicketKey } from "@/components/ds"
import { InlinePicker } from "@/components/InlinePicker"
import { UR_STATE_META, UrStateGlyph } from "@/ur/urStateGlyph"
import type { SubFeatureUrData } from "@/ur/useSubFeatureUrData"

/** 작업 아래 충족 UR 한 줄. 클릭 → 요구사항 탭에서 그 UR 펼침. */
function UrLine({
  u,
  otherWorks,
  onUnlink,
}: {
  u: Ur
  otherWorks: AppNode[]
  onUnlink?: () => void
}) {
  const key = urKey(u.ticket_number)
  return (
    <div
      className="group/ul hover:bg-subtle grid cursor-pointer grid-cols-[18px_minmax(0,1fr)_auto] items-start gap-2.5 rounded-md px-3 py-2 transition-colors"
      onClick={() => setQuery({ tab: "ur", ur: key })}
      title="요구사항 탭에서 열기"
      data-testid="linked-ur-line"
    >
      <span className="mt-0.5 flex" title={UR_STATE_META[u.status].label}>
        <UrStateGlyph status={u.status} className="size-[18px]" />
      </span>
      <p className="text-body text-fg">
        <TicketKey value={key} className="mr-2" />
        {u.text}
      </p>
      <span className="flex items-center gap-1">
        {otherWorks.length > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-label bg-st-prog-bg text-st-prog inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5">
                <Link2 className="size-3.5" />
                작업 {otherWorks.length + 1}
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-[360px]">
              다른 작업도 이 요구사항을 충족합니다:
              {otherWorks.map((o) => (
                <div key={o.id}>
                  {ticketKey(o.type, o.ticket_number)} · {o.title}
                </div>
              ))}
            </TooltipContent>
          </Tooltip>
        )}
        {onUnlink && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="hover:text-danger opacity-0 group-hover/ul:opacity-100 focus-visible:opacity-100"
            title="이 작업과 연결 해제"
            data-testid="unlink-ur-line"
            onClick={(e) => {
              e.stopPropagation()
              onUnlink()
            }}
          >
            <X />
          </Button>
        )}
      </span>
    </div>
  )
}

/**
 * 세부기능 상세 탭2 "작업 → 요구사항": 작업 목록, 각 작업 아래 충족하는 UR.
 * 하단 = 작업에 연결되지 않은 UR 묶음(+ 작업 / 기존 작업에 연결).
 */
export function TaskUrTab({
  subFeatureId,
  data,
  editable,
}: {
  subFeatureId: string
  data: SubFeatureUrData
  editable: boolean
}) {
  const { childrenOf, createChild, openNode, getStatus, getMember, nodes } = useNodes()
  const { urs, worksByUr, ursByWork, loading, reload } = data
  const works = childrenOf(subFeatureId).filter((n) => n.type === "작업")
  const urById = useMemo(() => new Map(urs.map((u) => [u.id, u])), [urs])
  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])
  // 연결 작업 0 인 UR — 미완료(경고 대상)를 위로, 완료는 아래(경고 없음)
  const noWorkUrs = urs
    .filter((u) => !(worksByUr.get(u.id)?.length))
    .sort((a, b) => Number(a.status === "완료") - Number(b.status === "완료"))
  const gapUrs = noWorkUrs.filter((u) => u.status !== "완료")
  const noUrWorks = works.filter((w) => !ursByWork.has(w.id))
  const multiWorkUrs = urs.filter((u) => (worksByUr.get(u.id)?.length ?? 0) > 1).length

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [pickFor, setPickFor] = useState<string | null>(null)
  const [urAction, setUrAction] = useState<{ ur: string; mode: "new" | "existing" } | null>(null)
  const [adding, setAdding] = useState(false)
  const [onlyGaps, setOnlyGaps] = useState(false)

  const toggle = (id: string) =>
    setCollapsed((p) => {
      const n = new Set(p)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  async function link(urId: string, workId: string) {
    await linkUrWork(urId, workId)
    await reload()
    const u = urById.get(urId)
    const w = nodeById.get(workId)
    if (u && w)
      toast.success(`${urKey(u.ticket_number)} ↔ ${ticketKey(w.type, w.ticket_number)} 연결됨`)
  }
  async function unlink(urId: string, workId: string) {
    await unlinkUrWork(urId, workId)
    await reload()
  }
  async function addWorkFor(u: Ur, title: string) {
    const created = await createChild(subFeatureId, "작업", title, { select: false })
    await linkUrWork(u.id, created.id)
    await reload()
    toast.success(
      `${ticketKey(created.type, created.ticket_number)} 생성 · ${urKey(u.ticket_number)} 에 연결됨`,
      { description: title }
    )
  }

  const doneWorks = works.filter((w) => getStatus(w.status_id)?.category === "완료").length
  const list = onlyGaps ? noUrWorks : works

  return (
    <Section
      className="rounded-t-none"
      icon={<LayoutList />}
      title="작업별 충족 요구사항"
      count={works.length}
      meta={`작업 완료 ${doneWorks}/${works.length} · 요구사항 ${urs.length}`}
      flush
      data-testid="task-ur-tab"
      actions={
        <>
          <Button
            variant={onlyGaps ? "default" : "ghost"}
            size="sm"
            aria-pressed={onlyGaps}
            onClick={() => setOnlyGaps((v) => !v)}
          >
            <AlertTriangle />빈 곳만
          </Button>
          {editable && (
            <Button variant="outline" size="sm" onClick={() => setAdding(true)} data-testid="add-work">
              <Plus />작업
            </Button>
          )}
        </>
      }
    >
      <div className="border-line text-meta text-fg-2 flex flex-wrap gap-x-5 gap-y-1 border-b px-5 py-2.5">
        <span>
          작업 없는 미완료 요구사항{" "}
          <b className={cn("tnum font-semibold", gapUrs.length ? "text-danger" : "text-fg")}>
            {gapUrs.length}
          </b>
        </span>
        <span>
          요구사항 없는 작업{" "}
          <b className={cn("tnum font-semibold", noUrWorks.length ? "text-danger" : "text-fg")}>
            {noUrWorks.length}
          </b>
        </span>
        <span>
          작업 2개 이상에 걸친 요구사항 <b className="text-fg tnum font-semibold">{multiWorkUrs}</b>
        </span>
      </div>

      {adding && (
        <div className="border-line border-b px-5 py-3">
          <Input
            autoFocus
            placeholder="작업 제목 입력 후 Enter — 요구사항 연결은 나중에 (Esc 로 닫기)"
            data-testid="add-work-input"
            onKeyDown={(e) => {
              const v = (e.target as HTMLInputElement).value.trim()
              if (e.key === "Enter" && v) void createChild(subFeatureId, "작업", v)
              else if (e.key === "Escape") setAdding(false)
            }}
            onBlur={() => setAdding(false)}
          />
        </div>
      )}

      {loading && <p className="text-body text-fg-3 px-5 py-4">불러오는 중…</p>}
      {!loading && works.length === 0 && !adding && (
        <p className="text-body text-fg-3 px-5 py-4">
          작업이 없습니다. <b className="text-fg-2 font-semibold">+ 작업</b>으로 추가하세요.
        </p>
      )}

      {!loading &&
        list.map((w) => {
          const linked = (ursByWork.get(w.id) ?? [])
            .map((id) => urById.get(id))
            .filter((x): x is Ur => Boolean(x))
          const open = !collapsed.has(w.id)
          const empty = linked.length === 0
          const urDone = linked.filter((u) => u.status === "완료").length
          const who = getMember(w.assignee_id)
          const linkedIds = new Set(linked.map((u) => u.id))
          return (
            <div
              key={w.id}
              className={cn(
                "border-line border-t first:border-t-0",
                empty && "shadow-[inset_3px_0_0_var(--ds-danger)]"
              )}
              data-testid="task-ur-row"
            >
              <div className="grid grid-cols-[18px_minmax(0,1fr)_auto] items-start gap-x-2.5 px-5 pt-3 pb-2">
                <button
                  type="button"
                  onClick={() => toggle(w.id)}
                  disabled={empty}
                  aria-label={open ? "요구사항 접기" : "요구사항 펼치기"}
                  className="text-fg-3 hover:text-fg mt-0.5 disabled:invisible"
                >
                  {open ? <ChevronDown className="size-[18px]" /> : <ChevronRight className="size-[18px]" />}
                </button>
                <button
                  type="button"
                  className="flex min-w-0 flex-col gap-1 text-left"
                  onClick={() => openNode(w.id)}
                  data-testid="work-row"
                >
                  <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <StatusChip status={getStatus(w.status_id)} size="sm" data-testid="status-badge" />
                    <TicketKey value={ticketKey(w.type, w.ticket_number)} />
                    <span className="text-body text-fg font-semibold hover:underline">{w.title}</span>
                  </span>
                  <span className="text-meta text-fg-3 flex flex-wrap items-center gap-x-2">
                    {empty ? (
                      <span className="text-danger inline-flex items-center gap-1 font-semibold">
                        <AlertTriangle className="size-3.5" />
                        충족하는 요구사항 없음
                      </span>
                    ) : (
                      <span>
                        요구사항 <b className="text-fg font-semibold">{linked.length}</b> · 완료{" "}
                        <b className={cn("font-semibold", urDone ? "text-st-done" : "text-fg")}>{urDone}</b>
                        {!open && " · 접힘"}
                      </span>
                    )}
                    {w.domain && <span>· {w.domain}</span>}
                    {who && <span>· 담당 {memberLabel(who)}</span>}
                  </span>
                </button>
                {editable && (
                  <Button
                    variant={empty ? "outline" : "ghost"}
                    size="sm"
                    className={cn(empty && "border-danger/40 text-danger hover:text-danger")}
                    onClick={() => {
                      setPickFor(pickFor === w.id ? null : w.id)
                      setCollapsed((p) => {
                        const n = new Set(p)
                        n.delete(w.id)
                        return n
                      })
                    }}
                    data-testid="work-link-ur"
                  >
                    <Link2 />요구사항 연결
                  </Button>
                )}
              </div>

              {(open || pickFor === w.id) && (linked.length > 0 || pickFor === w.id) && (
                <div className="pr-5 pb-3 pl-5 sm:pl-[48px]">
                  <div className="border-line-strong flex flex-col gap-0.5 border-l-2 pl-2">
                    {linked.map((u) => (
                      <UrLine
                        key={u.id}
                        u={u}
                        otherWorks={(worksByUr.get(u.id) ?? [])
                          .filter((id) => id !== w.id)
                          .map((id) => nodeById.get(id))
                          .filter((x): x is AppNode => Boolean(x))}
                        onUnlink={editable ? () => void unlink(u.id, w.id) : undefined}
                      />
                    ))}
                    {pickFor === w.id && (
                      <InlinePicker
                        items={urs
                          .filter((u) => !linkedIds.has(u.id))
                          .sort(
                            (a, b) =>
                              Number(worksByUr.has(a.id)) - Number(worksByUr.has(b.id)) ||
                              a.ticket_number - b.ticket_number
                          )}
                        placeholder={`${ticketKey(w.type, w.ticket_number)} 가 충족하는 요구사항 검색 — 미연결이 위에`}
                        empty="연결할 요구사항이 없습니다."
                        render={(u) => ({
                          key: urKey(u.ticket_number),
                          text: u.text,
                          hint: worksByUr.has(u.id) ? (
                            <span className="text-meta text-fg-3 shrink-0">
                              작업 {worksByUr.get(u.id)!.length}
                            </span>
                          ) : (
                            <span className="text-meta text-danger shrink-0 font-semibold">미연결</span>
                          ),
                        })}
                        onPick={(u) => void link(u.id, w.id)}
                        onClose={() => setPickFor(null)}
                        testid="ur-picker"
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}

      {!loading && noWorkUrs.length > 0 && (
        <div className="border-line border-t" data-testid="unlinked-urs">
          <div
            className={cn(
              "flex min-h-11 items-center gap-2 px-5 py-1.5",
              gapUrs.length ? "bg-danger-soft" : "bg-subtle"
            )}
          >
            <Unlink className={cn("size-4", gapUrs.length ? "text-danger" : "text-fg-3")} />
            <span className="text-subheading text-fg">작업에 연결되지 않은 요구사항</span>
            <Count>{noWorkUrs.length}</Count>
          </div>
          <div className="flex flex-col px-5 py-2">
            {noWorkUrs.map((u) => (
              <div key={u.id} className="border-line border-t py-1 first:border-t-0">
                <div className="flex flex-wrap items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <UrLine u={u} otherWorks={[]} />
                  </div>
                  {editable && (
                    <div className="flex shrink-0 gap-1 pt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setUrAction({ ur: u.id, mode: "new" })}
                        data-testid="ur-add-work"
                      >
                        <Plus />작업
                      </Button>
                      {works.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setUrAction({ ur: u.id, mode: "existing" })}
                          data-testid="ur-link-existing"
                        >
                          <Link2 />기존 작업에 연결
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                {urAction?.ur === u.id && urAction.mode === "new" && (
                  <div className="py-1.5 pl-3">
                    <Input
                      autoFocus
                      placeholder={`새 작업 제목 입력 후 Enter — ${urKey(u.ticket_number)} 에 자동 연결 (Esc 로 닫기)`}
                      data-testid="ur-add-work-input"
                      onKeyDown={(e) => {
                        const v = (e.target as HTMLInputElement).value.trim()
                        if (e.key === "Enter" && v) {
                          setUrAction(null)
                          void addWorkFor(u, v)
                        } else if (e.key === "Escape") setUrAction(null)
                      }}
                      onBlur={() => setUrAction(null)}
                    />
                  </div>
                )}
                {urAction?.ur === u.id && urAction.mode === "existing" && (
                  <div className="pl-3">
                    <InlinePicker
                      items={works}
                      placeholder={`${urKey(u.ticket_number)} 를 충족하는 작업 검색`}
                      render={(t) => ({
                        key: ticketKey(t.type, t.ticket_number),
                        text: t.title,
                        hint: (
                          <span className="text-meta text-fg-3 shrink-0">
                            요구사항 {ursByWork.get(t.id)?.length ?? 0}
                          </span>
                        ),
                      })}
                      onPick={(t) => {
                        setUrAction(null)
                        void link(u.id, t.id)
                      }}
                      onClose={() => setUrAction(null)}
                      testid="work-picker"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </Section>
  )
}
