import { useAuth } from "@/auth/AuthProvider"
import { RequireAuth } from "@/auth/RequireAuth"
import { ProjectProvider, useProjects } from "@/projects/ProjectProvider"
import { ProjectSwitcher } from "@/projects/ProjectSwitcher"
import { NoProjects } from "@/projects/NoProjects"
import { NodesProvider } from "@/nodes/NodesProvider"
import { TreeView } from "@/nodes/TreeView"
import { NodeDetail } from "@/nodes/NodeDetail"
import { StatusSettingsButton } from "@/projects/StatusSettingsDialog"
import { BloomFull } from "@/nodes/bloomGlyph"
import { Button } from "@/components/ui/button"

/** 트리(좌) + 상세(우) 분할. 상세 패널은 다음 단계에서 채운다. */
function ProjectWorkspace({ projectId }: { projectId: string }) {
  return (
    <NodesProvider projectId={projectId}>
      <div className="flex min-h-[calc(100svh-57px)]">
        <aside
          className="flex w-80 shrink-0 flex-col overflow-y-auto border-r"
          data-testid="tree-panel"
        >
          <div className="flex items-center justify-between border-b px-2 py-1">
            <span className="text-muted-foreground text-xs font-medium">트리</span>
            <StatusSettingsButton />
          </div>
          <TreeView />
        </aside>
        <section className="flex-1 overflow-y-auto">
          <NodeDetail />
        </section>
      </div>
    </NodesProvider>
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
  if (currentProject) return <ProjectWorkspace projectId={currentProject.id} />
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
          <span className="flex items-center gap-1.5">
            <BloomFull style={{ color: "var(--c-sakura)" }} className="size-[18px]" />
            <span className="font-display text-lg font-bold">Canopy</span>
          </span>
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
