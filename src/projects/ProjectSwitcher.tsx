import { useState } from "react"
import { Check, ChevronsUpDown, Plus } from "lucide-react"
import { useProjects } from "@/projects/ProjectProvider"
import { CreateProjectDialog } from "@/projects/CreateProjectDialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

export function ProjectSwitcher() {
  const { projects, currentProject, currentProjectId, selectProject } =
    useProjects()
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            data-testid="project-switcher"
          >
            {currentProject ? (
              <span data-testid="current-project-name">
                {currentProject.name}
              </span>
            ) : (
              <span className="text-muted-foreground">프로젝트 선택</span>
            )}
            <ChevronsUpDown className="size-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>프로젝트</DropdownMenuLabel>
          {projects.length === 0 && (
            <DropdownMenuItem disabled>프로젝트가 없습니다</DropdownMenuItem>
          )}
          {projects.map((p) => (
            <DropdownMenuItem
              key={p.id}
              onSelect={() => selectProject(p.id)}
              data-testid="project-option"
              className="gap-2"
            >
              <span className="flex-1 truncate">{p.name}</span>
              <Check
                className={cn(
                  "size-4",
                  p.id === currentProjectId ? "opacity-100" : "opacity-0"
                )}
              />
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => setDialogOpen(true)}
            data-testid="new-project-button"
          >
            <Plus className="size-4" />새 프로젝트
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateProjectDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  )
}
