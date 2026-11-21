import { useCallback, useEffect, useMemo, useState } from "react"
import {
  listUrCoverageByFeature,
  listUrGroups,
  listUrs,
  listWorkLinksBySubFeature,
  type Ur,
  type UrCoverage,
  type UrGroup,
} from "@/lib/ur"

export interface SubFeatureUrData {
  groups: UrGroup[]
  urs: Ur[]
  cov: Map<string, UrCoverage>
  /** ur_id → 연결 작업 id[] */
  worksByUr: Map<string, string[]>
  /** work_id → 이 세부기능의 연결 UR id[] */
  ursByWork: Map<string, string[]>
  loading: boolean
  reload: () => Promise<void>
}

/**
 * 세부기능 하나의 UR 그룹·UR·커버리지·UR↔작업 링크를 한 번에 로드.
 * 상세의 두 탭(요구사항→작업 / 작업→요구사항)이 같은 데이터를 공유한다.
 * loading 은 최초 로드에만 true (재조회 시 화면이 깜박이거나 스크롤이 튀지 않게).
 */
export function useSubFeatureUrData(subFeatureId: string, enabled = true): SubFeatureUrData {
  const [groups, setGroups] = useState<UrGroup[]>([])
  const [urs, setUrs] = useState<Ur[]>([])
  const [cov, setCov] = useState<Map<string, UrCoverage>>(new Map())
  const [links, setLinks] = useState<{ ur_id: string; work_id: string }[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!enabled) return
    const [g, u, c, l] = await Promise.all([
      listUrGroups(subFeatureId),
      listUrs([subFeatureId]),
      listUrCoverageByFeature(subFeatureId),
      listWorkLinksBySubFeature(subFeatureId),
    ])
    setGroups(g)
    setUrs(u)
    setCov(new Map(c.map((x) => [x.ur_id, x])))
    setLinks(l)
    setLoading(false)
  }, [subFeatureId, enabled])

  useEffect(() => {
    setLoading(true)
    reload().catch((e) => {
      console.error("[ur] 로드 실패:", e)
      setLoading(false)
    })
  }, [reload])

  const { worksByUr, ursByWork } = useMemo(() => {
    const w = new Map<string, string[]>()
    const u = new Map<string, string[]>()
    for (const { ur_id, work_id } of links) {
      w.set(ur_id, [...(w.get(ur_id) ?? []), work_id])
      u.set(work_id, [...(u.get(work_id) ?? []), ur_id])
    }
    return { worksByUr: w, ursByWork: u }
  }, [links])

  return { groups, urs, cov, worksByUr, ursByWork, loading, reload }
}
