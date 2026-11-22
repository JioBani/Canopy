import type { AppNode } from "@/lib/nodes"
import { getPriority, priorityRank, type NodeFields } from "@/lib/fields"

/**
 * 보드 카드 순서 — node.fields.board_rank(숫자, 작을수록 위).
 * node.sort_order 는 트리 형제 순서라 보드 순서와 섞지 않는다(스키마 변경 없음).
 * 랭크 없는 카드는 랭크 있는 카드 뒤에 트리 순서(sort_order → 생성순)로.
 */
export const BOARD_RANK_KEY = "board_rank"
const STEP = 1024

export type BoardSort = "manual" | "priority" | "updated"
export const BOARD_SORTS: { value: BoardSort; label: string }[] = [
  { value: "manual", label: "수동 순서" },
  { value: "priority", label: "우선순위 높은 순" },
  { value: "updated", label: "최근 수정 순" },
]

export function parseBoardSort(q: string): BoardSort {
  return q === "priority" || q === "updated" ? q : "manual"
}

export function getBoardRank(fields: NodeFields | null | undefined): number | null {
  const v = fields?.[BOARD_RANK_KEY]
  return typeof v === "number" && Number.isFinite(v) ? v : null
}

export function withBoardRank(fields: NodeFields | null | undefined, rank: number): NodeFields {
  return { ...(fields ?? {}), [BOARD_RANK_KEY]: rank }
}

function compareManual(a: AppNode, b: AppNode): number {
  const ra = getBoardRank(a.fields)
  const rb = getBoardRank(b.fields)
  if (ra !== null && rb !== null && ra !== rb) return ra - rb
  if (ra !== null && rb === null) return -1
  if (ra === null && rb !== null) return 1
  if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
  return a.created_at.localeCompare(b.created_at)
}

export function sortCards(nodes: AppNode[], sort: BoardSort): AppNode[] {
  const list = [...nodes]
  if (sort === "priority") {
    list.sort(
      (a, b) =>
        priorityRank(getPriority(b.fields)) - priorityRank(getPriority(a.fields)) ||
        compareManual(a, b)
    )
  } else if (sort === "updated") {
    list.sort((a, b) => b.updated_at.localeCompare(a.updated_at) || compareManual(a, b))
  } else {
    list.sort(compareManual)
  }
  return list
}

/**
 * 열의 최종 순서(ordered)에서 movedId 의 새 랭크를 정한다. → id→새 랭크 맵(바뀌는 것만).
 * 이웃 둘 다 랭크가 있고 간격이 있으면 중간값 1건, 아니면 열 전체를 STEP 간격으로 재번호.
 */
export function planReorder(
  ordered: string[],
  movedId: string,
  rankOf: (id: string) => number | null
): Map<string, number> {
  const i = ordered.indexOf(movedId)
  const out = new Map<string, number>()
  if (i < 0) return out
  const prev = i > 0 ? ordered[i - 1] : null
  const next = i < ordered.length - 1 ? ordered[i + 1] : null
  const rp = prev ? rankOf(prev) : null
  const rn = next ? rankOf(next) : null
  const prevOk = !prev || rp !== null
  const nextOk = !next || rn !== null
  if (prevOk && nextOk) {
    let r: number | null = null
    if (rp !== null && rn !== null) r = rn - rp > 1e-6 ? (rp + rn) / 2 : null
    else if (rp !== null) r = rp + STEP
    else if (rn !== null) r = rn - STEP
    else r = 0
    if (r !== null) {
      if (rankOf(movedId) !== r) out.set(movedId, r)
      return out
    }
  }
  ordered.forEach((id, idx) => {
    const r = idx * STEP
    if (rankOf(id) !== r) out.set(id, r)
  })
  return out
}
