import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  ChevronRight,
  ChevronUp,
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
import { cn } from "@/lib/utils"

function nextOrder<T extends { sort_order: number }>(items: T[]): number {
  return items.reduce((m, i) => Math.max(m, i.sort_order), -1) + 1
}

function CoverageText({ cov }: { cov: UrCoverage | undefined }) {
  if (!cov || cov.is_uncovered) {
    return (
      <span
        className="inline-flex shrink-0 items-center gap-0.5 text-[11px]"
        style={{ color: "var(--c-ember)" }}
        data-testid="ur-coverage"
        data-uncovered="true"
      >
        <AlertTriangle className="size-3" /> 미커버
      </span>
    )
  }
  const doneOn = cov.done_work_count > 0
  return (
    <span
      className="tnum shrink-0 text-[12px]"
      style={{ color: "#9AA4B2" }}
      data-testid="ur-coverage"
      data-uncovered="false"
    >
      작업{" "}
      <b style={{ color: "#6B7684", fontWeight: 700 }}>
        {cov.linked_work_count}
      </b>{" "}
      / 완료{" "}
      <b style={{ color: doneOn ? "#D6398E" : "#6B7684", fontWeight: 700 }}>
        {cov.done_work_count}
      </b>
    </span>
  )
}

/** 상태 롤업 칩 (완료 n · 미구현 n · ⚠오구현 n). 0 인 항목 생략. */
function StatusRollup({ urs }: { urs: Ur[] }) {
  const c = { 완료: 0, 미구현: 0, 오구현: 0 } as Record<UrStatus, number>
  urs.forEach((u) => (c[u.status] += 1))
  const parts: { s: UrStatus; n: number }[] = (
    ["완료", "미구현", "오구현"] as UrStatus[]
  )
    .map((s) => ({ s, n: c[s] }))
    .filter((p) => p.n > 0)
  return (
    <span className="flex items-center gap-1.5">
      {parts.map(({ s, n }) => (
        <span
          key={s}
          className="tnum inline-flex items-center gap-0.5 text-[11px]"
          style={{ color: UR_STATE_META[s].color }}
        >
          <UrStateGlyph status={s} className="size-3" />
          {n}
        </span>
      ))}
    </span>
  )
}

/** 완료 체크(채움) / 미완료 체크(빈칸) / 완료 별 — 디자인 스펙 인라인 SVG. */
function DoneCheck() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="#D6398E"
      stroke="#fff"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mt-px shrink-0"
    >
      <rect x="3" y="3" width="18" height="18" rx="5" stroke="none" />
      <path d="M7 12.4l3 3 6.5-7" />
    </svg>
  )
}
function EmptyCheck() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#BAC2CE"
      strokeWidth="2"
      className="mt-px shrink-0"
    >
      <rect x="4" y="4" width="16" height="16" rx="4" />
    </svg>
  )
}
function StarIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="#D6398E">
      <path d="M12 2l2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 17.7 5.9 20.4l1.5-6.8L2.2 9l6.9-.7z" />
    </svg>
  )
}

/** "만족시키는 작업" 라벨 + 개수 pill (본문과 다른 블루-그레이 액센트). */
function WorksLabel({ count }: { count: number }) {
  return (
    <div className="mt-5 mb-2.5 flex items-center gap-[7px]">
      <span
        className="size-[5px] rounded-full"
        style={{ background: "#8AA0C4" }}
      />
      <span
        className="text-[11.5px] font-bold tracking-[.04em]"
        style={{ color: "#7C8AA0" }}
      >
        만족시키는 작업
      </span>
      <span
        className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[9px] px-[5px] text-[11px] font-bold"
        style={{ background: "#EDF1F7", color: "#7C8AA0" }}
      >
        {count}
      </span>
    </div>
  )
}

/**
 * UR 을 만족시키는 작업 목록 — 링크 id 는 UrSection 진입 시 프리페치(한 방 쿼리)해서
 * prop 으로 받는다. 펼침 시 네트워크 왕복 없이 즉시 렌더(작업 상세는 nodes 컨텍스트에서).
 * 흰색 작업 카드(본문 로즈 카드와 배경/보더로 구분). 카드 클릭 → 작업으로 이동.
 * 체크 표식은 작업의 상태 카테고리(완료 여부) 반영(읽기 전용 — 실제 상태변경은 작업 상세에서).
 */
