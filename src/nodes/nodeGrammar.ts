/**
 * 노드 타입 문법 (기획서 §5). DB 트리거가 강제하지만, 프론트에서도 동일 규칙으로
 * "허용된 자식 타입만" 제시해 서버 에러로 떨어지지 않게 한다(UX 일관성).
 */

export type NodeType =
  | "컨텐츠"
  | "기능"
  | "세부기능"
  | "마스터데이터"
  | "작업"

export const NODE_TYPES: NodeType[] = [
  "컨텐츠",
  "기능",
  "세부기능",
  "마스터데이터",
  "작업",
]

/** 최상위(parent=null)에 만들 수 있는 타입. */
export const ROOT_CHILD_TYPE: NodeType = "컨텐츠"

/** 부모 타입 → 허용 자식 타입. */
export const ALLOWED_CHILDREN: Record<NodeType, NodeType[]> = {
  컨텐츠: ["기능"],
  기능: ["세부기능", "마스터데이터"],
  세부기능: ["작업"],
  마스터데이터: ["작업"],
  작업: [],
}

/**
 * 주어진 부모 타입(null=최상위) 아래 만들 수 있는 자식 타입 목록.
 */
export function allowedChildTypes(parentType: NodeType | null): NodeType[] {
  return parentType === null ? [ROOT_CHILD_TYPE] : ALLOWED_CHILDREN[parentType]
}

/** 잎(자식 불가) 여부. */
export function isLeafType(type: NodeType): boolean {
  return ALLOWED_CHILDREN[type].length === 0
}

/** 타입 표시 메타 (라벨/색). 아이콘은 컴포넌트 레이어에서 매핑. */
export const TYPE_META: Record<NodeType, { label: string; color: string }> = {
  컨텐츠: { label: "컨텐츠", color: "text-amber-600" },
  기능: { label: "기능", color: "text-sky-600" },
  세부기능: { label: "세부기능", color: "text-violet-600" },
  마스터데이터: { label: "마스터데이터", color: "text-emerald-600" },
  작업: { label: "작업", color: "text-muted-foreground" },
}

/** 티켓 키 프리픽스 — 타입 기반(프로젝트 무관). 사용자 확정 영문명. */
export const TICKET_PREFIX: Record<NodeType, string> = {
  컨텐츠: "Content",
  기능: "Feature",
  세부기능: "SubFeature",
  마스터데이터: "MasterData",
  작업: "Task",
}

/** 티켓키 조합: `{Type}-{ticket_number}` (예: Task-1, Feature-3). */
export function ticketKey(type: NodeType, ticketNumber: number): string {
  return `${TICKET_PREFIX[type]}-${ticketNumber}`
}

/** UR 티켓키: `Requirement-{번호}` (타입 기반 키와 일관). */
export function urKey(ticketNumber: number): string {
  return `Requirement-${ticketNumber}`
}
