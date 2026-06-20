import { useEffect, useMemo, useState } from "react"
import { useNodes } from "@/nodes/NodesProvider"
import { Markdown } from "@/components/Markdown"
import { memberLabel } from "@/lib/members"
import { BLOOM_GLYPH } from "@/nodes/bloomGlyph"
import { CATEGORY_COLOR } from "@/lib/statuses"
import { CoverHeader } from "@/nodes/CoverHeader"
import { LAYER_COLOR } from "@/nodes/layerColors"
import { ChildNav } from "@/nodes/ChildNav"
import { SubFeatureSections } from "@/ur/SubFeatureSections"
import { WorkSection } from "@/ur/WorkSection"
import { TaskChecklist } from "@/ur/TaskChecklist"
import { TaskUrLinks } from "@/ur/TaskUrLinks"
import { TaskBlocks } from "@/ur/TaskBlocks"
import { WorkLogSection } from "@/ur/WorkLogSection"
import type { NodeDomain } from "@/lib/nodes"
import type { StatusCategory } from "@/lib/statuses"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const DOMAINS: NodeDomain[] = [
  "기획",
  "디자인",
  "사운드",
  "구현",
  "밸런싱",
  "기타",
]
const CATEGORY_ORDER: StatusCategory[] = ["할일", "진행중", "완료", "취소됨"]
const NONE = "__none__"

/** 작은 라벨 + shadcn Select 를 묶은 property 행 셀. */
function PropField({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="inline-flex items-center gap-2">
      <span
        className="text-[11px] font-medium"
        style={{ color: "var(--c-ink-3)" }}
      >
        {label}
      </span>
      {children}
    </label>
  )
}

const triggerClass =
  "h-8 min-w-[7.5rem] gap-1.5 rounded-[9px] bg-card text-[13px] font-medium shadow-xs"

