import { useEffect, useState } from "react"
import { useNodes } from "@/nodes/NodesProvider"
import { listUrs } from "@/lib/ur"
import { UrSection } from "@/ur/UrSection"
import { WorkSection } from "@/ur/WorkSection"
import { cn } from "@/lib/utils"

type Tab = "ur" | "work"

/**
 * 세부기능의 [요구사항 | 작업] 형제 섹션 (작업은 UR 하위 아님).
 * compact=true → 사이드바 임베드(보기/네비), false → 상세 풀 편집.
 */
export function SubFeatureSections({
  subFeatureId,
  compact = false,
  editable = false,
}: {
  subFeatureId: string
  compact?: boolean
  /** 상세 편집 모드에서만 true → UR/작업 편집 컨트롤 노출. */
  editable?: boolean
}) {
  const { childrenOf } = useNodes()
  const [tab, setTab] = useState<Tab>("ur")
  const [urCount, setUrCount] = useState<number | null>(null)
  const workCount = childrenOf(subFeatureId).filter(
    (n) => n.type === "작업"
  ).length

  useEffect(() => {
    let alive = true
    listUrs([subFeatureId])
      .then((u) => alive && setUrCount(u.length))
      .catch(() => alive && setUrCount(0))
    return () => {
      alive = false
    }
  }, [subFeatureId, tab])

  // 상세(full): 요구사항·작업 카드를 세로로 둘 다 노출(탭 전환 없음 — design-system-v2).
  if (!compact) {
    return (
      <div className="flex flex-col gap-4" data-testid="subfeature-sections">
        <UrSection subFeatureId={subFeatureId} editable={editable} />
        <WorkSection parentId={subFeatureId} />
      </div>
    )
  }

  // 사이드바(compact): 공간이 좁아 탭 유지.
  const seg = (
    <div className="bg-sunken text-label inline-flex items-center gap-0.5 self-start rounded-md p-0.5" role="tablist">
      {(["ur", "work"] as Tab[]).map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => setTab(t)}
          aria-pressed={tab === t}
          data-testid={t === "ur" ? "ur-tab" : "work-tab"}
          className={cn(
            "rounded-[5px] px-2.5 py-0.5 transition-colors",
            tab === t ? "bg-surface text-fg ring-line ring-1" : "text-fg-2 hover:text-fg"
          )}
        >
          {t === "ur"
            ? `요구사항${urCount != null ? ` ${urCount}` : ""}`
            : `작업 ${workCount}`}
        </button>
      ))}
    </div>
  )

  return (
    <div className="flex flex-col gap-1.5" data-testid="subfeature-sections">
      {seg}
      {tab === "ur" ? (
        <UrSection subFeatureId={subFeatureId} compact editable={editable} />
      ) : (
        <WorkSection parentId={subFeatureId} compact />
      )}
    </div>
  )
}
