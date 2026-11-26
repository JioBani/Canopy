import {
  ArrowBigUpDash,
  ChevronDown,
  ChevronUp,
  ChevronsDown,
  ChevronsUp,
  Equal,
  type LucideIcon,
} from "lucide-react"
import { PRIORITY_COLOR, PRIORITY_SOFT, type Priority } from "@/lib/fields"
import { cn } from "@/lib/utils"
import { icon } from "@/lib/themeColor"

/**
 * 우선순위 아이콘 — 방향(위/아래) × 개수(1/2)로 단계, 최우선만 굵은 화살표.
 * 색과 모양을 함께 써서 색각 차이가 있어도 구분된다.
 */
export const PRIORITY_ICON: Record<Priority, LucideIcon> = {
  최우선: ArrowBigUpDash,
  매우높음: ChevronsUp,
  높음: ChevronUp,
  보통: Equal,
  낮음: ChevronDown,
  매우낮음: ChevronsDown,
}

export function PriorityIcon({
  priority,
  className,
}: {
  priority: Priority
  className?: string
}) {
  const Icon = PRIORITY_ICON[priority]
  return (
    <Icon
      aria-hidden
      className={cn("size-4 shrink-0", className)}
      strokeWidth={priority === "최우선" ? 2.25 : 2.5}
      style={{ color: icon(PRIORITY_COLOR[priority]) }}
      data-priority-icon={priority}
    />
  )
}

/** 아이콘(색) + 이름(본문색 — 가독성) 배지, 연한 틴트 배경. */
export function PriorityBadge({
  priority,
  className,
}: {
  priority: Priority
  className?: string
}) {
  return (
    <span
      className={cn(
        "text-label text-fg-2 inline-flex items-center gap-1 rounded-md py-0.5 pr-2 pl-1 whitespace-nowrap",
        priority === "최우선" && "text-danger font-bold",
        className
      )}
      style={{ background: PRIORITY_SOFT[priority] }}
    >
      <PriorityIcon priority={priority} className="size-3.5" />
      {priority}
    </span>
  )
}