export function NodeDetail() {
  const { nodes, selectedId, updateFields, statuses, members } = useNodes()
  const node = nodes.find((n) => n.id === selectedId) ?? null

  // 패널 편집 모드 — 기본 읽기 전용. '수정' 으로만 편집 진입(실수 편집 방지).
  const [editing, setEditing] = useState(false)
  // 스칼라 필드 드래프트(저장 시 일괄 커밋, 취소 시 폐기).
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [draftStatus, setDraftStatus] = useState(NONE)
  const [draftDomain, setDraftDomain] = useState(NONE)
  const [draftAssignee, setDraftAssignee] = useState(NONE)

  function resetDrafts(n: typeof node) {
    setTitle(n?.title ?? "")
    setBody(n?.body ?? "")
    setDraftStatus(n?.status_id ?? NONE)
    setDraftDomain(n?.domain ?? NONE)
    setDraftAssignee(n?.assignee_id ?? NONE)
  }

  // node 가 바뀌면 편집 종료 + 드래프트 동기화.
  useEffect(() => {
    setEditing(false)
    resetDrafts(node)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node?.id])

  const statusGroups = useMemo(
    () =>
      CATEGORY_ORDER.map((cat) => ({
        cat,
        items: statuses.filter((s) => s.category === cat),
      })).filter((g) => g.items.length > 0),
    [statuses]
  )

  if (!node) {
    return (
      <div
        className="text-muted-foreground flex h-full items-center justify-center p-6 text-sm"
        data-testid="detail-empty"
      >
        노드를 선택하면 상세가 표시됩니다.
      </div>
    )
  }

  const isTask = node.type === "작업"

  function cancelEdit() {
    resetDrafts(node)
    setEditing(false)
  }
  function saveEdit() {
    if (!node) return
    const patch: Record<string, unknown> = {}
    const t = title.trim()
    if (t && t !== node.title) patch.title = t
    if (body !== (node.body ?? "")) patch.body = body
    const status = draftStatus === NONE ? null : draftStatus
    if (status !== node.status_id) patch.status_id = status
    if (isTask) {
      const dom = draftDomain === NONE ? null : draftDomain
      if (dom !== (node.domain ?? null)) patch.domain = dom
      const asg = draftAssignee === NONE ? null : draftAssignee
      if (asg !== (node.assignee_id ?? null)) patch.assignee_id = asg
    }
    if (Object.keys(patch).length) void updateFields(node.id, patch)
    if (!t) setTitle(node.title) // 빈 제목은 되돌림
    setEditing(false)
  }

  // 담당 아바타(현재 드래프트 기준)
  const assignee =
    draftAssignee !== NONE
      ? members.find((m) => m.id === draftAssignee)
      : undefined

  return (
    <div className="mx-auto w-full max-w-5xl" data-testid="node-detail">
      {/* 커버 헤더 — 레이어 칩 + 큰 브레드크럼 + 티켓키 (레이어 틴트 밴드) */}
      <CoverHeader node={node} />

      <div className="flex flex-col gap-6 px-4 py-5 sm:px-8 sm:py-7">
        {/* 편집 바 — 기본 읽기, '수정' 으로 편집 토글(+저장/취소) */}
        <div className="flex items-center justify-end gap-2">
          {editing ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={cancelEdit}
                data-testid="detail-cancel"
              >
                취소
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={saveEdit}
                data-testid="detail-save"
              >
                저장
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditing(true)}
              data-testid="detail-edit"
            >
              수정
            </Button>
          )}
        </div>

        {/* 제목 — 메이플 Bold, 큰 위계. 좌측 얇은 레이어색 액센트 바. 편집 모드에서만 수정. */}
        <div className="flex items-stretch gap-2.5">
          <span
            aria-hidden
            className="mt-1 w-1 shrink-0 rounded-full"
            style={{ background: LAYER_COLOR[node.type].base }}
          />
          <Input
            id="detail-title"
            value={title}
            readOnly={!editing}
            onChange={(e) => setTitle(e.target.value)}
            style={{ fontSize: "clamp(28px, 4vw, 32px)", letterSpacing: "-0.01em" }}
            className="font-display h-auto flex-1 border-transparent bg-transparent px-1 py-0.5 leading-[1.2] font-bold shadow-none read-only:cursor-default hover:bg-[#F5F2F4]/60 read-only:hover:bg-transparent focus-visible:bg-transparent"
            data-testid="detail-title"
          />
        </div>

        {/* property 행 — 상태는 전 타입, 도메인/담당은 작업만. 편집 모드에서만 활성. */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <PropField label="상태">
            <Select
              value={draftStatus}
              disabled={!editing}
              onValueChange={setDraftStatus}
            >
              <SelectTrigger className={triggerClass} data-testid="detail-status">
                <SelectValue placeholder="상태" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>미지정</SelectItem>
                {statusGroups.map((g) => (
                  <SelectGroup key={g.cat}>
                    <SelectLabel>{g.cat}</SelectLabel>
                    {g.items.map((s) => {
                      const G = BLOOM_GLYPH[s.category]
                      return (
                        <SelectItem key={s.id} value={s.id} textValue={s.name}>
                          <G
                            className="size-[14px]"
                            style={{
                              color: s.color ?? CATEGORY_COLOR[s.category],
                            }}
                          />
                          {s.name}
                        </SelectItem>
                      )
                    })}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </PropField>

          {isTask && (
            <>
              <PropField label="도메인">
                <Select
                  value={draftDomain}
                  disabled={!editing}
                  onValueChange={setDraftDomain}
                >
                  <SelectTrigger className={triggerClass} data-testid="detail-domain">
                    <SelectValue placeholder="도메인" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>미지정</SelectItem>
                    {DOMAINS.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </PropField>

              <PropField label="담당">
                <Select
                  value={draftAssignee}
                  disabled={!editing}
                  onValueChange={setDraftAssignee}
                >
                  <SelectTrigger className={triggerClass} data-testid="detail-assignee">
                    {assignee && (
                      <span
                        className="inline-flex size-[18px] shrink-0 items-center justify-center rounded-full text-[9.5px] font-bold"
                        style={{
                          background: "linear-gradient(150deg,#F6CFDD,#EC9EBA)",
                          color: "#9b3a5e",
                        }}
                      >
                        {memberLabel(assignee).slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <SelectValue placeholder="담당" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>없음</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={m.id} textValue={memberLabel(m)}>
                        {memberLabel(m)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </PropField>
            </>
          )}
        </div>

        {/* 설명(body) — 읽기=마크다운 렌더, 편집 모드=textarea */}
        <div className="flex flex-col gap-2">
          <span
            className="text-[11px] font-semibold tracking-wide uppercase"
            style={{ color: "var(--c-ink-3)" }}
          >
            설명
          </span>
          {editing ? (
            <textarea
              id="detail-body"
              className="min-h-32 rounded-[10px] border border-transparent bg-[#F5F2F4] p-3.5 text-sm leading-relaxed outline-none transition-colors hover:bg-[#EFE7EC] focus-visible:border-ring focus-visible:bg-card focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="마크다운으로 설명을 작성하세요 (#, **굵게**, - 목록, | 표 | …)"
              data-testid="detail-body"
            />
          ) : node.body && node.body.trim() ? (
            <div
              className="border-border rounded-[10px] border p-3.5"
              data-testid="body-preview"
            >
              <Markdown>{node.body}</Markdown>
            </div>
          ) : (
            <div
              className="text-muted-foreground border-border rounded-[10px] border border-dashed p-3.5 text-sm"
              data-testid="body-empty"
            >
              설명이 없습니다. ‘수정’으로 추가하세요.
            </div>
          )}
        </div>

        {/* 컨텐츠/기능: 한 단계 아래 자식 드릴다운 네비(항상 보기/네비) */}
        {(node.type === "컨텐츠" || node.type === "기능") && (
          <div className="border-border border-t pt-5">
            <h3 className="font-display mb-3 text-[15px] font-bold">
              {node.type === "컨텐츠" ? "기능" : "세부기능 · 마스터데이터"}
            </h3>
            <ChildNav parentId={node.id} />
          </div>
        )}

        {/* 세부기능: UR/작업 형제 섹션 — 편집 모드에서만 편집 */}
        {node.type === "세부기능" && (
          <div className="border-border border-t pt-5">
            <SubFeatureSections subFeatureId={node.id} editable={editing} />
          </div>
        )}

        {/* 마스터데이터: 작업만 (UR 없음) */}
        {node.type === "마스터데이터" && (
          <div className="border-border border-t pt-5">
            <h3 className="font-display mb-3 text-[15px] font-bold">작업</h3>
            <WorkSection parentId={node.id} editable={editing} />
          </div>
        )}

        {/* 작업 상세: 작업내용 → 연결 요구사항 → 선제조건 (세로 풀폭 스택) */}
        {isTask && (
          <div className="flex flex-col gap-6">
            <div className="border-border border-t pt-6">
              <TaskChecklist workId={node.id} editable={editing} />
            </div>
            <div className="border-border border-t pt-6">
              <TaskUrLinks
                workId={node.id}
                featureId={node.parent_id}
                editable={editing}
              />
            </div>
            <div className="border-border border-t pt-6">
              <TaskBlocks nodeId={node.id} editable={editing} />
            </div>
            <div className="border-border border-t pt-6">
              <WorkLogSection
                workId={node.id}
                assigneeId={node.assignee_id}
                baseMinutes={node.time_spent_minutes}
                editable={editing}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
