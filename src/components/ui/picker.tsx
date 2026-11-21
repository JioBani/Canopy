import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"

export type PickerItem = { value: string; label: string }
export type PickerGroup = { key: string; label?: string; items: PickerItem[] }

/**
 * 검색형 콤보박스 피커(흰 메뉴) — 항목 선택 → onPick → 닫힘(액션형).
 * 네이티브 select 의 "+ …" 패턴 대체. 트리거에 testid 유지.
 */
export function Picker({
  triggerLabel,
  placeholder,
  empty = "결과가 없습니다.",
  groups,
  onPick,
  testid,
  align = "start",
}: {
  triggerLabel: string
  placeholder: string
  empty?: string
  groups: PickerGroup[]
  onPick: (value: string) => void
  testid?: string
  align?: "start" | "center" | "end"
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="justify-start"
          data-testid={testid}
        >
          <Plus />
          {triggerLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        className="w-80 overflow-hidden p-0"
        data-testid={testid ? `${testid}-menu` : undefined}
      >
        <Command>
          <CommandInput placeholder={placeholder} />
          <CommandList>
            <CommandEmpty>{empty}</CommandEmpty>
            {groups.map((g) => (
              <CommandGroup key={g.key} heading={g.label}>
                {g.items.map((it) => (
                  <CommandItem
                    key={it.value}
                    value={`${it.label} ${it.value}`}
                    onSelect={() => {
                      onPick(it.value)
                      setOpen(false)
                    }}
                  >
                    <span className="truncate">{it.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
