import { useState, type FormEvent } from "react"
import { useProjects } from "@/projects/ProjectProvider"
import {
  sanitizeKeyPrefix,
  validateKeyPrefix,
  validateProjectName,
} from "@/lib/validation"
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
  const [prefix, setPrefix] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function reset() {
    setName("")
    setPrefix("")
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
    const prefixErr = validateKeyPrefix(prefix)
    if (prefixErr) return setError(prefixErr)

    setError(null)
    setSubmitting(true)
    try {
      await createProject(name, prefix)
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
              프로젝트명과 티켓 키 프리픽스를 입력하세요. 기본 상태(할일/진행중/완료/취소됨)는 자동으로 생성됩니다.
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
            <div className="flex flex-col gap-2">
              <Label htmlFor="project-prefix">키 프리픽스</Label>
              <Input
                id="project-prefix"
                value={prefix}
                onChange={(e) => setPrefix(sanitizeKeyPrefix(e.target.value))}
                placeholder="예: TD"
                data-testid="project-prefix-input"
              />
              <p className="text-muted-foreground text-xs">
                영문 대문자·숫자 2~10자. 티켓키에 사용됩니다 (예: {prefix || "TD"}-1).
              </p>
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
