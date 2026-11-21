/**
 * 최소 URL 라우터 — 앱 상태를 path + query 로 표현한다(외부 라우터 의존 없음).
 *
 * 경로 규칙
 *   /                                   → 마지막(또는 첫) 프로젝트로 replace
 *   /p/:projectId                       → 트리, 선택 없음
 *   /p/:projectId/tree[/:nodeRef]       → 트리 + 선택 노드 (nodeRef = 티켓키 "Task-4" 또는 uuid)
 *   /p/:projectId/board?layer=&domain=… → 보드 + 필터
 *   /p/:projectId/dashboard             → 대시보드
 * 상세 보조 상태(예: 펼친 요구사항)는 query(?ur=Requirement-20).
 *
 * 히스토리 정책: 화면/선택 변경 = push, 필터·펼침 같은 보조 상태 = replace.
 */
import { useSyncExternalStore } from "react"

export type AppView = "tree" | "board" | "dashboard"

const NAV_EVENT = "canopy:navigate"

function subscribe(cb: () => void) {
  window.addEventListener("popstate", cb)
  window.addEventListener(NAV_EVENT, cb)
  return () => {
    window.removeEventListener("popstate", cb)
    window.removeEventListener(NAV_EVENT, cb)
  }
}

const snapshot = () => window.location.pathname + window.location.search

/** 현재 URL(pathname+search) — 변경 시 리렌더. */
export function useUrl(): { pathname: string; search: string; params: URLSearchParams } {
  const href = useSyncExternalStore(subscribe, snapshot, snapshot)
  const qi = href.indexOf("?")
  const pathname = qi < 0 ? href : href.slice(0, qi)
  const search = qi < 0 ? "" : href.slice(qi)
  return { pathname, search, params: new URLSearchParams(search) }
}

/** 앱 내부 이동. 같은 URL 이면 무시. */
export function navigate(to: string, opts: { replace?: boolean } = {}) {
  if (to === snapshot()) return
  if (opts.replace) history.replaceState(null, "", to)
  else history.pushState(null, "", to)
  window.dispatchEvent(new Event(NAV_EVENT))
}

export interface Route {
  projectId: string | null
  view: AppView
  nodeRef: string | null
}

const VIEWS: AppView[] = ["tree", "board", "dashboard"]

export function parseRoute(pathname: string): Route {
  const seg = pathname.split("/").filter(Boolean).map(decodeURIComponent)
  if (seg[0] !== "p" || !seg[1]) return { projectId: null, view: "tree", nodeRef: null }
  const view = (VIEWS as string[]).includes(seg[2] ?? "") ? (seg[2] as AppView) : "tree"
  const nodeRef = view === "tree" ? (seg[3] ?? null) : null
  return { projectId: seg[1], view, nodeRef }
}

export function buildPath(
  projectId: string,
  view: AppView = "tree",
  nodeRef?: string | null,
  query?: Record<string, string | null | undefined>
): string {
  let p = `/p/${encodeURIComponent(projectId)}/${view}`
  if (view === "tree" && nodeRef) p += `/${encodeURIComponent(nodeRef)}`
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(query ?? {})) if (v) q.set(k, v)
  const qs = q.toString()
  return qs ? `${p}?${qs}` : p
}

/** 현재 경로를 유지한 채 query 일부만 바꾼다(기본 replace). null/"" = 제거. */
export function setQuery(
  patch: Record<string, string | null | undefined>,
  opts: { replace?: boolean } = { replace: true }
) {
  const q = new URLSearchParams(window.location.search)
  for (const [k, v] of Object.entries(patch)) {
    if (v) q.set(k, v)
    else q.delete(k)
  }
  const qs = q.toString()
  navigate(window.location.pathname + (qs ? `?${qs}` : ""), { replace: opts.replace ?? true })
}

/** query 하나를 state 처럼 쓰는 훅 — 값 변경은 replace. */
export function useQueryParam(name: string): [string, (v: string | null) => void] {
  const { params } = useUrl()
  return [params.get(name) ?? "", (v) => setQuery({ [name]: v })]
}
