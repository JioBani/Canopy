import { useEffect, useMemo, useState } from "react"
import { AlertTriangle } from "lucide-react"
import { useNodes } from "@/nodes/NodesProvider"
import { useAuth } from "@/auth/AuthProvider"
import { ticketKey } from "@/nodes/nodeGrammar"
import { listUrCoverageByFeatures } from "@/lib/ur"
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

  // 미커버 UR (ur_coverage)
  const [uncoveredByFeature, setUncoveredByFeature] = useState<
    Map<string, number>
  >(new Map())
  const [uncoveredTotal, setUncoveredTotal] = useState<number | null>(null)

  useEffect(() => {
    const ids = subFeatures.map((f) => f.id)
    if (ids.length === 0) {
      setUncoveredByFeature(new Map())
      setUncoveredTotal(0)
      return
    }
    let cancelled = false
    listUrCoverageByFeatures(ids)
      .then((rows) => {
        if (cancelled) return
        const m = new Map<string, number>()
        let total = 0
        for (const r of rows) {
          if (r.is_uncovered) {
            total += 1
            m.set(r.feature_id, (m.get(r.feature_id) ?? 0) + 1)
          }
        }
        setUncoveredByFeature(m)
        setUncoveredTotal(total)
      })
      .catch((e) => {
        console.error("[dashboard] 커버리지 로드 실패:", e)
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

      {/* 미커버 UR */}
      <Card title="미커버 요구사항(UR)">
        <div className="flex items-baseline gap-2">
          <span
            className="font-display text-3xl font-bold"
            style={{ color: uncoveredTotal ? "var(--c-ember)" : "var(--c-ink)" }}
            data-testid="dash-uncovered-count"
          >
            {uncoveredTotal ?? "…"}
          </span>
          <span className="text-muted-foreground text-sm">
            개 (연결 작업 0)
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
