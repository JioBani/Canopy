import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react"
import {
  deleteUr,
  deleteUrGroup,
  insertUr,
  insertUrGroup,
  listUrCoverageByFeature,
  listUrGroups,
  listUrs,
  updateUr,
  urKey,
  type Ur,
  type UrCoverage,
  type UrGroup,
  type UrStatus,
} from "@/lib/ur"
import { useNodes } from "@/nodes/NodesProvider"
import { UR_STATE_META, UrStateGlyph } from "@/ur/urStateGlyph"
import { UrStateMenu } from "@/ur/UrStateMenu"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
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
  return (
    <span
      className="text-muted-foreground tnum shrink-0 text-[11px]"
      data-testid="ur-coverage"
      data-uncovered="false"
    >
      작업 {cov.linked_work_count} / 완료 {cov.done_work_count}
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

/** 길면 truncate + hover tooltip. */
function TruncTooltip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="min-w-0 flex-1 truncate text-left text-[13px]">
          {text}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-[360px]">{text}</TooltipContent>
    </Tooltip>
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
  const [loading, setLoading] = useState(true)
  // compact: 그룹 접힘 기본. full: 펼침 기본.
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())
  const [expandedUr, setExpandedUr] = useState<string | null>(null)
  const [addingIn, setAddingIn] = useState<string | "none" | null>(null)
  const [addingGroup, setAddingGroup] = useState(false)
  const [editingUr, setEditingUr] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    const [g, u, c] = await Promise.all([
      listUrGroups(subFeatureId),
      listUrs([subFeatureId]),
      listUrCoverageByFeature(subFeatureId),
    ])
    setGroups(g)
    setUrs(u)
    setCov(new Map(c.map((x) => [x.ur_id, x])))
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
                      <div className="flex items-center gap-1.5 py-1">
                        {editable ? (
                          <UrStateMenu
                            status={u.status}
                            onChange={(s) => void setStatus(u, s)}
                            testid="ur-state"
                          />
                        ) : (
                          <UrStateGlyph
                            status={u.status}
                            className="size-[15px] shrink-0"
                          />
                        )}

                        <code
                          className="tnum shrink-0 font-mono text-[11px] font-semibold"
                          style={{ color: "var(--c-plum)" }}
                          data-testid="ur-key"
                        >
                          {urKey(u.ticket_number)}
                        </code>

                        {editingUr === u.id ? (
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
                              } else if (e.key === "Escape") setEditingUr(null)
                            }}
                            onBlur={() => setEditingUr(null)}
                          />
                        ) : (
                          <>
                            <TruncTooltip text={u.text} />
                            <span data-testid="ur-text" className="sr-only">
                              {u.text}
                            </span>
                          </>
                        )}

                        <CoverageText cov={cov.get(u.id)} />

                        {!compact && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-6"
                              onClick={() =>
                                setExpandedUr(expanded ? null : u.id)
                              }
                              data-testid="ur-expand"
                              title="펼치기"
                            >
                              <ChevronRight
                                className={cn(
                                  "size-3.5 transition-transform",
                                  expanded && "rotate-90"
                                )}
                              />
                            </Button>
                          </>
                        )}
                      </div>

                      {expanded && (
                        <div className="flex flex-col gap-2 px-1.5 pb-2 pl-7">
                          <p className="text-[13px] leading-relaxed whitespace-normal">
                            {u.text}
                          </p>
                          {u.status === "오구현" && (
                            <div
                              className="flex flex-col gap-1 rounded-md border border-[var(--c-ember)]/40 bg-[rgba(216,95,110,0.05)] p-2"
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
                                  className="min-h-14 rounded border bg-transparent p-2 text-[12.5px] outline-none focus-visible:ring-ring/50 focus-visible:ring-2"
                                  data-testid="misimpl-reason"
                                  onBlur={(e) => {
                                    if (
                                      e.target.value !== (u.misimpl_reason ?? "")
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
                          {editable && (
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 gap-1 px-1.5 text-[11px]"
                                onClick={() => setEditingUr(u.id)}
                                data-testid="ur-edit"
                              >
                                <Pencil className="size-3" />수정
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive size-6"
                                onClick={() => void removeUr(u.id)}
                                data-testid="ur-delete"
                              >
                                <Trash2 className="size-3" />
                              </Button>
                            </div>
                          )}
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
