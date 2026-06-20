import { useEffect, useMemo, useState } from "react"
import { AlertTriangle } from "lucide-react"
import { useNodes } from "@/nodes/NodesProvider"
import { useAuth } from "@/auth/AuthProvider"
import { ticketKey } from "@/nodes/nodeGrammar"
import { listUrCoverageByFeatures, listUrs, type UrStatus } from "@/lib/ur"
import { UR_STATE_META, UrStateGlyph } from "@/ur/urStateGlyph"
import type { AppNode, NodeDomain } from "@/lib/nodes"
import { CATEGORY_COLOR } from "@/lib/statuses"
import { StatusBadge } from "@/nodes/NodeBadges"

const DOMAINS: NodeDomain[] = [
  "기획",
  "디자인",
  "사운드",
  "구현",
  "밸런싱",
  "기타",
]

/** 상태 통계 표시 순서 (완료 → 미구현 → 오구현). */
const UR_STAT_ORDER: UrStatus[] = ["완료", "미구현", "오구현"]

function Card({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div
      className="flex flex-col gap-3 rounded-[var(--radius-card)] border bg-card p-5 shadow-xs"
      style={{ borderColor: "var(--c-line)" }}
    >
      <h3 className="font-display text-base font-bold">{title}</h3>
      {children}
    </div>
  )
}

function Bar({ ratio, color }: { ratio: number; color: string }) {
  return (
    <span className="bg-[var(--c-exp-empty)] block h-2 w-full overflow-hidden rounded-full">
      <span
        className="block h-full rounded-full"
        style={{ width: `${Math.round(ratio * 100)}%`, background: color }}
      />
    </span>
  )
}

