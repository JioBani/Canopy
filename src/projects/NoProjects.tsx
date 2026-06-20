import { useState } from "react"
import { FolderPlus } from "lucide-react"
import { CreateProjectDialog } from "@/projects/CreateProjectDialog"
import { Button } from "@/components/ui/button"

/** 프로젝트가 하나도 없을 때의 전체 빈 상태. */
export function NoProjects() {
  const [open, setOpen] = useState(false)
  return (
    <div
      className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center"
      data-testid="no-projects"
    >
      <FolderPlus className="text-muted-foreground size-10" />
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">아직 프로젝트가 없습니다</h2>
        <p className="text-muted-foreground text-sm">
          첫 프로젝트를 만들어 기획 계층 관리를 시작하세요.
        </p>
      </div>
      <Button onClick={() => setOpen(true)} data-testid="create-first-project">
        새 프로젝트 만들기
      </Button>
      <CreateProjectDialog open={open} onOpenChange={setOpen} />
    </div>
  )
}
