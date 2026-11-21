import { useCallback, useEffect, useState, type KeyboardEvent } from "react"
import { ListTodo, Trash2 } from "lucide-react"
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
import { Section } from "@/components/ds"

export function TaskChecklist({
  workId,
  editable = false,
}: {
  workId: string
  editable?: boolean
}) {
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
    <Section
      icon={<ListTodo />}
      title="작업 내용"
      count={items.length > 0 ? `${doneCount}/${items.length}` : undefined}
      data-testid="task-checklist"
    >
      <div className="flex flex-col">
        {items.map((it) => (
          <label
            key={it.id}
            className="group/ci border-line hover:bg-subtle -mx-2 flex min-h-10 cursor-pointer items-start gap-3 rounded-md border-t px-2 py-2 transition-colors first:border-t-0"
            data-testid="checklist-item"
          >
            <Checkbox
              className="mt-[3px]"
              checked={it.done}
              disabled={!editable}
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
                "text-reading flex-1 " + (it.done ? "text-fg-3" : "text-fg")
              }
            >
              {it.text}
            </span>
            {editable && (
              <Button
                variant="ghost"
                size="icon-sm"
                className="hover:text-danger opacity-0 group-hover/ci:opacity-100 focus-visible:opacity-100"
                onClick={(e) => {
                  e.preventDefault()
                  setItems((prev) => prev.filter((x) => x.id !== it.id))
                  void deleteChecklistItem(it.id)
                }}
                title="항목 삭제"
                data-testid="checklist-delete"
              >
                <Trash2 />
              </Button>
            )}
          </label>
        ))}
        {items.length === 0 && (
          <p className="text-body text-fg-3 pb-1">
            {editable ? "아직 항목이 없습니다. 아래에 할 일을 적고 Enter 를 누르세요." : "작업 내용이 없습니다."}
          </p>
        )}
      </div>

      {editable && (
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          placeholder="할 일을 입력하고 Enter"
          className="mt-3"
          data-testid="checklist-input"
        />
      )}
    </Section>
  )
}
