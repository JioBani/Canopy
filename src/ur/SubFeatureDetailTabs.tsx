import { useNodes } from "@/nodes/NodesProvider"
import { setQuery, useUrl } from "@/lib/router"
import { cn } from "@/lib/utils"
import { UrSection } from "@/ur/UrSection"
import { TaskUrTab } from "@/ur/TaskUrTab"
import { useSubFeatureUrData } from "@/ur/useSubFeatureUrData"

export type SubFeatureTab = "ur" | "task"
const TAB_KEY = "canopy.subfeatureTab"

function readStoredTab(): SubFeatureTab {
  try {
    return localStorage.getItem(TAB_KEY) === "task" ? "task" : "ur"
  } catch {
    return "ur"
  }
}

/**
 * 세부기능 상세 — 탭 [요구사항 → 작업 | 작업 → 요구사항].
 * 선택 탭 = URL ?tab= (공유 가능). URL 에 없으면 마지막 선택(localStorage) → 기본 "ur".
 * 두 탭은 같은 데이터(useSubFeatureUrData)를 공유한다.
 */
export function SubFeatureDetailTabs({
  subFeatureId,
  editable,
}: {
  subFeatureId: string
  editable: boolean
}) {
  const { childrenOf } = useNodes()
  const { params } = useUrl()
  const q = params.get("tab")
  const tab: SubFeatureTab = q === "task" || q === "ur" ? q : readStoredTab()
  const data = useSubFeatureUrData(subFeatureId)

  const works = childrenOf(subFeatureId).filter((n) => n.type === "작업")
  // 경고 기준 = 대시보드 미커버와 동일: 연결 작업 0 AND 미완료.
  const noWorkUrs = data.urs.filter(
    (u) => u.status !== "완료" && !(data.worksByUr.get(u.id)?.length)
  ).length
  const noUrWorks = works.filter((w) => !data.ursByWork.has(w.id)).length
  const gap = !data.loading && (noWorkUrs > 0 || noUrWorks > 0)
  const gapHint = `작업 없는 미완료 요구사항 ${noWorkUrs} · 요구사항 없는 작업 ${noUrWorks}`

  function change(t: SubFeatureTab) {
    try {
      localStorage.setItem(TAB_KEY, t)
    } catch {
      /* 저장 불가 환경 무시 */
    }
    setQuery({ tab: t })
  }

  const tabs: { id: SubFeatureTab; label: string; count: string }[] = [
    { id: "ur", label: "요구사항 → 작업", count: `요구사항 ${data.loading ? "…" : data.urs.length}` },
    { id: "task", label: "작업 → 요구사항", count: `작업 ${works.length}` },
  ]

  return (
    <div className="flex flex-col" data-testid="subfeature-sections">
      <div
        role="tablist"
        aria-label="요구사항·작업 보기"
        className="border-line bg-sunken rounded-t-card flex flex-wrap gap-1 border border-b-0 px-2 pt-2"
      >
        {tabs.map((t) => {
          const active = tab === t.id
          return (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => change(t.id)}
              title={gap ? gapHint : undefined}
              data-testid={`detail-tab-${t.id}`}
              className={cn(
                "text-body flex shrink-0 items-center gap-2 rounded-t-lg px-4 py-2.5 font-semibold whitespace-nowrap transition-colors",
                active
                  ? "bg-surface text-fg ring-line -mb-px ring-1 [clip-path:inset(-1px_-1px_0_-1px)]"
                  : "text-fg-2 hover:text-fg"
              )}
            >
              {t.label}
              <span className={cn("text-meta tnum font-medium", active ? "text-fg-2" : "text-fg-3")}>
                {t.count}
              </span>
              {gap && (
                <span
                  aria-label="연결 안 된 항목 있음"
                  className="bg-danger size-2 rounded-full"
                  data-testid="tab-gap-dot"
                />
              )}
            </button>
          )
        })}
      </div>
      {tab === "ur" ? (
        <UrSection subFeatureId={subFeatureId} editable={editable} data={data} />
      ) : (
        <TaskUrTab subFeatureId={subFeatureId} data={data} editable={editable} />
      )}
    </div>
  )
}
