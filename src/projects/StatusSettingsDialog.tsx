import { useCallback, useEffect, useState, type KeyboardEvent } from "react"
import { ChevronDown, ChevronUp, Settings, Trash2 } from "lucide-react"
import { useProjects } from "@/projects/ProjectProvider"
import { useNodes } from "@/nodes/NodesProvider"
import {
  CATEGORY_COLOR,
  countNodesUsingStatus,
  deleteStatus,
  insertStatus,
  listStatuses,
  reassignStatusNodes,
  updateStatus,
  type Status,
  type StatusCategory,
} from "@/lib/statuses"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FilterSelect } from "@/components/ui/filter-select"

const CATEGORIES: StatusCategory[] = ["할일", "진행중", "완료", "취소됨"]

function AddStatusRow({
  category,
  onAdd,
}: {
  category: StatusCategory
  onAdd: (name: string) => void
}) {
  const [name, setName] = useState("")
  function submit() {
    if (name.trim()) {
      onAdd(name.trim())
      setName("")
    }
  }
  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault()
      submit()
    }
  }
  return (
    <div className="flex items-center gap-2">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={onKey}
        placeholder={`${category} 상태 추가`}
        className="h-8"
        data-testid="status-add-input"
      />
      <Button size="sm" variant="outline" onClick={submit} data-testid="status-add">
        추가
      </Button>
    </div>
  )
}

function StatusSettingsContent({ projectId }: { projectId: string }) {
  const [statuses, setStatuses] = useState<Status[]>([])
  const [usage, setUsage] = useState<Map<string, number>>(new Map())
  const [deleting, setDeleting] = useState<{ id: string; count: number } | null>(
    null
  )
  const [reassignTo, setReassignTo] = useState<string>("")

  const reload = useCallback(async () => {
    const list = await listStatuses(projectId)
    setStatuses(list)
    const entries = await Promise.all(
      list.map(async (s) => [s.id, await countNodesUsingStatus(s.id)] as const)
    )
    setUsage(new Map(entries))
  }, [projectId])

  useEffect(() => {
    reload().catch((e) => console.error("[status] 로드 실패:", e))
  }, [reload])

  function inCategory(cat: StatusCategory) {
    return statuses
      .filter((s) => s.category === cat)
      .sort((a, b) => a.sort_order - b.sort_order)
  }

  async function add(cat: StatusCategory, name: string) {
    const sibs = inCategory(cat)
    const sort = sibs.reduce((m, s) => Math.max(m, s.sort_order), -1) + 1
    await insertStatus({
      project_id: projectId,
      name,
      category: cat,
      color: CATEGORY_COLOR[cat],
      sort_order: sort,
    })
    await reload()
  }

  async function move(s: Status, dir: -1 | 1) {
    const sibs = inCategory(s.category)
    const idx = sibs.findIndex((x) => x.id === s.id)
    const target = sibs[idx + dir]
    if (!target) return
    await Promise.all([
      updateStatus(s.id, { sort_order: target.sort_order }),
      updateStatus(target.id, { sort_order: s.sort_order }),
    ])
    await reload()
  }

  async function confirmDelete() {
    if (!deleting) return
    if (deleting.count > 0) {
      await reassignStatusNodes(deleting.id, reassignTo || null)
    }
    await deleteStatus(deleting.id)
    setDeleting(null)
    setReassignTo("")
    await reload()
  }

  const canDelete = statuses.length > 1

  return (
    <div className="flex flex-col gap-5" data-testid="status-settings">
      {CATEGORIES.map((cat) => {
        const list = inCategory(cat)
        return (
          <div key={cat} className="flex flex-col gap-2" data-testid="status-cat" data-cat={cat}>
            <div className="flex items-center gap-2">
              <span
                className="size-3 rounded-full"
                style={{ backgroundColor: CATEGORY_COLOR[cat] }}
              />
              <span className="text-sm font-semibold">{cat}</span>
            </div>

            {list.map((s, i) => (
              <div key={s.id} className="flex items-center gap-2" data-testid="status-row">
                <input
                  type="color"
                  value={s.color ?? CATEGORY_COLOR[cat]}
                  onChange={async (e) => {
                    await updateStatus(s.id, { color: e.target.value })
                    await reload()
                  }}
                  className="size-7 cursor-pointer rounded border"
                  data-testid="status-color-input"
                  title="색"
                />
                <Input
                  defaultValue={s.name}
                  onBlur={async (e) => {
                    const v = e.target.value.trim()
                    if (v && v !== s.name) {
                      await updateStatus(s.id, { name: v })
                      await reload()
                    }
                  }}
                  className="h-8"
                  data-testid="status-name-input"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  disabled={i === 0}
                  onClick={() => void move(s, -1)}
                  data-testid="status-up"
                >
                  <ChevronUp className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  disabled={i === list.length - 1}
                  onClick={() => void move(s, 1)}
                  data-testid="status-down"
                >
                  <ChevronDown className="size-4" />
                </Button>
                <span
                  className="text-muted-foreground w-12 text-right text-xs tabular-nums"
                  data-testid="status-usage"
                  title="이 상태를 쓰는 작업 수"
                >
                  사용 {usage.get(s.id) ?? 0}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive size-7"
                  disabled={!canDelete}
                  onClick={async () => {
                    const count = await countNodesUsingStatus(s.id)
                    setReassignTo("")
                    setDeleting({ id: s.id, count })
                  }}
                  data-testid="status-delete"
                  title={canDelete ? "삭제" : "최소 1개는 남겨야 합니다"}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}

            <AddStatusRow category={cat} onAdd={(name) => void add(cat, name)} />
          </div>
        )
      })}

      {/* 삭제 확인 (사용 중이면 재지정 요구) */}
      {deleting && (
        <div
          className="bg-muted/40 flex flex-col gap-2 rounded-md border p-3"
          data-testid="status-delete-confirm"
        >
          {deleting.count > 0 ? (
            <>
              <p className="text-sm">
                이 상태를 쓰는 작업 <b>{deleting.count}</b>개가 있습니다. 옮길 상태를 고르세요.
              </p>
              <FilterSelect
                value={reassignTo}
                onChange={setReassignTo}
                allLabel="미지정으로"
                items={statuses
                  .filter((s) => s.id !== deleting.id)
                  .map((s) => ({
                    value: s.id,
                    label: `${s.category} / ${s.name}`,
                  }))}
                testid="status-reassign"
              />
            </>
          ) : (
            <p className="text-sm">이 상태를 삭제할까요?</p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setDeleting(null)}>
              취소
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => void confirmDelete()}
              data-testid="status-delete-go"
            >
              {deleting.count > 0 ? "이동 후 삭제" : "삭제"}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export function StatusSettingsButton() {
  const [open, setOpen] = useState(false)
  const { currentProject } = useProjects()
  const { reload } = useNodes()

  function onOpenChange(next: boolean) {
    setOpen(next)
    if (!next) void reload() // 닫을 때 트리/뱃지/진행바 반영
  }

  if (!currentProject) return null

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        onClick={() => setOpen(true)}
        data-testid="project-settings"
        title="상태 설정"
      >
        <Settings className="size-4" />
      </Button>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent data-testid="status-settings-dialog" className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>상태 설정</DialogTitle>
            <DialogDescription>
              카테고리별 세부 상태를 추가·이름변경·색 지정·정렬·삭제합니다. 진행바·보드는 카테고리 기준입니다.
            </DialogDescription>
          </DialogHeader>
          <StatusSettingsContent projectId={currentProject.id} />
        </DialogContent>
      </Dialog>
    </>
  )
}
