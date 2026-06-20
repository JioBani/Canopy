import { useAuth } from "@/auth/AuthProvider"
import { RequireAuth } from "@/auth/RequireAuth"
import { ProjectProvider, useProjects } from "@/projects/ProjectProvider"
import { ProjectSwitcher } from "@/projects/ProjectSwitcher"
import { NoProjects } from "@/projects/NoProjects"
import { NodesProvider, useNodes } from "@/nodes/NodesProvider"
import { TreeView } from "@/nodes/TreeView"
import { NodeDetail } from "@/nodes/NodeDetail"
import { BoardView } from "@/board/BoardView"
import { SearchButton } from "@/search/SearchDialog"
import { StatusSettingsButton } from "@/projects/StatusSettingsDialog"
import { BloomFull } from "@/nodes/bloomGlyph"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function SegmentTab({
  active,
  onClick,
  children,
  testid,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  testid: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testid}
      aria-pressed={active}
      className={cn(
        "rounded-md px-3 py-1 text-sm font-medium transition-colors",
        active
          ? "bg-card text-foreground shadow-xs"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  )
}

/** 트리/보드 뷰 전환 + 각 뷰. (view 는 NodesProvider 공유 — 카드/검색 점프가 트리로 전환) */
function WorkspaceInner() {
  const { view, setView } = useNodes()
  return (
    <div className="flex h-[calc(100svh-57px)] flex-col">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <div
          className="flex items-center gap-1 rounded-lg bg-[var(--c-bg-sunken)] p-0.5"
          role="tablist"
        >
          <SegmentTab
            active={view === "tree"}
            onClick={() => setView("tree")}
            testid="view-tab-tree"
          >
            트리
          </SegmentTab>
          <SegmentTab
            active={view === "board"}
            onClick={() => setView("board")}
            testid="view-tab-board"
          >
            보드
          </SegmentTab>
        </div>
        <SearchButton />
        <StatusSettingsButton />
      </div>

      {view === "tree" ? (
        <div className="flex min-h-0 flex-1">
          <aside
            className="flex w-80 shrink-0 flex-col overflow-y-auto border-r"
            data-testid="tree-panel"
          >
            <TreeView />
          </aside>
          <section className="flex-1 overflow-y-auto">
            <NodeDetail />
          </section>
        </div>
      ) : (
        <div className="min-h-0 flex-1">
          <BoardView />
        </div>
      )}
    </div>
  )
}

function ProjectWorkspace({ projectId }: { projectId: string }) {
  return (
    <NodesProvider projectId={projectId}>
      <WorkspaceInner />
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
