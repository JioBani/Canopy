import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ListChecks,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react"
import {
  deleteUr,
  deleteUrGroup,
  insertUr,
  insertUrGroup,
  listUrCoverageByFeature,
  listUrGroups,
  listUrs,
  listWorkLinksBySubFeature,
  updateUr,
  urKey,
  type Ur,
  type UrCoverage,
  type UrGroup,
  type UrStatus,
} from "@/lib/ur"
import { useNodes } from "@/nodes/NodesProvider"
import { ticketKey } from "@/nodes/nodeGrammar"
import { UR_STATE_META, UrStateGlyph } from "@/ur/urStateGlyph"
import { UrStateMenu } from "@/ur/UrStateMenu"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Markdown } from "@/components/Markdown"
import { Count, EmptyNote, Section, StatusChip, SubLabel, TicketKey } from "@/components/ds"
import { cn } from "@/lib/utils"
import { useQueryParam } from "@/lib/router"

function nextOrder<T extends { sort_order: number }>(items: T[]): number {
  return items.reduce((m, i) => Math.max(m, i.sort_order), -1) + 1
}

function CoverageText({
  cov,
  compact = false,
}: {
  cov: UrCoverage | undefined
  compact?: boolean
}) {
  if (!cov || cov.is_uncovered) {
    return (
      <span
        className="text-meta text-danger inline-flex shrink-0 items-center gap-1 font-semibold whitespace-nowrap"
        data-testid="ur-coverage"
        data-uncovered="true"
        title="연결된 작업 없음"
      >
        <AlertTriangle className="size-3.5" />
        {compact ? "미연결" : "연결된 작업 없음"}
      </span>
    )
  }
  return (
    <span
      className="text-meta text-fg-3 tnum shrink-0 whitespace-nowrap"
      data-testid="ur-coverage"
      data-uncovered="false"
    >
      {compact ? (
        <>
          <b className="text-fg-2 font-semibold">{cov.done_work_count}</b>/{cov.linked_work_count}
        </>
      ) : (
        <>
          작업 <b className="text-fg font-semibold">{cov.linked_work_count}</b>
          {" · "}완료{" "}
          <b className={cn("font-semibold", cov.done_work_count > 0 ? "text-st-done" : "text-fg")}>
            {cov.done_work_count}
          </b>
        </>
      )}
    </span>
  )
}

/** 상태 롤업 (완료 n · 미작업 n · 오작업 n). 0 인 항목 생략. */
function StatusRollup({ urs }: { urs: Ur[] }) {
  const c = { 완료: 0, 미구현: 0, 오구현: 0 } as Record<UrStatus, number>
  urs.forEach((u) => (c[u.status] += 1))
  const parts: { s: UrStatus; n: number }[] = (
    ["완료", "미구현", "오구현"] as UrStatus[]
  )
    .map((s) => ({ s, n: c[s] }))
    .filter((p) => p.n > 0)
  return (
    <span className="flex items-center gap-2.5">
      {parts.map(({ s, n }) => (
        <span
          key={s}
          className="text-meta tnum inline-flex items-center gap-1 font-medium"
          style={{ color: UR_STATE_META[s].color }}
          title={UR_STATE_META[s].label}
        >
          <UrStateGlyph status={s} className="size-3.5" />
          {n}
        </span>
      ))}
    </span>
  )
}

/**
 * 요구사항 설명·히스토리 — 읽기=마크다운, '수정' 토글 시 textarea(노드 설명과 동일 모델).
 * 원문(text)은 한 줄 요약이므로 배경·결정 히스토리·상세 스펙은 여기에 적는다.
 */
