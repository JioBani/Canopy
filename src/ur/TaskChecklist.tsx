import { useCallback, useEffect, useState, type KeyboardEvent } from "react"
import { Trash2 } from "lucide-react"
import {
  deleteChecklistItem,
  insertChecklistItem,
  listChecklist,
  updateChecklistItem,
  type ChecklistItem,
} from "@/lib/checklist"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"

export function TaskChecklist({ workId }: { workId: string }) {
  const [items, setItems] = useState<ChecklistItem[]>([])
  const [text, setText] = useState("")

  const reload = useCallback(async () => {
    setItems(await listChecklist(workId))
  }, [workId])

  useEffect(() => {
    reload().catch((e) => console.error("[checklist] 로드 실패:", e))
  }, [reload])

  async function add() {
    const t = text.trim()
    if (!t) return
    const sort = items.reduce((m, i) => Math.max(m, i.sort_order), -1) + 1
    const created = await insertChecklistItem(workId, t, sort)
    setItems((prev) => [...prev, created])
    setText("")
  }
  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault()
      void add()
    }
  }

  const doneCount = items.filter((i) => i.done).length

  return (
    <section className="flex flex-col gap-2.5" data-testid="task-checklist">
      <div className="flex items-baseline gap-2">
        <h3 className="font-display text-[15px] font-bold">작업내용</h3>
        {items.length > 0 && (
          <span
            className="tnum text-xs font-medium"
            style={{ color: "var(--c-ink-3)" }}
          >
            {doneCount}/{items.length}
          </span>
        )}
      </div>

      <div className="flex flex-col">
        {items.map((it) => (
          <label
            key={it.id}
            className="group/ci flex items-center gap-2.5 rounded-md px-1.5 py-1.5 transition-colors hover:bg-[var(--c-pink-bg)]/50"
            data-testid="checklist-item"
          >
            <Checkbox
              checked={it.done}
              onCheckedChange={(c) => {
                const done = c === true
                setItems((prev) =>
                  prev.map((x) => (x.id === it.id ? { ...x, done } : x))
                )
                void updateChecklistItem(it.id, { done })
              }}
              data-testid="checklist-toggle"
            />
            <span
              className={
                "flex-1 text-[13.5px] leading-snug " +
                (it.done ? "text-muted-foreground line-through" : "")
              }
            >
              {it.text}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive size-6 opacity-0 group-hover/ci:opacity-100"
              onClick={(e) => {
                e.preventDefault()
                setItems((prev) => prev.filter((x) => x.id !== it.id))
                void deleteChecklistItem(it.id)
              }}
              data-testid="checklist-delete"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </label>
        ))}
      </div>

      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKey}
        placeholder="할 일 추가 후 Enter"
        className="h-8"
        data-testid="checklist-input"
      />
    </section>
  )
}
