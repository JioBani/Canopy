import { useEffect, useMemo, useState } from "react"
import { ChevronsUpDown, FileText, ListTree, Pencil } from "lucide-react"
import { useNodes } from "@/nodes/NodesProvider"
import { Markdown } from "@/components/Markdown"
import { memberLabel } from "@/lib/members"
import { BLOOM_GLYPH } from "@/nodes/bloomGlyph"
import { statusTone } from "@/lib/statusTone"
import { CoverHeader } from "@/nodes/CoverHeader"
import { ChildNav } from "@/nodes/ChildNav"
import { SubFeatureSections } from "@/ur/SubFeatureSections"
import { WorkSection } from "@/ur/WorkSection"
import { TaskChecklist } from "@/ur/TaskChecklist"
import { TaskUrLinks } from "@/ur/TaskUrLinks"
import { TaskBlocks } from "@/ur/TaskBlocks"
import { WorkLogSection } from "@/ur/WorkLogSection"
import type { NodeDomain } from "@/lib/nodes"
import type { StatusCategory } from "@/lib/statuses"
import {
  PRIORITIES,
  PRIORITY_COLOR,
  getPriority,
  withPriority,
  type Priority,
} from "@/lib/fields"
import { Button } from "@/components/ui/button"
import { EmptyNote, PropertyRow, Section } from "@/components/ds"
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

/**
 * 실수 편집 방지 셀렉트 — 본문 클릭으론 안 열리고, 우측 화살표 영역을 눌러야만 열린다.
 * (wrapper 의 pointerdown 캡처에서 전파를 끊어 Radix 트리거 자동 열림을 차단,
 *  화살표 버튼의 onClick 으로만 open 제어.)
 */
function GuardedSelect({
  value,
  onValueChange,
  placeholder,
  testid,
  leading,
  children,
}: {
  value: string
  onValueChange: (v: string) => void
  placeholder: string
  testid: string
  leading?: React.ReactNode
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <Select value={value} onValueChange={onValueChange} open={open} onOpenChange={setOpen}>
      <div
        className="group/gs relative flex w-full"
        onPointerDownCapture={(e) => e.stopPropagation()}
      >
        <SelectTrigger
          className="text-body text-fg data-[placeholder]:text-fg-3 group-hover/gs:bg-hover -ml-2 h-8 justify-start w-[calc(100%+8px)] gap-1.5 border-transparent bg-transparent px-2 font-medium shadow-none [&>svg:last-child]:hidden"
          data-testid={testid}
          tabIndex={-1}
        >
          {leading}
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <button
          type="button"
          aria-label={`${placeholder} 변경`}
          data-testid={`${testid}-arrow`}
          onClick={() => setOpen((o) => !o)}
          className="text-fg-3 hover:text-fg absolute inset-y-0 right-0 flex w-9 cursor-pointer items-center justify-center rounded-r-md"
        >
          <ChevronsUpDown className="size-4" />
        </button>
      </div>
      <SelectContent>{children}</SelectContent>
    </Select>
  )
}

/** 수정/완료 토글 버튼(설명 등). */
function EditToggle({
  editing,
  onToggle,
  testid,
}: {
  editing: boolean
  onToggle: () => void
  testid: string
}) {
  return (
    <Button
      type="button"
      variant={editing ? "default" : "ghost"}
      size="sm"
      onClick={onToggle}
      data-testid={testid}
    >
      {!editing && <Pencil />}
      {editing ? "완료" : "수정"}
    </Button>
  )
}

