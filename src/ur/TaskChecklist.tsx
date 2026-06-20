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
    <div className="flex flex-col gap-2" data-testid="task-checklist">
      <h3 className="font-display text-base font-bold">
        작업내용{" "}
        {items.length > 0 && (
          <span className="text-muted-foreground font-sans text-xs font-normal tabular-nums">
            ({doneCount}/{items.length})
          </span>
        )}
      </h3>
      {items.map((it) => (
        <label
          key={it.id}
          className="group/ci flex items-center gap-2 text-sm"
          data-testid="checklist-item"
        >
          <input
            type="checkbox"
            checked={it.done}
            onChange={(e) => {
              const done = e.target.checked
              setItems((prev) =>
                prev.map((x) => (x.id === it.id ? { ...x, done } : x))
              )
              void updateChecklistItem(it.id, { done })
            }}
            data-testid="checklist-toggle"
          />
          <span className={it.done ? "text-muted-foreground line-through" : ""}>
            {it.text}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive ml-auto size-5 opacity-0 group-hover/ci:opacity-100"
            onClick={() => {
              setItems((prev) => prev.filter((x) => x.id !== it.id))
              void deleteChecklistItem(it.id)
            }}
            data-testid="checklist-delete"
          >
            <Trash2 className="size-3" />
          </Button>
        </label>
      ))}
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKey}
        placeholder="할 일 추가 후 Enter"
        className="h-7"
        data-testid="checklist-input"
      />
    </div>
  )
}