function UrDescription({
  ur,
  editable,
  onSaved,
}: {
  ur: Ur
  editable: boolean
  onSaved: () => void | Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(ur.description ?? "")
  // 저장된 값 기준선 — textarea blur 와 '완료' 클릭이 함께 들어와도 중복 쓰기를 막는다.
  const saved = useRef(ur.description ?? null)

  useEffect(() => {
    setDraft(ur.description ?? "")
    saved.current = ur.description ?? null
    setEditing(false)
  }, [ur.id, ur.description])

  async function commit() {
    setEditing(false)
    const next = draft.trim() ? draft : null
    if (next === saved.current) return
    saved.current = next
    await updateUr(ur.id, { description: next })
    await onSaved()
  }

  const has = Boolean(ur.description && ur.description.trim())

  return (
    <div data-testid="ur-description-section">
      <SubLabel
        actions={
          editable && (
            <Button
              type="button"
              variant={editing ? "default" : "ghost"}
              size="sm"
              onMouseDown={(e) => editing && e.preventDefault()}
              onClick={() => (editing ? void commit() : setEditing(true))}
              data-testid="ur-description-edit-toggle"
            >
              {!editing && <Pencil />}
              {editing ? "완료" : has ? "수정" : "추가"}
            </Button>
          )
        }
      >
        설명 · 히스토리
      </SubLabel>

      {editing ? (
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => void commit()}
          placeholder="배경·결정 히스토리·상세 스펙을 마크다운으로 작성하세요 (#, **굵게**, - 목록, | 표 | …)"
          className="text-reading text-fg border-line-strong bg-surface focus-visible:border-brand focus-visible:outline-brand/30 min-h-36 w-full rounded-lg border p-4 outline-none focus-visible:outline-2"
          data-testid="ur-description-input"
        />
      ) : has ? (
        <div
          className="bg-surface border-line rounded-lg border px-4 py-3.5"
          data-testid="ur-description"
        >
          <Markdown>{ur.description!}</Markdown>
        </div>
      ) : (
        <EmptyNote className="bg-surface" data-testid="ur-description-empty">
          {editable
            ? "설명이 없습니다. ‘추가’로 배경·결정 히스토리를 남기세요."
            : "설명이 없습니다."}
        </EmptyNote>
      )}
    </div>
  )
}

/**
 * UR 을 만족시키는 작업 목록 — 링크 id 는 UrSection 진입 시 프리페치(한 방 쿼리)해서
 * prop 으로 받는다. 펼침 시 네트워크 왕복 없이 즉시 렌더. 행 클릭 → 작업으로 이동.
 */