export function NodeDetail() {
  const { nodes, selectedId, updateFields, statuses, members, getProgress } = useNodes()
  const node = nodes.find((n) => n.id === selectedId) ?? null

  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [editBody, setEditBody] = useState(false) // 설명만 토글, 나머지는 상시/가드 셀렉트

  useEffect(() => {
    setTitle(node?.title ?? "")
    setBody(node?.body ?? "")
    setEditBody(false)
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
        className="text-body text-fg-3 flex h-full items-center justify-center p-6"
        data-testid="detail-empty"
      >
        왼쪽 트리에서 항목을 선택하면 여기에 내용이 표시됩니다.
      </div>
    )
  }

  const isTask = node.type === "작업"
  const set = (patch: Parameters<typeof updateFields>[1]) =>
    void updateFields(node.id, patch)

  function saveTitle() {
    const t = title.trim()
    if (node && t && t !== node.title) void updateFields(node.id, { title: t })
    else setTitle(node?.title ?? "")
  }
  function toggleBody() {
    if (editBody && node && body !== (node.body ?? ""))
      void updateFields(node.id, { body })
    setEditBody((v) => !v)
  }

  const assignee = node.assignee_id
    ? members.find((m) => m.id === node.assignee_id)
    : undefined
  const priority = getPriority(node.fields)
  const np = isTask ? null : getProgress(node.id)

  /* ── 속성 레일 ── */
  const properties = (
    <div className="flex flex-col gap-0.5">
      <PropertyRow label="상태">
        <GuardedSelect
          value={node.status_id ?? NONE}
          onValueChange={(v) => set({ status_id: v === NONE ? null : v })}
          placeholder="상태"
          testid="detail-status"
        >
          <SelectItem value={NONE}>미지정</SelectItem>
          {statusGroups.map((g) => (
            <SelectGroup key={g.cat}>
              <SelectLabel>{g.cat}</SelectLabel>
              {g.items.map((s) => {
                const G = BLOOM_GLYPH[s.category]
                return (
                  <SelectItem key={s.id} value={s.id} textValue={s.name}>
                    <G className="size-4" style={{ color: statusTone(s).fg }} />
                    {s.name}
                  </SelectItem>
                )
              })}
            </SelectGroup>
          ))}
        </GuardedSelect>
      </PropertyRow>

      {/* 우선순위 — 전 타입(커스텀 필드 priority). 값=node.fields.priority. */}
      <PropertyRow label="우선순위">
        <GuardedSelect
          value={priority ?? NONE}
          onValueChange={(v) =>
            set({
              fields: withPriority(
                node.fields,
                v === NONE ? null : (v as Priority)
              ),
            })
          }
          placeholder="우선순위"
          testid="detail-priority"
        >
          <SelectItem value={NONE}>미지정</SelectItem>
          {PRIORITIES.map((p) => (
            <SelectItem key={p} value={p} textValue={p}>
              <span
                aria-hidden
                className="inline-block size-2.5 shrink-0 rounded-full"
                style={{ background: PRIORITY_COLOR[p] }}
              />
              {p}
            </SelectItem>
          ))}
        </GuardedSelect>
      </PropertyRow>

      {isTask && (
        <>
          <PropertyRow label="도메인">
            <GuardedSelect
              value={node.domain ?? NONE}
              onValueChange={(v) =>
                set({ domain: (v === NONE ? null : v) as NodeDomain | null })
              }
              placeholder="도메인"
              testid="detail-domain"
            >
              <SelectItem value={NONE}>미지정</SelectItem>
              {DOMAINS.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </GuardedSelect>
          </PropertyRow>

          <PropertyRow label="담당">
            <GuardedSelect
              value={node.assignee_id ?? NONE}
              onValueChange={(v) => set({ assignee_id: v === NONE ? null : v })}
              placeholder="담당"
              testid="detail-assignee"
              leading={
                assignee ? (
                  <span
                    className="text-micro inline-flex size-[22px] shrink-0 items-center justify-center rounded-full"
                    style={{
                      background: assignee.color ?? "#F6D3E0",
                      color: "#3B1D2A",
                    }}
                  >
                    {memberLabel(assignee).slice(0, 1).toUpperCase()}
                  </span>
                ) : undefined
              }
            >
              <SelectItem value={NONE}>없음</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id} textValue={memberLabel(m)}>
                  {memberLabel(m)}
                </SelectItem>
              ))}
            </GuardedSelect>
          </PropertyRow>
        </>
      )}
    </div>
  )

  return (
    <div className="@container mx-auto w-full max-w-[1120px] px-4 py-5 sm:px-8 sm:py-6" data-testid="node-detail">
      {/* 헤더 줄 — 경로 · 타입 · 티켓키 */}
      <CoverHeader node={node} />

      {/* 제목 — 인라인 상시 편집(Enter/blur 저장). 긴 제목은 줄바꿈. */}
      <textarea
        id="detail-title"
        rows={1}
        value={title}
        onChange={(e) => setTitle(e.target.value.replace(/\n/g, ""))}
        onBlur={saveTitle}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            e.currentTarget.blur()
          }
        }}
        aria-label="제목"
        className="text-title text-fg hover:bg-hover/70 focus-visible:bg-surface focus-visible:outline-brand/40 mt-3 mb-5 -ml-2 block w-[calc(100%+8px)] resize-none rounded-md bg-transparent px-2 py-0.5 [field-sizing:content]"
        data-testid="detail-title"
      />

      <div className="grid items-start gap-4 @[880px]:grid-cols-[minmax(0,1fr)_264px] @[880px]:gap-6">
        {/* 속성 레일 — 넓으면 우측 sticky, 좁으면 위쪽 카드 */}
        <aside
          className="bg-surface border-line rounded-card border @[880px]:sticky @[880px]:top-4 @[880px]:order-2"
          aria-label="속성"
        >
          <div className="px-5 pt-3 pb-3">{properties}</div>
          {np && np.total_urs > 0 && np.progress != null && (
            <div className="border-line text-meta text-fg-3 border-t px-5 py-3">
              진행률{" "}
              <b className="text-fg tnum font-semibold">{Math.round(np.progress * 100)}%</b>
              {" · "}요구사항 {np.done_urs}/{np.total_urs} 완료
            </div>
          )}
        </aside>

        {/* 읽기 컬럼 */}
        <div className="flex min-w-0 flex-col gap-4 @[880px]:order-1">
          {/* 설명(body) — 읽기=마크다운, '수정' 토글 시 textarea */}
          <Section
            icon={<FileText />}
            title="설명"
            actions={
              <EditToggle editing={editBody} onToggle={toggleBody} testid="body-edit-toggle" />
            }
          >
            {editBody ? (
              <textarea
                id="detail-body"
                autoFocus
                className="text-reading text-fg border-line-strong bg-surface focus-visible:border-brand focus-visible:outline-brand/30 min-h-48 w-full rounded-lg border p-4 outline-none focus-visible:outline-2"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="마크다운으로 설명을 작성하세요 (#, **굵게**, - 목록, | 표 | …)"
                data-testid="detail-body"
              />
            ) : node.body && node.body.trim() ? (
              <div data-testid="body-preview">
                <Markdown>{node.body}</Markdown>
              </div>
            ) : (
              <EmptyNote data-testid="body-empty">
                설명이 없습니다. <b className="text-fg-2 font-semibold">수정</b>을 눌러 추가하세요.
              </EmptyNote>
            )}
          </Section>

          {/* 컨텐츠/기능: 한 단계 아래 자식 드릴다운 네비 */}
          {(node.type === "컨텐츠" || node.type === "기능") && (
            <Section
              icon={<ListTree />}
              title={node.type === "컨텐츠" ? "기능" : "세부기능 · 마스터데이터"}
              flush
            >
              <ChildNav parentId={node.id} />
            </Section>
          )}

          {/* 세부기능: 요구사항 / 작업 카드 */}
          {node.type === "세부기능" && (
            <SubFeatureSections subFeatureId={node.id} editable />
          )}

          {/* 마스터데이터: 작업만 (UR 없음) */}
          {node.type === "마스터데이터" && (
            <WorkSection parentId={node.id} />
          )}

          {/* 작업 상세: 작업 내용 → 연결 요구사항 → 선제조건 → 작업 시간 */}
          {isTask && (
            <>
              <TaskChecklist workId={node.id} editable />
              <TaskUrLinks workId={node.id} featureId={node.parent_id} editable />
              <TaskBlocks nodeId={node.id} editable />
              <WorkLogSection
                workId={node.id}
                assigneeId={node.assignee_id}
                baseMinutes={node.time_spent_minutes}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
