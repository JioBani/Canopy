import { useCallback, useEffect, useState, type KeyboardEvent } from "react"
import { Trash2, Users } from "lucide-react"
import { useNodes } from "@/nodes/NodesProvider"
import {
  deleteMember,
  insertMember,
  listMembers,
  updateMember,
  type Member,
} from "@/lib/members"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const DEFAULT_COLOR = "#EC9EBA"

function MembersContent() {
  const { refreshMembers } = useNodes()
  const [members, setMembers] = useState<Member[]>([])
  const [newName, setNewName] = useState("")
  const [newColor, setNewColor] = useState(DEFAULT_COLOR)

  const reload = useCallback(async () => {
    setMembers(await listMembers())
    await refreshMembers() // 담당자 셀렉트 등 즉시 반영
  }, [refreshMembers])

  useEffect(() => {
    reload().catch((e) => console.error("[member] 로드 실패:", e))
  }, [reload])

  async function add() {
    const name = newName.trim()
    if (!name) return
    await insertMember(name, newColor)
    setNewName("")
    setNewColor(DEFAULT_COLOR)
    await reload()
  }
  function onAddKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault()
      void add()
    }
  }

  return (
    <div className="flex flex-col gap-3" data-testid="members-content">
      <div className="flex flex-col gap-2">
        {members.length === 0 && (
          <p className="text-muted-foreground text-sm">아직 멤버가 없습니다.</p>
        )}
        {members.map((m) => (
          <div
            key={m.id}
            className="flex items-center gap-2"
            data-testid="member-row"
            data-name={m.display_name ?? ""}
          >
            <input
              type="color"
              value={m.color ?? DEFAULT_COLOR}
              onChange={async (e) => {
                await updateMember(m.id, { color: e.target.value })
                await reload()
              }}
              className="size-7 shrink-0 cursor-pointer rounded border"
              data-testid="member-color-input"
              title="아바타 색"
            />
            <Input
              defaultValue={m.display_name ?? ""}
              onBlur={async (e) => {
                const v = e.target.value.trim()
                if (v && v !== m.display_name) {
                  await updateMember(m.id, { display_name: v })
                  await reload()
                }
              }}
              className="h-8"
              data-testid="member-name-input"
            />
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive size-7 shrink-0"
              onClick={async () => {
                await deleteMember(m.id)
                await reload()
              }}
              data-testid="member-delete"
              title="삭제 (담당 작업의 담당자는 자동 해제)"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
      </div>

      {/* 추가 */}
      <div className="flex items-center gap-2 border-t pt-3">
        <input
          type="color"
          value={newColor}
          onChange={(e) => setNewColor(e.target.value)}
          className="size-7 shrink-0 cursor-pointer rounded border"
          data-testid="member-add-color"
          title="아바타 색"
        />
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={onAddKey}
          placeholder="새 멤버 이름"
          className="h-8"
          data-testid="member-add-input"
        />
        <Button size="sm" variant="outline" onClick={() => void add()} data-testid="member-add">
          추가
        </Button>
      </div>
    </div>
  )
}

export function MembersButton() {
  const [open, setOpen] = useState(false)
  const { reload } = useNodes()

  function onOpenChange(next: boolean) {
    setOpen(next)
    if (!next) void reload() // 닫을 때 담당자 표시 등 반영
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        onClick={() => setOpen(true)}
        data-testid="members-open"
        title="멤버 관리"
      >
        <Users className="size-4" />
      </Button>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent data-testid="members-dialog" className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>멤버 관리</DialogTitle>
            <DialogDescription>
              팀원을 직접 추가·이름/색 수정·삭제합니다. 작업 상세의 담당자에서 선택할 수 있습니다.
            </DialogDescription>
          </DialogHeader>
          <MembersContent />
        </DialogContent>
      </Dialog>
    </>
  )
}
