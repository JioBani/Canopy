import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import {
  insertProject,
  listProjects,
  type Project,
} from "@/lib/projects"

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

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(() =>
    localStorage.getItem(STORAGE_KEY)
  )

  const persistCurrent = useCallback((id: string | null) => {
    setCurrentProjectId(id)
    if (id) localStorage.setItem(STORAGE_KEY, id)
    else localStorage.removeItem(STORAGE_KEY)
  }, [])

  const reload = useCallback(async () => {
    setLoading(true)
    const list = await listProjects()
    setProjects(list)
    // 저장된 현재 프로젝트가 목록에 없으면 첫 프로젝트로 폴백.
    setCurrentProjectId((prev) => {
      const stillExists = prev && list.some((p) => p.id === prev)
      const next = stillExists ? prev : (list[0]?.id ?? null)
      if (next) localStorage.setItem(STORAGE_KEY, next)
      else localStorage.removeItem(STORAGE_KEY)
      return next
    })
    setLoading(false)
  }, [])

  useEffect(() => {
    reload().catch((e) => {
      console.error("[projects] 목록 로드 실패:", e)
      setLoading(false)
    })
  }, [reload])

  const selectProject = useCallback(
    (id: string) => {
      if (projects.some((p) => p.id === id)) persistCurrent(id)
    },
    [projects, persistCurrent]
  )

  const createProject = useCallback(
    async (name: string) => {
      const created = await insertProject(name)
      setProjects((prev) => [...prev, created])
      persistCurrent(created.id)
      return created
    },
    [persistCurrent]
  )

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
