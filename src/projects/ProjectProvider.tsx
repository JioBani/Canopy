import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { toast } from "sonner"
import {
  insertProject,
  listProjects,
  type Project,
} from "@/lib/projects"
import { buildPath, navigate, parseRoute, useUrl } from "@/lib/router"

const STORAGE_KEY = "canopy.currentProjectId"

interface ProjectContextValue {
  projects: Project[]
  currentProject: Project | null
  currentProjectId: string | null
  loading: boolean
  selectProject: (id: string) => void
  createProject: (name: string) => Promise<Project>
  reload: () => Promise<void>
}

const ProjectContext = createContext<ProjectContextValue | undefined>(undefined)

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}
function writeStored(id: string | null) {
  try {
    if (id) localStorage.setItem(STORAGE_KEY, id)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* 저장 불가 환경 무시 */
  }
}

/**
 * 현재 프로젝트 = URL(/p/:projectId) 이 정본. URL 에 없으면 마지막 프로젝트(localStorage) → 첫 프로젝트로
 * replace. URL 의 프로젝트가 목록에 없으면(삭제·권한 없음) 안내 후 폴백 프로젝트로 replace.
 */
export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const { pathname } = useUrl()
  const routeProjectId = parseRoute(pathname).projectId
  const currentProjectId = routeProjectId ?? readStored()

  const reload = useCallback(async () => {
    setLoading(true)
    setProjects(await listProjects())
    setLoading(false)
  }, [])

  useEffect(() => {
    reload().catch((e) => {
      console.error("[projects] 목록 로드 실패:", e)
      setLoading(false)
    })
  }, [reload])

  // URL ↔ 프로젝트 목록 정합: 없는/빈 프로젝트 id 를 가까운 유효 위치로 안내.
  useEffect(() => {
    if (loading) return
    const exists = (id: string | null) => !!id && projects.some((p) => p.id === id)
    if (routeProjectId && exists(routeProjectId)) {
      writeStored(routeProjectId)
      return
    }
    const stored = readStored()
    const fallback = exists(stored) ? stored : (projects[0]?.id ?? null)
    if (routeProjectId) {
      toast.warning("링크의 프로젝트를 찾을 수 없습니다", {
        description: fallback ? "접근 가능한 프로젝트로 이동했습니다." : "프로젝트 목록으로 이동했습니다.",
      })
    }
    writeStored(fallback)
    navigate(fallback ? buildPath(fallback, "tree") : "/", { replace: true })
  }, [loading, projects, routeProjectId])

  const selectProject = useCallback(
    (id: string) => {
      if (projects.some((p) => p.id === id)) navigate(buildPath(id, "tree"))
    },
    [projects]
  )

  const createProject = useCallback(async (name: string) => {
    const created = await insertProject(name)
    setProjects((prev) => [...prev, created])
    writeStored(created.id)
    navigate(buildPath(created.id, "tree"))
    return created
  }, [])

  const currentProject = useMemo(
    () => projects.find((p) => p.id === currentProjectId) ?? null,
    [projects, currentProjectId]
  )

  const value: ProjectContextValue = {
    projects,
    currentProject,
    currentProjectId,
    loading,
    selectProject,
    createProject,
    reload,
  }

  return (
    <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useProjects() {
  const ctx = useContext(ProjectContext)
  if (!ctx) {
    throw new Error("useProjects 는 <ProjectProvider> 내부에서만 사용할 수 있습니다.")
  }
  return ctx
}