export function DashboardView() {
  const { nodes, getProgress, getStatus, openNode } = useNodes()
  const { user } = useAuth()

  const contents = nodes.filter((n) => n.type === "컨텐츠")
  const tasks = useMemo(() => nodes.filter((n) => n.type === "작업"), [nodes])
  // UR 은 세부기능 소유 → 커버리지는 세부기능 기준
  const subFeatures = useMemo(
    () => nodes.filter((n) => n.type === "세부기능"),
    [nodes]
  )

  // 도메인별 분포
  const domainStats = DOMAINS.map((d) => {
    const list = tasks.filter((t) => t.domain === d)
    const done = list.filter(
      (t) => getStatus(t.status_id)?.category === "완료"
    ).length
    return { domain: d, total: list.length, done }
  }).filter((s) => s.total > 0)

  // 내 작업
  const myTasks = user
    ? tasks.filter((t) => t.assignee_id === user.id)
    : []

  // UR 상태 통계 + 미커버 (ur_coverage: is_uncovered = 연결 0 AND status≠완료)
  const [urStatusCounts, setUrStatusCounts] = useState<Record<
    UrStatus,
    number
  > | null>(null)
  const [uncoveredByFeature, setUncoveredByFeature] = useState<
    Map<string, number>
  >(new Map())
  const [uncoveredTotal, setUncoveredTotal] = useState<number | null>(null)

  useEffect(() => {
    const ids = subFeatures.map((f) => f.id)
    if (ids.length === 0) {
      setUrStatusCounts({ 완료: 0, 미구현: 0, 오구현: 0 })
      setUncoveredByFeature(new Map())
      setUncoveredTotal(0)
      return
    }
    let cancelled = false
    Promise.all([listUrs(ids), listUrCoverageByFeatures(ids)])
      .then(([urs, cov]) => {
        if (cancelled) return
        const counts: Record<UrStatus, number> = {
          완료: 0,
          미구현: 0,
          오구현: 0,
        }
        for (const u of urs) counts[u.status] += 1
        setUrStatusCounts(counts)

        const m = new Map<string, number>()
        let total = 0
        for (const r of cov) {
          if (r.is_uncovered) {
            total += 1
            m.set(r.feature_id, (m.get(r.feature_id) ?? 0) + 1)
          }
        }
        setUncoveredByFeature(m)
        setUncoveredTotal(total)
      })
      .catch((e) => {
        console.error("[dashboard] UR 로드 실패:", e)
        setUrStatusCounts({ 완료: 0, 미구현: 0, 오구현: 0 })
        setUncoveredTotal(0)
      })
    return () => {
      cancelled = true
    }
    // features 목록 변동 시 갱신
  }, [nodes]) // eslint-disable-line react-hooks/exhaustive-deps

  const featureTitle = useMemo(
    () => new Map(subFeatures.map((f) => [f.id, f.title])),
    [subFeatures]
  )
  const uncoveredFeatures = [...uncoveredByFeature.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)

  const urTotal = urStatusCounts
    ? urStatusCounts.완료 + urStatusCounts.미구현 + urStatusCounts.오구현
    : 0

  function tk(n: AppNode) {
    return ticketKey(n.type, n.ticket_number)
  }

  return (
    <div
      className="grid gap-4 overflow-y-auto p-5 lg:grid-cols-2"
      data-testid="dashboard-view"
    >
      {/* 컨텐츠별 진행률 */}
      <Card title="컨텐츠별 진행률">
        {contents.length === 0 && (
          <p className="text-muted-foreground text-sm">컨텐츠가 없습니다.</p>
        )}
        <div className="flex flex-col gap-3">
          {contents.map((c) => {
            const np = getProgress(c.id)
            const ratio = np?.progress ?? 0
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => openNode(c.id)}
                className="flex flex-col gap-1.5 rounded-md p-1 text-left hover:bg-[var(--c-pink-bg)]"
                data-testid="dash-content-progress"
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="truncate font-medium">{c.title}</span>
                  <span
                    className="tnum text-xs"
                    style={{ color: "var(--c-plum)" }}
                  >
                    {np && np.total_urs > 0
                      ? `${np.done_urs}/${np.total_urs} · ${Math.round(ratio * 100)}%`
                      : "—"}
                  </span>
                </div>
                <Bar ratio={ratio} color="var(--c-sakura)" />
              </button>
            )
          })}
        </div>
      </Card>

      {/* 요구사항(UR): 상태 통계(위) → 미커버 패널(아래) */}
      <Card title="요구사항(UR)">
        {/* 상태 통계: 완료/미구현/오구현 (프로젝트 전체 UR) */}
        <div className="flex flex-col gap-2" data-testid="dash-ur-stats">
          <div className="flex items-center gap-4">
            {UR_STAT_ORDER.map((s) => (
              <span
                key={s}
                className="flex items-center gap-1.5"
                data-testid={`dash-ur-stat-${s}`}
              >
                <UrStateGlyph status={s} className="size-4" />
                <span
                  className="tnum text-base font-bold"
                  style={{ color: UR_STATE_META[s].color }}
                >
                  {urStatusCounts ? urStatusCounts[s] : "…"}
                </span>
                <span className="text-muted-foreground text-xs">
                  {UR_STATE_META[s].label}
                </span>
              </span>
            ))}
          </div>
          {urTotal > 0 && (
            <span className="bg-[var(--c-exp-empty)] flex h-2 w-full overflow-hidden rounded-full">
              {UR_STAT_ORDER.map((s) => (
                <span
                  key={s}
                  style={{
                    width: `${((urStatusCounts?.[s] ?? 0) / urTotal) * 100}%`,
                    background: UR_STATE_META[s].color,
                  }}
                />
              ))}
            </span>
          )}
        </div>

        <div className="border-border border-t" />

        {/* 미커버: 연결 작업 0 AND status≠완료 */}
        <div className="flex items-baseline gap-2">
          <span
            className="font-display text-2xl font-bold"
            style={{ color: uncoveredTotal ? "var(--c-ember)" : "var(--c-ink)" }}
            data-testid="dash-uncovered-count"
          >
            {uncoveredTotal ?? "…"}
          </span>
          <span className="text-muted-foreground text-sm">
            개 미커버 (연결 작업 0·미완)
          </span>
          {uncoveredTotal !== null && uncoveredTotal > 0 && (
            <AlertTriangle
              className="size-4"
              style={{ color: "var(--c-ember)" }}
            />
          )}
        </div>
        <div className="flex flex-col gap-1">
          {uncoveredFeatures.map(([fid, count]) => (
            <button
              key={fid}
              type="button"
              onClick={() => openNode(fid)}
              className="flex items-center justify-between rounded-md px-1.5 py-1 text-sm hover:bg-[var(--c-pink-bg)]"
              data-testid="dash-uncovered-feature"
            >
              <span className="truncate">{featureTitle.get(fid)}</span>
              <span className="tnum text-xs" style={{ color: "var(--c-ember)" }}>
                {count}
              </span>
            </button>
          ))}
          {uncoveredTotal === 0 && (
            <p className="text-muted-foreground text-sm">
              미커버 요구사항이 없습니다. 👍
            </p>
          )}
        </div>
      </Card>

      {/* 도메인별 작업 분포 */}
      <Card title="도메인별 작업 분포">
        {domainStats.length === 0 && (
          <p className="text-muted-foreground text-sm">작업이 없습니다.</p>
        )}
        <div className="flex flex-col gap-3">
          {domainStats.map((s) => (
            <div
              key={s.domain}
              className="flex flex-col gap-1.5"
              data-testid="dash-domain"
            >
              <div className="flex items-center justify-between text-sm">
                <span>{s.domain}</span>
                <span className="tnum text-muted-foreground text-xs">
                  완료 {s.done}/{s.total}
                </span>
              </div>
              <Bar
                ratio={s.total ? s.done / s.total : 0}
                color={CATEGORY_COLOR["완료"]}
              />
            </div>
          ))}
        </div>
      </Card>

      {/* 내 작업 */}
      <Card title="내 작업">
        {myTasks.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            나에게 배정된 작업이 없습니다.
          </p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {myTasks.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => openNode(t.id)}
                className="flex items-center gap-2 rounded-md px-1.5 py-1 text-left hover:bg-[var(--c-pink-bg)]"
                data-testid="dash-my-task"
              >
                <code
                  className="tnum shrink-0 font-mono text-[11px] font-semibold"
                  style={{ color: "var(--c-plum)" }}
                >
                  {tk(t)}
                </code>
                <span className="flex-1 truncate text-[13px]">{t.title}</span>
                <StatusBadge statusId={t.status_id} />
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
