import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

const ALL = "__all__"

export type FilterOption = { value: string; label: string }

/**
 * 필터용 Select(흰 메뉴) — 빈 문자열("전체")은 sentinel 로 처리.
 * 네이티브 <select> 필터 대체. 트리거에 testid 유지.
 */
export function FilterSelect({
  value,
  onChange,
  allLabel,
  items,
  testid,
  className,
}: {
  value: string
  onChange: (v: string) => void
  allLabel: string
  items: FilterOption[]
  testid?: string
  className?: string
}) {
  return (
    <Select
      value={value || ALL}
      onValueChange={(v) => onChange(v === ALL ? "" : v)}
    >
      <SelectTrigger
        size="sm"
        data-testid={testid}
        className={cn(
          "bg-card h-8 gap-1.5 rounded-[9px] text-[13px] font-medium",
          className
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {items.map((it) => (
          <SelectItem key={it.value} value={it.value}>
            {it.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
