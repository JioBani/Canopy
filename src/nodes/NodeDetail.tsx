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
  const { nodes, selectedId, updateFields, statuses, members, getStatus } =
    useNodes()
  const node = nodes.find((n) => n.id === selectedId) ?? null

  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [editingBody, setEditingBody] = useState(false)

  useEffect(() => {
    setTitle(node?.title ?? "")
    setBody(node?.body ?? "")
    setEditingBody(false)
    // node 가 바뀔 때만 로컬 입력 동기화
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

  function saveTitle() {
    const t = title.trim()
    if (node && t && t !== node.title) void updateFields(node.id, { title: t })
    else setTitle(node?.title ?? "")
  }
  function saveBody() {
    if (node && body !== (node.body ?? ""))
      void updateFields(node.id, { body })
  }

  // 상태 칩 리딩 글리프
  const curStatus = getStatus(node.status_id)
  const StatusGlyph = curStatus ? BLOOM_GLYPH[curStatus.category] : null
  const statusLeading = StatusGlyph ? (
    <StatusGlyph
      className="size-[14px] shrink-0"
      style={{
        color: curStatus!.color ?? CATEGORY_COLOR[curStatus!.category],
      }}
    />
  ) : (
    <span
      className="inline-block size-[10px] shrink-0 rounded-full border"
      style={{ borderColor: "var(--c-ink-3)" }}
    />
  )

  // 담당 아바타
  const assignee = node.assignee_id
    ? members.find((m) => m.id === node.assignee_id)
    : undefined

  return (
    <div className="mx-auto w-full max-w-5xl" data-testid="node-detail">
      {/* 커버 헤더 — 레이어 칩 + 큰 브레드크럼 + 티켓키 (레이어 틴트 밴드) */}
      <CoverHeader node={node} />

      <div className="flex flex-col gap-6 px-8 py-7">
        {/* 제목 — 메이플 Bold, 큰 위계. 좌측 얇은 레이어색 액센트 바. */}
        <div className="flex items-stretch gap-2.5">
          <span
            aria-hidden
            className="mt-1 w-1 shrink-0 rounded-full"
            style={{ background: LAYER_COLOR[node.type].base }}
          />
          <Input
            id="detail-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur()
            }}
            style={{ fontSize: "clamp(28px, 4vw, 32px)", letterSpacing: "-0.01em" }}
            className="font-display h-auto flex-1 border-transparent bg-transparent px-1 py-0.5 leading-[1.2] font-bold shadow-none hover:bg-[#F5F2F4]/60 focus-visible:bg-transparent"
            data-testid="detail-title"
          />
        </div>

      {/* 작업 전용 — property 행 (shadcn Select) */}
      {isTask && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <PropField label="상태">
            <Select
              value={node.status_id ?? NONE}
              onValueChange={(v) =>
                void updateFields(node.id, {
                  status_id: v === NONE ? null : v,
                })
              }
            >
              <SelectTrigger
                className={triggerClass}
                data-testid="detail-status"
              >
                {statusLeading}
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

          <PropField label="도메인">
            <Select
              value={node.domain ?? NONE}
              onValueChange={(v) =>
                void updateFields(node.id, {
                  domain: (v === NONE ? null : v) as NodeDomain | null,
                })
              }
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
              value={node.assignee_id ?? NONE}
              onValueChange={(v) =>
                void updateFields(node.id, {
                  assignee_id: v === NONE ? null : v,
                })
              }
            >
              <SelectTrigger
                className={triggerClass}
                data-testid="detail-assignee"
              >
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
        </div>
      )}

      {/* 설명(body) — 기본 마크다운 렌더, '수정' 클릭 시 편집 */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span
            className="text-[11px] font-semibold tracking-wide uppercase"
            style={{ color: "var(--c-ink-3)" }}
          >
            설명
          </span>
          {editingBody ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                saveBody()
                setEditingBody(false)
              }}
              data-testid="body-save"
            >
              완료
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setEditingBody(true)}
              data-testid="body-edit"
            >
              수정
            </Button>
          )}
        </div>
        {editingBody ? (
          <textarea
            id="detail-body"
            autoFocus
            className="min-h-32 rounded-[10px] border border-transparent bg-[#F5F2F4] p-3.5 text-sm leading-relaxed outline-none transition-colors hover:bg-[#EFE7EC] focus-visible:border-ring focus-visible:bg-card focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onBlur={saveBody}
            placeholder="마크다운으로 설명을 작성하세요 (#, **굵게**, - 목록, | 표 | …)"
            data-testid="detail-body"
          />
        ) : body.trim() ? (
          <div
            className="border-border rounded-[10px] border p-3.5"
            data-testid="body-preview"
          >
            <Markdown>{body}</Markdown>
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

      {/* 컨텐츠/기능: 한 단계 아래 자식 드릴다운 네비 */}
      {(node.type === "컨텐츠" || node.type === "기능") && (
        <div className="border-border border-t pt-5">
          <h3 className="font-display mb-3 text-[15px] font-bold">
            {node.type === "컨텐츠" ? "기능" : "세부기능 · 마스터데이터"}
          </h3>
          <ChildNav parentId={node.id} />
        </div>
      )}

      {/* 세부기능: UR/작업 형제 섹션 (풀 편집) */}
      {node.type === "세부기능" && (
        <div className="border-border border-t pt-5">
          <SubFeatureSections subFeatureId={node.id} />
        </div>
      )}

      {/* 마스터데이터: 작업만 (UR 없음) */}
      {node.type === "마스터데이터" && (
        <div className="border-border border-t pt-5">
          <h3 className="font-display mb-3 text-[15px] font-bold">작업</h3>
          <WorkSection parentId={node.id} />
        </div>
      )}

        {/* 작업 상세: 작업내용 → 연결 요구사항 → 선제조건 (세로 풀폭 스택) */}
        {isTask && (
          <div className="flex flex-col gap-6">
            <div className="border-border border-t pt-6">
              <TaskChecklist workId={node.id} />
            </div>
            <div className="border-border border-t pt-6">
              <TaskUrLinks workId={node.id} featureId={node.parent_id} />
            </div>
            <div className="border-border border-t pt-6">
              <TaskBlocks nodeId={node.id} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
