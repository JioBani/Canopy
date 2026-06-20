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
}: {
  subFeatureId: string
  compact?: boolean
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

  const seg = (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg bg-[var(--c-bg-sunken)] p-0.5",
        compact ? "text-[11px]" : "text-[13px]"
      )}
      role="tablist"
    >
      {(["ur", "work"] as Tab[]).map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => setTab(t)}
          aria-pressed={tab === t}
          data-testid={t === "ur" ? "ur-tab" : "work-tab"}
          className={cn(
            "rounded-md font-semibold transition-colors",
            compact ? "px-2 py-0.5" : "px-2.5 py-1",
            tab === t
              ? "bg-card text-foreground shadow-[0_1px_2px_rgba(90,40,60,.10),0_0_0_1px_var(--c-line)]"
              : "text-muted-foreground hover:text-foreground"
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
    <div
      className={cn("flex flex-col", compact ? "gap-1.5" : "gap-3")}
      data-testid="subfeature-sections"
    >
      {seg}
      {tab === "ur" ? (
        <UrSection subFeatureId={subFeatureId} compact={compact} />
      ) : (
        <WorkSection
          parentId={subFeatureId}
          featureId={subFeatureId}
          compact={compact}
        />
      )}
    </div>
  )
}
