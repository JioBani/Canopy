import { useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TicketKey } from "@/components/ds"

/**
 * 인라인 연결 피커 — 목록 바로 아래 펼쳐지는 검색 리스트(팝오버 아님: 긴 문장을 다 보여주기 위해).
 * 항목 클릭 → onPick. Esc/닫기 → onClose.
 */
export function InlinePicker<T extends { id: string }>({
  items,
  render,
  placeholder,
  onPick,
  onClose,
  empty = "연결할 항목이 없습니다.",
  testid,
}: {
  items: T[]
  render: (it: T) => { key: string; text: string; hint?: ReactNode }
  placeholder: string
  onPick: (it: T) => void
  onClose: () => void
  empty?: string
  testid?: string
}) {
  const [q, setQ] = useState("")
  const list = items.filter((it) => {
    const r = render(it)
    return `${r.key} ${r.text}`.toLowerCase().includes(q.trim().toLowerCase())
  })
  return (
    <div
      className="border-line-strong bg-surface shadow-pop mt-1 rounded-lg border p-2"
      data-testid={testid}
    >
      <Input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        placeholder={placeholder}
        className="mb-1"
      />
      <div className="flex max-h-72 flex-col overflow-y-auto">
        {list.length === 0 && <p className="text-body text-fg-3 px-2 py-2">{empty}</p>}
        {list.map((it) => {
          const r = render(it)
          return (
            <button
              key={it.id}
              type="button"
              onClick={() => onPick(it)}
              className="hover:bg-hover flex items-start gap-2 rounded-md px-2 py-2 text-left"
              data-testid={testid ? `${testid}-option` : undefined}
            >
              <p className="text-body text-fg min-w-0 flex-1">
                <TicketKey value={r.key} className="mr-2" />
                {r.text}
              </p>
              {r.hint}
            </button>
          )
        })}
      </div>
      <div className="mt-1 flex justify-end">
        <Button variant="ghost" size="sm" onClick={onClose}>
          닫기
        </Button>
      </div>
    </div>
  )
}