function UrLinkedWorks({ workIds }: { workIds: string[] }) {
  const { nodes, openNode, getStatus } = useNodes()

  const works = workIds
    .map((id) => nodes.find((n) => n.id === id))
    .filter((n): n is NonNullable<typeof n> => Boolean(n))

  return (
    <>
      <WorksLabel count={works.length} />
      {works.length === 0 ? (
        <div
          className="rounded-[9px] border border-dashed p-4 text-center text-[13px]"
          style={{ borderColor: "#DCE2EB", color: "#9AA4B2" }}
          data-testid="ur-works-empty"
        >
          아직 등록된 작업이 없습니다.
        </div>
      ) : (
        <div className="flex flex-col gap-2" data-testid="ur-works">
          {works.map((w) => {
            const done = getStatus(w.status_id)?.category === "완료"
            return (
              <button
                key={w.id}
                type="button"
                onClick={() => openNode(w.id)}
                className="flex items-start gap-[11px] rounded-[9px] border bg-white px-[13px] py-[11px] text-left transition-colors hover:bg-[#F7F9FC]"
                style={{ borderColor: "#E7ECF3" }}
                data-testid="ur-work-row"
              >
                {done ? <DoneCheck /> : <EmptyCheck />}
                <span
                  className="mt-px shrink-0 rounded-[5px] px-[7px] py-0.5 font-mono text-[12px] font-semibold"
                  style={{ color: "#5B6B7C", background: "#EEF1F6" }}
                >
                  {ticketKey(w.type, w.ticket_number)}
                </span>
                <span
                  className="min-w-0 flex-1 text-[13.5px] leading-[1.6]"
                  style={{ color: "#3C4653" }}
                >
                  {w.title}
                </span>
                {done && (
                  <span
                    className="mt-px inline-flex shrink-0 items-center gap-1 text-[12px] font-bold"
                    style={{ color: "#D6398E" }}
                  >
                    <StarIcon />
                    완료
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </>
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
  const [expandedUr, setExpandedUr] = useState<string | null>(null)
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

  if (loading) {
    return (
      <div className="text-muted-foreground p-2 text-xs" data-testid="ur-section">
        UR 불러오는 중…
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5" data-testid="ur-section">
      {editable && (
        <div className="flex items-center justify-end">
          {addingGroup ? (
            <div className="w-44">
              <Input
                autoFocus
                placeholder="그룹명"
                className="h-7"
                data-testid="ur-group-name-input"
                onKeyDown={(e) => {
                  const v = (e.target as HTMLInputElement).value.trim()
                  if (e.key === "Enter" && v) {
                    void insertUrGroup(subFeatureId, v, nextOrder(groups)).then(
                      () => {
                        setAddingGroup(false)
                        void reload()
                      }
                    )
                  } else if (e.key === "Escape") setAddingGroup(false)
                }}
                onBlur={() => setAddingGroup(false)}
              />
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => setAddingGroup(true)}
              data-testid="add-ur-group"
            >
              <Plus className="size-3.5" />그룹
            </Button>
          )}
        </div>
      )}

      {sections.map((sec) => {
        const list = ursOf(sec.id)
        // 미분류: 비면 숨김(편집 모드에서만 첫 UR 추가 진입점으로 노출).
        if (sec.id === null && list.length === 0 && !editable) return null
        const key = sec.id ?? "none"
        const open = isOpen(key)
        return (
          <div key={key} className="flex flex-col" data-testid="ur-group">
            {/* 그룹 헤더 */}
            <div className="group/gh flex items-center gap-1.5 py-1">
              <button
                type="button"
                onClick={() => toggleGroup(key)}
                className="flex min-w-0 flex-1 items-center gap-1"
                data-testid="ur-group-header"
              >
                <ChevronRight
                  className={cn(
                    "text-muted-foreground size-3.5 shrink-0 transition-transform",
                    open && "rotate-90"
                  )}
                />
                <span
                  className="truncate text-[13px] font-semibold"
                  data-testid="ur-group-name"
                >
                  {sec.name}
                </span>
                <StatusRollup urs={list} />
              </button>
              {editable && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 gap-1 px-1.5 text-[11px]"
                    onClick={() => setAddingIn(sec.id ?? "none")}
                    data-testid="add-ur"
                  >
                    <Plus className="size-3" />UR
                  </Button>
                  {sec.id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive size-6 opacity-0 group-hover/gh:opacity-100"
                      onClick={async () => {
                        await deleteUrGroup(sec.id!)
                        await reload()
                      }}
                      data-testid="ur-group-delete"
                      title="그룹 삭제"
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  )}
                </>
              )}
            </div>

            {open && (
              <div className="flex flex-col gap-0.5 pl-4">
                {list.map((u) => {
                  const expanded = !compact && expandedUr === u.id
                  const editing = editingUr === u.id
                  const toggleExpand = () => {
                    if (!compact && !editing)
                      setExpandedUr(expanded ? null : u.id)
                  }
                  return (
                    <div
                      key={u.id}
                      className={cn(
                        "rounded-md",
                        u.status === "오구현" &&
                          "border-l-2 border-[var(--c-ember)] bg-[rgba(216,95,110,0.05)] pl-1.5"
                      )}
                      data-testid="ur-row"
                    >
                      {/* 헤더 행 — 전체 클릭으로 펼침/접힘(편집 컨트롤은 전파 차단) */}
                      <div
                        className={cn(
                          "flex items-center gap-2.5 py-1.5",
                          !compact && !editing && "cursor-pointer"
                        )}
                        onClick={toggleExpand}
                        data-testid="ur-row-header"
                      >
                        {editable ? (
                          <span
                            className="inline-flex shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <UrStateMenu
                              status={u.status}
                              onChange={(s) => void setStatus(u, s)}
                              testid="ur-state"
                            />
                          </span>
                        ) : (
                          <UrStateGlyph
                            status={u.status}
                            className="size-[15px] shrink-0"
                          />
                        )}

                        <code
                          className="tnum shrink-0 rounded-md px-2 py-0.5 font-mono text-[12px] font-semibold"
                          style={{ color: "#5B6B7C", background: "#EEF1F6" }}
                          data-testid="ur-key"
                        >
                          {urKey(u.ticket_number)}
                        </code>

                        {editing ? (
                          <span
                            className="flex-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Input
                              autoFocus
                              defaultValue={u.text}
                              className="h-7"
                              data-testid="ur-text-input"
                              onKeyDown={(e) => {
                                const v = (
                                  e.target as HTMLInputElement
                                ).value.trim()
                                if (e.key === "Enter" && v) {
                                  void updateUr(u.id, { text: v }).then(() => {
                                    setEditingUr(null)
                                    void reload()
                                  })
                                } else if (e.key === "Escape")
                                  setEditingUr(null)
                              }}
                              onBlur={() => setEditingUr(null)}
                            />
                          </span>
                        ) : expanded ? (
                          <>
                            <span
                              className="min-w-0 flex-1 text-[12px] font-semibold tracking-[.02em]"
                              style={{ color: "#AAB3C0" }}
                            >
                              요구사항 상세
                            </span>
                            <span data-testid="ur-text" className="sr-only">
                              {u.text}
                            </span>
                          </>
                        ) : (
                          <>
                            <span
                              className="min-w-0 flex-1 truncate text-[14px]"
                              style={{ color: "#3C4653" }}
                            >
                              {u.text}
                            </span>
                            <span data-testid="ur-text" className="sr-only">
                              {u.text}
                            </span>
                          </>
                        )}

                        <CoverageText cov={cov.get(u.id)} />

                        {!compact &&
                          (expanded ? (
                            <ChevronUp
                              className="size-4 shrink-0"
                              style={{ color: "#98A2B0" }}
                            />
                          ) : (
                            <ChevronRight
                              className="size-4 shrink-0"
                              style={{ color: "#98A2B0" }}
                            />
                          ))}
                      </div>

                      {expanded && (
                        <div
                          className="px-1.5 pb-4 pl-7"
                          data-testid="ur-detail"
                        >
                          {/* 커넥터 라인 — 이 내용이 해당 요구사항에 속함을 시각화 */}
                          <div
                            className="border-l-2 pt-1.5 pl-[22px]"
                            style={{ borderColor: "#EDE1E9" }}
                          >
                            {/* 요구사항 본문 */}
                            <div className="mb-2 flex items-center gap-[7px]">
                              <span
                                className="size-[5px] rounded-full"
                                style={{ background: "#E36BA6" }}
                              />
                              <span
                                className="text-[11.5px] font-bold tracking-[.04em]"
                                style={{ color: "#B0788F" }}
                              >
                                요구사항 본문
                              </span>
                            </div>
                            <div
                              className="rounded-lg border px-[15px] py-[13px] text-[14.5px] leading-[1.75] whitespace-normal"
                              style={{
                                background: "#FDF3F8",
                                borderColor: "#F6DDEB",
                                color: "#38424E",
                              }}
                            >
                              {u.text}
                            </div>

                            {u.status === "오구현" && (
                              <div
                                className="mt-3 flex flex-col gap-1 rounded-md border border-[var(--c-ember)]/40 bg-[rgba(216,95,110,0.05)] p-2"
                                data-testid="misimpl-box"
                              >
                                <span
                                  className="text-[11px] font-semibold"
                                  style={{ color: "var(--c-ember)" }}
                                >
                                  ⚠ 오작업 사유
                                </span>
                                {editable ? (
                                  <textarea
                                    defaultValue={u.misimpl_reason ?? ""}
                                    placeholder="무엇이 어떻게 잘못 작업됐는지…"
                                    className="min-h-14 rounded border bg-transparent p-2 text-[12.5px] outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                                    data-testid="misimpl-reason"
                                    onBlur={(e) => {
                                      if (
                                        e.target.value !==
                                        (u.misimpl_reason ?? "")
                                      )
                                        void saveReason(u, e.target.value)
                                    }}
                                  />
                                ) : (
                                  <p
                                    className="text-[12.5px] whitespace-normal"
                                    data-testid="misimpl-reason"
                                  >
                                    {u.misimpl_reason || "—"}
                                  </p>
                                )}
                              </div>
                            )}

                            {/* 만족시키는 작업 */}
                            <UrLinkedWorks workIds={worksByUr.get(u.id) ?? []} />

                            {editable && (
                              <div className="mt-3.5 flex gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setEditingUr(u.id)}
                                  className="inline-flex items-center gap-1.5 rounded-[7px] border bg-white px-[11px] py-1.5 text-[12.5px] font-semibold transition-colors hover:bg-[#F5F7FA]"
                                  style={{
                                    borderColor: "#E3E8EF",
                                    color: "#6B7684",
                                  }}
                                  data-testid="ur-edit"
                                >
                                  <Pencil className="size-3.5" />수정
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void removeUr(u.id)}
                                  className="inline-flex items-center gap-1.5 rounded-[7px] border bg-white px-[11px] py-1.5 text-[12.5px] font-semibold transition-colors hover:bg-[#FCF3F5]"
                                  style={{
                                    borderColor: "#E3E8EF",
                                    color: "#B9707E",
                                  }}
                                  data-testid="ur-delete"
                                >
                                  <Trash2 className="size-3.5" />삭제
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}

                {!compact && addingIn === (sec.id ?? "none") && (
                  <Input
                    autoFocus
                    placeholder="요구사항 입력 후 Enter"
                    className="h-7"
                    data-testid="ur-text-input"
                    onKeyDown={(e) => {
                      const v = (e.target as HTMLInputElement).value.trim()
                      if (e.key === "Enter" && v) void addUr(sec.id, v)
                      else if (e.key === "Escape") setAddingIn(null)
                    }}
                    onBlur={() => setAddingIn(null)}
                  />
                )}
              </div>
            )}
          </div>
        )
      })}

      {urs.length === 0 && (
        <p className="text-muted-foreground py-1 text-xs">요구사항이 없습니다.</p>
      )}
    </div>
  )
}
