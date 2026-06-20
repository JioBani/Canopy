import type { UrStatus } from "@/lib/ur"
import { UR_STATES, UR_STATE_META, UrStateGlyph } from "@/ur/urStateGlyph"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

/** UR 상태 인디케이터(글리프) 클릭 → 3상태 선택 메뉴. */
export function UrStateMenu({
  status,
  onChange,
  size = 15,
  testid,
}: {
  status: UrStatus
  onChange: (s: UrStatus) => void
  size?: number
  testid?: string
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex shrink-0 items-center justify-center rounded-full p-0.5 outline-none hover:bg-[var(--c-pink-bg)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          title={`상태: ${UR_STATE_META[status].label}`}
          onClick={(e) => e.stopPropagation()}
          data-testid={testid}
          data-status={status}
        >
          <UrStateGlyph status={status} style={{ width: size, height: size }} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
        {UR_STATES.map((s) => (
          <DropdownMenuItem
            key={s}
            onSelect={() => onChange(s)}
            data-testid="ur-state-option"
            className="gap-2"
          >
            <UrStateGlyph status={s} className="size-4" />
            {UR_STATE_META[s].label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
