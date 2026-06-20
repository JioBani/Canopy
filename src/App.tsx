import { useAuth } from "@/auth/AuthProvider"
import { RequireAuth } from "@/auth/RequireAuth"
import { ProjectProvider, useProjects } from "@/projects/ProjectProvider"
import { ProjectSwitcher } from "@/projects/ProjectSwitcher"
import { NoProjects } from "@/projects/NoProjects"
import { Button } from "@/components/ui/button"

/** 프로젝트는 있으나 노드가 0개일 때 (트리 CRUD 는 다음 단계). */
function ProjectEmptyState() {
  return (
    <div
      className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center"
      data-testid="empty-state"
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">아직 컨텐츠가 없습니다</h2>
        <p className="text-muted-foreground text-sm">
          첫 컨텐츠를 추가해 기획 트리를 시작하세요.
        </p>
      </div>
      <Button disabled data-testid="add-first-content">
        + 첫 컨텐츠 추가
      </Button>
      <p className="text-muted-foreground text-xs">(트리 편집은 다음 단계에서 제공됩니다)</p>
    </div>
  )
}

function WorkspaceBody() {
  const { loading, projects, currentProject } = useProjects()

  if (loading) {
    return (
      <div className="text-muted-foreground p-6 text-sm" data-testid="projects-loading">
        프로젝트 불러오는 중…
      </div>
    )
  }
  if (projects.length === 0) return <NoProjects />
  if (currentProject) return <ProjectEmptyState />
  return (
    <div className="text-muted-foreground p-6 text-sm">
      프로젝트를 선택하세요.
    </div>
  )
}

function Workspace() {
  const { user, signOut } = useAuth()
  return (
    <div className="min-h-svh" data-testid="app-shell">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold">Canopy</span>
          <ProjectSwitcher />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground text-sm" data-testid="user-email">
            {user?.email}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={signOut}
            data-testid="logout-button"
          >
            로그아웃
          </Button>
        </div>
      </header>
      <main>
        <WorkspaceBody />
      </main>
    </div>
  )
}

export default function App() {
  return (
    <RequireAuth>
      <ProjectProvider>
        <Workspace />
      </ProjectProvider>
    </RequireAuth>
  )
}
