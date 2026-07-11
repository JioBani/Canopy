import { supabase } from "@/lib/supabase"

/**
 * 커스텀 필드(schema-as-data). 필드 "정의"는 field_def 테이블에, 값은 node.fields(jsonb)에
 * 인라인 저장한다 — 새 필드 추가 시 스키마/코드 변경이 최소. 필드 "관리 UI"는 사용자에게
 * 노출하지 않지만(설계만 일반화), 요구 기능인 '우선순위'는 아래에 concretely 노출한다.
 */

export type FieldType =
  | "text"
  | "multiline"
  | "number"
  | "bool"
  | "select"
  | "multiselect"
  | "date"

export interface FieldOption {
  value: string
  order: number
}

export interface FieldDef {
  id: string
  project_id: string
  key: string
  label: string
  type: FieldType
  options: FieldOption[]
  /** 적용 대상 노드 타입 배열. '*' = 전체. */
  applies_to: string[]
  default_value: string | null
  required: boolean
  sort_order: number
}

/** 프로젝트의 커스텀 필드 정의 목록 (sort_order). */
export async function listFieldDefs(projectId: string): Promise<FieldDef[]> {
  const { data, error } = await supabase
    .from("field_def")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as FieldDef[]
}

/** 노드 커스텀 값 컨테이너. */
export type NodeFields = Record<string, unknown>

// ── 우선순위 — 구체 노출 필드 (0007 마이그레이션이 프로젝트마다 시드) ──────────
// DB enum 을 UI 에서 상수로 미러하는 기존 관례(DOMAINS·CATEGORY_ORDER)와 동일.

export const PRIORITY_FIELD_KEY = "priority"

export type Priority = "매우낮음" | "낮음" | "보통" | "높음" | "매우높음" | "최우선"

/** 낮음→높음 순. index = rank(0..5). */
export const PRIORITIES: Priority[] = [
  "매우낮음",
  "낮음",
  "보통",
  "높음",
  "매우높음",
  "최우선",
]

/** 우선순위 뱃지 색 — 차분(낮음)→긴급(높음) 램프. */
export const PRIORITY_COLOR: Record<Priority, string> = {
  매우낮음: "#ABA2A8", // mist
  낮음: "#8AA6C2", // blue-gray
  보통: "#62B08A", // green
  높음: "#E8B45C", // amber
  매우높음: "#EC8A5A", // peach/orange
  최우선: "#D6495A", // ember(red)
}

/** 정렬용 랭크(0=매우낮음 … 5=최우선). 미지정은 -1. */
export function priorityRank(p: Priority | null): number {
  return p ? PRIORITIES.indexOf(p) : -1
}

/** node.fields 에서 우선순위를 안전하게 읽는다(유효값만). */
export function getPriority(fields: NodeFields | null | undefined): Priority | null {
  const v = fields?.[PRIORITY_FIELD_KEY]
  return typeof v === "string" && (PRIORITIES as string[]).includes(v)
    ? (v as Priority)
    : null
}

/** 우선순위 값을 반영한 새 fields 객체를 만든다(null = 키 제거). 원본 불변. */
export function withPriority(
  fields: NodeFields | null | undefined,
  p: Priority | null
): NodeFields {
  const next: NodeFields = { ...(fields ?? {}) }
  if (p === null) delete next[PRIORITY_FIELD_KEY]
  else next[PRIORITY_FIELD_KEY] = p
  return next
}
