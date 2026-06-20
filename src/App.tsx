import { useAuth } from "@/auth/AuthProvider"
import { RequireAuth } from "@/auth/RequireAuth"
import { ProjectProvider, useProjects } from "@/projects/ProjectProvider"
import { ProjectSwitcher } from "@/projects/ProjectSwitcher"
import { NoProjects } from "@/projects/NoProjects"
import { NodesProvider, useNodes } from "@/nodes/NodesProvider"
import { TreeView } from "@/nodes/TreeView"
import { NodeDetail } from "@/nodes/NodeDetail"
import { BoardView } from "@/board/BoardView"
import { DashboardView } from "@/dashboard/DashboardView"
import { SearchButton } from "@/search/SearchDialog"
import { StatusSettingsButton } from "@/projects/StatusSettingsDialog"
import { BloomFull } from "@/nodes/bloomGlyph"
import { LogOut } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

/** 브랜드 마크 + 워드마크 (메이플체). */
function Brand() {
  return (
    <span className="flex select-none items-center gap-1.5">
      <BloomFull style={{ color: "var(--c-sakura)" }} className="size-[19px]" />
      <span className="font-display relative top-px text-[17px] font-bold tracking-tight">
        Canopy
      </span>
    </span>
  )
}

/** 유저 메뉴 — 아바타 → 이메일 + 로그아웃 (긴 이메일을 톱바에서 숨김). */
function UserMenu() {
  const { user, signOut } = useAuth()
  const email = user?.email ?? ""
  const initial = email.slice(0, 1).toUpperCase() || "·"
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-testid="user-menu"
          title={email}
          className="flex size-8 items-center justify-center rounded-full text-[12px] font-bold text-white shadow-[0_0_0_1px_var(--c-line-2),0_1px_2px_rgba(150,60,90,.16)] transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          style={{ background: "linear-gradient(150deg,#F6CFDD,#EC9EBA)", color: "#9b3a5e" }}
        >
          {initial}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="text-muted-foreground text-[11px] font-normal">로그인 계정</span>
          <span className="truncate text-[13px]" data-testid="user-email">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={signOut} data-testid="logout-button">
          <LogOut className="size-4" />
          로그아웃
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** 통합 톱바 — 모든 상태에서 동일한 chrome. center(탭)·tools(검색/설정)는 선택적. */
function TopBar({
  center,
  tools,
}: {
  center?: React.ReactNode
  tools?: React.ReactNode
}) {
  return (
    <header
      className="border-border flex h-[52px] shrink-0 items-center gap-2 border-b px-3"
      data-testid="app-shell"
    >
      <Brand />
      <span className="bg-[var(--c-line-2)] mx-1 h-5 w-px" />
      <ProjectSwitcher />
      <div className="flex-1" />
      {center}
      {tools && <div className="flex items-center gap-1.5">{tools}</div>}
      <span className="bg-[var(--c-line-2)] mx-1 h-5 w-px" />
      <UserMenu />
    </header>
  )
}

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
        "rounded-md px-3 py-1 text-[13px] font-semibold transition-colors",
        active
          ? "bg-card text-foreground shadow-[0_1px_2px_rgba(90,40,60,.10),0_0_0_1px_var(--c-line)]"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  )
}

/** 트리/보드/대시보드 — 통합 톱바 + 뷰. (view 는 NodesProvider 공유) */
function WorkspaceInner() {
  const { view, setView } = useNodes()
  return (
    <div className="flex h-svh flex-col">
      <TopBar
        center={
          <div
            className="flex items-center gap-0.5 rounded-lg bg-[var(--c-bg-sunken)] p-0.5"
            role="tablist"
          >
            <SegmentTab active={view === "tree"} onClick={() => setView("tree")} testid="view-tab-tree">
              트리
            </SegmentTab>
            <SegmentTab active={view === "board"} onClick={() => setView("board")} testid="view-tab-board">
              보드
            </SegmentTab>
            <SegmentTab active={view === "dashboard"} onClick={() => setView("dashboard")} testid="view-tab-dashboard">
              대시보드
            </SegmentTab>
          </div>
        }
        tools={
          <>
            <SearchButton />
            <StatusSettingsButton />
          </>
        }
      />

      {view === "tree" && (
        <div className="flex min-h-0 flex-1">
          <aside
            className="border-border flex w-[300px] shrink-0 flex-col overflow-y-auto border-r bg-[var(--c-surface)]"
            data-testid="tree-panel"
          >
            <TreeView />
          </aside>
          <section className="flex-1 overflow-y-auto">
            <NodeDetail />
          </section>
        </div>
      )}
      {view === "board" && (
        <div className="min-h-0 flex-1">
          <BoardView />
        </div>
      )}
      {view === "dashboard" && (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <DashboardView />
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

/** 프로젝트 없음/로딩 등 — 톱바 chrome 유지 + 중앙 메시지. */
function EdgeShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-svh flex-col">
      <TopBar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}

function WorkspaceBody() {
  const { loading, projects, currentProject } = useProjects()

  if (loading) {
    return (
      <EdgeShell>
        <div className="text-muted-foreground p-6 text-sm" data-testid="projects-loading">
          프로젝트 불러오는 중…
        </div>
      </EdgeShell>
    )
  }
  if (projects.length === 0) {
    return (
      <EdgeShell>
        <NoProjects />
      </EdgeShell>
    )
  }
  if (currentProject) return <ProjectWorkspace projectId={currentProject.id} />
  return (
    <EdgeShell>
      <div className="text-muted-foreground flex h-full items-center justify-center p-6 text-sm">
        프로젝트를 선택하세요.
      </div>
    </EdgeShell>
  )
}

export default function App() {
  return (
    <RequireAuth>
      <ProjectProvider>
        <WorkspaceBody />
      </ProjectProvider>
    </RequireAuth>
  )
}
