import { useState, type FormEvent } from "react"
import { useProjects } from "@/projects/ProjectProvider"
import { validateProjectName } from "@/lib/validation"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateProjectDialog({ open, onOpenChange }: Props) {
  const { createProject } = useProjects()
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function reset() {
    setName("")
    setError(null)
    setSubmitting(false)
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset()
    onOpenChange(next)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const nameErr = validateProjectName(name)
    if (nameErr) return setError(nameErr)

    setError(null)
    setSubmitting(true)
    try {
      await createProject(name)
      reset()
      onOpenChange(false)
    } catch (err) {
      setSubmitting(false)
      setError(err instanceof Error ? err.message : "프로젝트 생성에 실패했습니다.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent data-testid="create-project-dialog">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>새 프로젝트</DialogTitle>
            <DialogDescription>
              프로젝트명을 입력하세요. 티켓키는 타입 기반(예: Task-1)으로 자동 발급되고,
              기본 상태(할일/진행중/완료/취소됨)도 자동 생성됩니다.
            </DialogDescription>
          </DialogHeader>

          <div className="my-4 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="project-name">프로젝트명</Label>
              <Input
                id="project-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: 타티카 디펜스"
                data-testid="project-name-input"
                autoFocus
              />
            </div>
            {error && (
              <p className="text-destructive text-sm" data-testid="project-form-error">
                {error}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              취소
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              data-testid="create-project-submit"
            >
              {submitting ? "생성 중…" : "생성"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