function UrLinkedWorks({ workIds }: { workIds: string[] }) {
  const { nodes, openNode, getStatus } = useNodes()

  const works = workIds
    .map((id) => nodes.find((n) => n.id === id))
    .filter((n): n is NonNullable<typeof n> => Boolean(n))

  return (
    <div>
      <SubLabel count={works.length}>연결된 작업</SubLabel>
      {works.length === 0 ? (
        <EmptyNote className="bg-surface" data-testid="ur-works-empty">
          아직 연결된 작업이 없습니다. 작업 상세의 ‘충족하는 요구사항’에서 연결하세요.
        </EmptyNote>
      ) : (
        <div
          className="bg-surface border-line overflow-hidden rounded-lg border"
          data-testid="ur-works"
        >
          {works.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => openNode(w.id)}
              className="border-line hover:bg-subtle flex w-full items-center gap-3 border-t px-4 py-2.5 text-left transition-colors first:border-t-0"
              data-testid="ur-work-row"
            >
              <StatusChip status={getStatus(w.status_id)} />
              <TicketKey value={ticketKey(w.type, w.ticket_number)} className="hidden sm:inline" />
              <span className="text-body text-fg min-w-0 flex-1 font-medium">{w.title}</span>
              {w.domain && (
                <span className="text-label bg-sunken text-fg-2 shrink-0 rounded-md px-2 py-0.5">
                  {w.domain}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface Props {
  subFeatureId: string
  /** true = 사이드바 컴팩트(보기 전용·그룹 접힘), false = 상세 풀 레이아웃. */
  compact?: boolean
  /** true = 편집 컨트롤(추가/상태변경/수정/삭제) 노출. false = 읽기 전용. */
  editable?: boolean
}

export function UrSection({
  subFeatureId,
  compact = false,
  editable = false,
}: Props) {
  const { refreshProgress } = useNodes()
  const [groups, setGroups] = useState<UrGroup[]>([])
  const [urs, setUrs] = useState<Ur[]>([])
  const [cov, setCov] = useState<Map<string, UrCoverage>>(new Map())
  // ur_id → 연결 작업 id[]. 진입 시 프리페치해 UR 펼침을 즉시 렌더(N+1 제거).
  const [worksByUr, setWorksByUr] = useState<Map<string, string[]>>(new Map())
  const [loading, setLoading] = useState(true)
  // compact: 그룹 접힘 기본. full: 펼침 기본.
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())
  // 펼친 요구사항 = URL ?ur=Requirement-N (공유·새로고침 복원, 변경은 replace). 상세(full)에서만.
  const [urParam, setUrParam] = useQueryParam("ur")
  const expandedUr = compact
    ? null
    : (urs.find((u) => urKey(u.ticket_number) === urParam)?.id ?? null)
  const setExpandedUr = (id: string | null) => {
    const u = id ? urs.find((x) => x.id === id) : undefined
    setUrParam(u ? urKey(u.ticket_number) : null)
  }
  // 딥링크로 들어온 요구사항은 한 번 화면 안으로 스크롤.
  const scrolledRef = useRef<string | null>(null)
  useEffect(() => {
    if (compact || loading || !urParam || scrolledRef.current === urParam) return
    const el = document.querySelector(`[data-ur-key="${CSS.escape(urParam)}"]`)
    if (el) {
      scrolledRef.current = urParam
      el.scrollIntoView({ block: "start", behavior: "smooth" })
    }
  }, [compact, loading, urParam, urs])
  const [addingIn, setAddingIn] = useState<string | "none" | null>(null)
  const [addingGroup, setAddingGroup] = useState(false)
  const [editingUr, setEditingUr] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    const [g, u, c, links] = await Promise.all([
      listUrGroups(subFeatureId),
      listUrs([subFeatureId]),
      listUrCoverageByFeature(subFeatureId),
      listWorkLinksBySubFeature(subFeatureId),
    ])
    setGroups(g)
    setUrs(u)
    setCov(new Map(c.map((x) => [x.ur_id, x])))
    const wm = new Map<string, string[]>()
    for (const { ur_id, work_id } of links) {
      const arr = wm.get(ur_id)
      if (arr) arr.push(work_id)
      else wm.set(ur_id, [work_id])
    }
    setWorksByUr(wm)
    setLoading(false)
  }, [subFeatureId])

  useEffect(() => {
    reload().catch((e) => console.error("[ur] 로드 실패:", e))
  }, [reload])

  const sections = useMemo(() => {
    const arr: { id: string | null; name: string }[] = groups.map((g) => ({
      id: g.id as string | null,
      name: g.name,
    }))
    arr.push({ id: null, name: "미분류" })
    return arr
  }, [groups])

  function ursOf(groupId: string | null) {
    return urs.filter((u) => u.ur_group_id === groupId)
  }
  function isOpen(key: string) {
    return compact ? openGroups.has(key) : !openGroups.has(key)
  }
  function toggleGroup(key: string) {
    setOpenGroups((prev) => {
      const n = new Set(prev)
      if (n.has(key)) n.delete(key)
      else n.add(key)
      return n
    })
  }

  async function addUr(groupId: string | null, text: string) {
    await insertUr({
      feature_id: subFeatureId,
      ur_group_id: groupId,
      text,
      sort_order: nextOrder(ursOf(groupId)),
    })
    setAddingIn(null)
    await reload()
    await refreshProgress() // UR 추가 → 진행도 분모 변화
  }
  async function setStatus(u: Ur, status: UrStatus) {
    await updateUr(u.id, { status })
    await reload()
    await refreshProgress() // UR 완료상태 변화 → 진행도 분자 변화
  }
  async function removeUr(id: string) {
    await deleteUr(id)
    await reload()
    await refreshProgress() // UR 삭제 → 진행도 변화
  }
  async function saveReason(u: Ur, reason: string) {
    await updateUr(u.id, { misimpl_reason: reason })
    await reload()
  }

  const total = urs.length
  const doneCount = urs.filter((u) => u.status === "완료").length

  const groupAdd = editable ? (
    addingGroup ? (
      <div className="w-44">
        <Input
          autoFocus
          placeholder="그룹명 입력 후 Enter"
          className="h-7"
          data-testid="ur-group-name-input"
          onKeyDown={(e) => {
            const v = (e.target as HTMLInputElement).value.trim()
            if (e.key === "Enter" && v) {
              void insertUrGroup(subFeatureId, v, nextOrder(groups)).then(() => {
                setAddingGroup(false)
                void reload()
              })
            } else if (e.key === "Escape") setAddingGroup(false)
          }}
          onBlur={() => setAddingGroup(false)}
        />
      </div>
    ) : (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setAddingGroup(true)}
        data-testid="add-ur-group"
      >
        <Plus />그룹
      </Button>
    )
  ) : null

  const body = loading ? (
    <div className={cn("text-fg-3", compact ? "text-meta p-2" : "text-body px-5 py-4")}>
      요구사항 불러오는 중…
    </div>
  ) : (
    <>
      {sections.map((sec) => {
        const list = ursOf(sec.id)
        // 미분류: 비면 숨김(편집 모드에서만 첫 UR 추가 진입점으로 노출).
        if (sec.id === null && list.length === 0 && !editable) return null
        const key = sec.id ?? "none"
        const open = isOpen(key)
        return (
          <div
            key={key}
            className={cn("flex flex-col", !compact && "border-line border-t first:border-t-0")}
            data-testid="ur-group"
          >
            {/* 그룹 헤더 */}
            <div
              className={cn(
                "group/gh flex items-center gap-2",
                compact ? "min-h-7 px-1" : "bg-subtle min-h-11 px-5 py-1.5"
              )}
            >
              <button
                type="button"
                onClick={() => toggleGroup(key)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                aria-expanded={open}
                data-testid="ur-group-header"
              >
                <ChevronDown
                  className={cn(
                    "text-fg-3 size-4 shrink-0 transition-transform",
                    !open && "-rotate-90"
                  )}
                />
                <span
                  className={cn(
                    "text-fg truncate",
                    compact ? "text-label" : "text-subheading"
                  )}
                  data-testid="ur-group-name"
                >
                  {sec.name}
                </span>
                {!compact && <Count>{list.length}</Count>}
                <StatusRollup urs={list} />
              </button>
              {editable && (
                <>
                  {sec.id && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="hover:text-danger opacity-0 group-hover/gh:opacity-100 focus-visible:opacity-100"
                      onClick={async () => {
                        await deleteUrGroup(sec.id!)
                        await reload()
                      }}
                      data-testid="ur-group-delete"
                      title="그룹 삭제"
                    >
                      <Trash2 />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setAddingIn(sec.id ?? "none")}
                    data-testid="add-ur"
                  >
                    <Plus />요구사항
                  </Button>
                </>
              )}
            </div>

            {open && (
              <div className={cn("flex flex-col", compact && "pl-3")}>
                {list.map((u) => {
                  const expanded = !compact && expandedUr === u.id
                  const editing = editingUr === u.id
                  const toggleExpand = () => {
                    if (!compact && !editing)
                      setExpandedUr(expanded ? null : u.id)
                  }

                  /* ── 사이드바 컴팩트 행 ── */
                  if (compact) {
                    return (
                      <div
                        key={u.id}
                        className="hover:bg-hover flex min-h-8 items-center gap-2 rounded-md px-1.5 py-1"
                        title={`${urKey(u.ticket_number)} ${u.text}`}
                        data-testid="ur-row"
                      >
                        <span data-testid="ur-row-header" className="contents">
                          <UrStateGlyph status={u.status} className="size-4 shrink-0" />
                          <span className="text-body text-fg min-w-0 flex-1 truncate" data-testid="ur-text">
                            {u.text}
                          </span>
                          <CoverageText cov={cov.get(u.id)} compact />
                        </span>
                      </div>
                    )
                  }

                  /* ── 상세 행 ── */
                  return (
                    <div
                      key={u.id}
                      className={cn(
                        "border-line border-t",
                        expanded && "bg-subtle",
                        u.status === "오구현" && "shadow-[inset_3px_0_0_var(--ds-danger)]"
                      )}
                      data-testid="ur-row"
                      data-ur-key={urKey(u.ticket_number)}
                    >
                      {/* 헤더 행 — 전체 클릭으로 펼침/접힘(편집 컨트롤은 전파 차단) */}
                      <div
                        className={cn(
                          "grid grid-cols-[20px_minmax(0,1fr)_18px] items-start gap-3 px-5 py-3",
                          !editing && "hover:bg-subtle cursor-pointer"
                        )}
                        onClick={toggleExpand}
                        data-testid="ur-row-header"
                      >
                        <span className="mt-px flex" onClick={(e) => editable && e.stopPropagation()}>
                          {editable ? (
                            <UrStateMenu
                              status={u.status}
                              onChange={(s) => void setStatus(u, s)}
                              size={18}
                              testid="ur-state"
                            />
                          ) : (
                            <UrStateGlyph status={u.status} className="size-[18px] shrink-0" />
                          )}
                        </span>

                        <div className="flex min-w-0 flex-col gap-1">
                          {editing ? (
                            <span onClick={(e) => e.stopPropagation()}>
                              <Input
                                autoFocus
                                defaultValue={u.text}
                                data-testid="ur-text-input"
                                onKeyDown={(e) => {
                                  const v = (e.target as HTMLInputElement).value.trim()
                                  if (e.key === "Enter" && v) {
                                    void updateUr(u.id, { text: v }).then(() => {
                                      setEditingUr(null)
                                      void reload()
                                    })
                                  } else if (e.key === "Escape") setEditingUr(null)
                                }}
                                onBlur={() => setEditingUr(null)}
                              />
                            </span>
                          ) : (
                            /* 티켓키를 문장 앞에 인라인으로 — 고정폭 칸 없이 문장이 전폭을 쓴다 */
                            <p
                              className={cn(
                                "text-body text-fg",
                                expanded ? "font-medium" : "line-clamp-2"
                              )}
                            >
                              <TicketKey
                                value={urKey(u.ticket_number)}
                                className="mr-2 font-medium"
                                data-testid="ur-key"
                              />
                              <span data-testid="ur-text">{u.text}</span>
                            </p>
                          )}
                          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <CoverageText cov={cov.get(u.id)} />
                          </span>
                        </div>

                        {expanded ? (
                          <ChevronUp className="text-fg-3 mt-0.5 size-[18px]" />
                        ) : (
                          <ChevronRight className="text-fg-3 mt-0.5 size-[18px]" />
                        )}
                      </div>

                      {expanded && (
                        <div
                          className="flex flex-col gap-5 pt-1 pr-5 pb-5 pl-5 sm:pl-[52px]"
                          data-testid="ur-detail"
                        >
                          {/* 설명 · 히스토리 */}
                          <UrDescription ur={u} editable={editable} onSaved={reload} />

                          {u.status === "오구현" && (
                            <div
                              className="border-danger/30 bg-danger-soft flex flex-col gap-2 rounded-lg border p-3.5"
                              data-testid="misimpl-box"
                            >
                              <span className="text-label text-danger inline-flex items-center gap-1.5">
                                <AlertTriangle className="size-4" />
                                오작업 사유
                              </span>
                              {editable ? (
                                <textarea
                                  defaultValue={u.misimpl_reason ?? ""}
                                  placeholder="무엇이 어떻게 잘못 작업됐는지 적어 주세요"
                                  className="text-body text-fg border-line-strong bg-surface focus-visible:border-brand min-h-16 rounded-md border p-3 outline-none"
                                  data-testid="misimpl-reason"
                                  onBlur={(e) => {
                                    if (e.target.value !== (u.misimpl_reason ?? ""))
                                      void saveReason(u, e.target.value)
                                  }}
                                />
                              ) : (
                                <p className="text-body text-fg" data-testid="misimpl-reason">
                                  {u.misimpl_reason || "—"}
                                </p>
                              )}
                            </div>
                          )}

                          {/* 연결된 작업 */}
                          <UrLinkedWorks workIds={worksByUr.get(u.id) ?? []} />

                          {editable && (
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setEditingUr(u.id)}
                                data-testid="ur-edit"
                              >
                                <Pencil />문장 수정
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-danger hover:text-danger"
                                onClick={() => void removeUr(u.id)}
                                data-testid="ur-delete"
                              >
                                <Trash2 />삭제
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}

                {!compact && addingIn === (sec.id ?? "none") && (
                  <div className="border-line border-t px-5 py-3">
                    <Input
                      autoFocus
                      placeholder="요구사항 문장을 입력하고 Enter (Esc 로 닫기)"
                      data-testid="ur-text-input"
                      onKeyDown={(e) => {
                        const v = (e.target as HTMLInputElement).value.trim()
                        if (e.key === "Enter" && v) void addUr(sec.id, v)
                        else if (e.key === "Escape") setAddingIn(null)
                      }}
                      onBlur={() => setAddingIn(null)}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {urs.length === 0 && (
        <p className={cn("text-fg-3", compact ? "text-meta px-2 py-1" : "text-body px-5 py-4")}>
          요구사항이 없습니다.
        </p>
      )}
    </>
  )

  if (compact) {
    return (
      <div className="flex flex-col gap-0.5" data-testid="ur-section">
        {body}
      </div>
    )
  }

  return (
    <Section
      icon={<ListChecks />}
      title="요구사항"
      count={loading ? undefined : total}
      meta={!loading && total > 0 ? `완료 ${doneCount} · 남음 ${total - doneCount}` : undefined}
      actions={groupAdd}
      flush
      data-testid="ur-section"
    >
      {body}
    </Section>
  )
}
