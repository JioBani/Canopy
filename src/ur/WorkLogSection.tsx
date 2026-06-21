import { useCallback, useEffect, useState } from "react"
import { Pause, Pencil, Play, Trash2 } from "lucide-react"
import { useNodes } from "@/nodes/NodesProvider"
import { Markdown } from "@/components/Markdown"
import { memberLabel } from "@/lib/members"
import {
  deleteWorkLog,
  formatMinutes,
  listWorkLogs,
  loggedMinutes,
  startWorkLog,
  stopWorkLog,
  updateWorkLog,
  type WorkLog,
} from "@/lib/workLog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FilterSelect } from "@/components/ui/filter-select"

/** now-앵커 라이브 시계: started_at 기준 경과(초). 1초마다 갱신(표시용). */
function useNowTick(active: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [active])
  return now
}

function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = s % 60
  const pad = (n: number) => String(n).padStart(2, "0")
  return h > 0 ? `${h}:${pad(m)}:${pad(ss)}` : `${m}:${pad(ss)}`
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function WorkLogSection({
  workId,
  assigneeId,
  baseMinutes,
}: {
  workId: string
  assigneeId: string | null
  baseMinutes: number
}) {
  const { members, updateFields } = useNodes()
  const [logs, setLogs] = useState<WorkLog[]>([])
  const [editingTotal, setEditingTotal] = useState(false)
  const [editingLogId, setEditingLogId] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLogs(await listWorkLogs(workId))
  }, [workId])
  useEffect(() => {
    reload().catch((e) => console.error("[worklog] 로드 실패:", e))
    setEditingTotal(false)
    setEditingLogId(null)
  }, [reload])

  const active = logs.find((l) => !l.ended_at)
  const now = useNowTick(!!active)
  const logged = loggedMinutes(logs)
  const total = baseMinutes + logged
  // 최근순(시작 시각 내림차순) 표시
  const ordered = [...logs].sort(
    (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
  )

  const memberItems = members.map((m) => ({ value: m.id, label: memberLabel(m) }))
  const nameOf = (id: string | null) => {
    if (!id) return "미지정"
    const m = members.find((x) => x.id === id)
    return m ? memberLabel(m) : "미지정"
  }

  async function start() {
    const created = await startWorkLog(workId, assigneeId ?? null)
    await reload()
    setEditingLogId(created.id) // 새 로그를 바로 편집(내용 입력) 상태로
  }
  async function stop() {
    if (!active) return
    await stopWorkLog(active.id, active.started_at)
    await reload()
    setEditingLogId(null)
  }

  return (
    <section className="flex flex-col gap-3" data-testid="work-log-section">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-display text-[15px] font-bold">작업 시간</h3>

        {/* 총 작업 시간 — 텍스트 + 작은 수정 토글 */}
        {editingTotal ? (
          <label className="flex items-center gap-1.5 text-[13px]">
            <span style={{ color: "var(--c-ink-3)" }}>총</span>
            <Input
              type="number"
              autoFocus
              defaultValue={total}
              className="h-7 w-20"
              data-testid="work-log-total-input"
              onBlur={(e) => {
                const v = Math.max(0, Math.round(Number(e.target.value) || 0))
                if (v !== total)
                  void updateFields(workId, { time_spent_minutes: v - logged })
              }}
            />
            <span style={{ color: "var(--c-ink-3)" }}>분</span>
          </label>
        ) : (
          <span
            className="tnum text-[13px] font-semibold"
            style={{ color: "var(--c-plum)" }}
            data-testid="work-log-total"
          >
            총 {formatMinutes(total)}
          </span>
        )}
        <Button
          variant={editingTotal ? "default" : "ghost"}
          size="icon"
          className="size-7"
          onClick={() => setEditingTotal((v) => !v)}
          data-testid="work-log-total-edit"
          title="총 작업 시간 보정"
        >
          <Pencil className="size-3.5" />
        </Button>

        {/* 시작/종료 (즉시 동작) */}
        {active ? (
          <span className="ml-auto flex items-center gap-2">
            <span
              className="tnum text-[13px] font-semibold"
              style={{ color: "var(--c-ember)" }}
              data-testid="work-log-active"
            >
              ● {clock((now - new Date(active.started_at).getTime()) / 1000)}
            </span>
            <Button size="sm" onClick={() => void stop()} data-testid="work-log-stop">
              <Pause className="size-3.5" />종료
            </Button>
          </span>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="ml-auto"
            onClick={() => void start()}
            data-testid="work-log-start"
          >
            <Play className="size-3.5" />작업 시작
          </Button>
        )}
      </div>

      {/* 로그 목록 — 내용은 댓글처럼 아래에(마크다운) */}
      <div className="flex flex-col gap-2">
        {ordered.length === 0 && (
          <p className="text-muted-foreground text-[13px]">작업 로그가 없습니다.</p>
        )}
        {ordered.map((l) => {
          const editing = editingLogId === l.id
          return (
            <div
              key={l.id}
              className="border-border bg-card flex flex-col gap-2 rounded-[10px] border px-3 py-2.5 text-[13px]"
              data-testid="work-log-row"
            >
              {/* 헤더 줄: 시간 · duration · 작업자 · 수정/삭제 */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="tnum shrink-0" style={{ color: "var(--c-ink-3)" }}>
                  {timeLabel(l.started_at)}
                  {" → "}
                  {l.ended_at ? timeLabel(l.ended_at) : "진행 중"}
                </span>

                {l.ended_at &&
                  (editing ? (
                    <label className="flex items-center gap-1">
                      <Input
                        type="number"
                        defaultValue={l.duration_minutes ?? 0}
                        className="h-7 w-16"
                        data-testid="work-log-duration-input"
                        onBlur={(e) => {
                          const v = Math.max(0, Math.round(Number(e.target.value) || 0))
                          if (v !== (l.duration_minutes ?? 0))
                            void updateWorkLog(l.id, { duration_minutes: v }).then(reload)
                        }}
                      />
                      <span style={{ color: "var(--c-ink-3)" }}>분</span>
                    </label>
                  ) : (
                    <span className="tnum font-semibold" data-testid="work-log-duration">
                      {formatMinutes(l.duration_minutes ?? 0)}
                    </span>
                  ))}

                {editing ? (
                  <FilterSelect
                    value={l.member_id ?? ""}
                    onChange={(v) =>
                      void updateWorkLog(l.id, { member_id: v || null }).then(reload)
                    }
                    allLabel="미지정"
                    items={memberItems}
                    testid="work-log-member"
                  />
                ) : (
                  <span
                    className="rounded-md px-1.5 py-0.5 text-[11.5px]"
                    style={{ background: "var(--c-pink-bg)", color: "var(--c-plum)" }}
                    data-testid="work-log-member"
                  >
                    {nameOf(l.member_id)}
                  </span>
                )}

                <span className="ml-auto flex items-center gap-1">
                  <Button
                    variant={editing ? "default" : "ghost"}
                    size="sm"
                    className="h-7 gap-1 text-xs"
                    onClick={() => setEditingLogId(editing ? null : l.id)}
                    data-testid="work-log-edit"
                  >
                    {!editing && <Pencil className="size-3" />}
                    {editing ? "완료" : "수정"}
                  </Button>
                  {editing && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive size-7"
                      onClick={() => void deleteWorkLog(l.id).then(reload)}
                      data-testid="work-log-delete"
                      title="로그 삭제"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </span>
              </div>

              {/* 내용(댓글) — 아래에, 읽기=마크다운 / 편집=textarea */}
              {editing ? (
                <textarea
                  defaultValue={l.note ?? ""}
                  placeholder="무슨 작업을 했는지 (마크다운, 선택)"
                  className="min-h-20 rounded-[8px] border border-[var(--c-sakura)]/50 bg-[#F5F2F4] p-2.5 text-[13px] leading-relaxed outline-none ring-2 ring-[var(--c-sakura)]/20 focus-visible:ring-ring/50"
                  data-testid="work-log-note-input"
                  onBlur={(e) => {
                    const v = e.target.value
                    if (v !== (l.note ?? ""))
                      void updateWorkLog(l.id, { note: v || null }).then(reload)
                  }}
                />
              ) : (
                l.note && (
                  <div
                    className="border-border rounded-[8px] border-l-2 bg-[var(--c-bg-sunken)]/40 px-3 py-1.5"
                    data-testid="work-log-note"
                  >
                    <Markdown>{l.note}</Markdown>
                  </div>
                )
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
