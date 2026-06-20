import { useEffect, useMemo, useState, type ReactNode } from "react"
import { ChevronDown, Copy } from "lucide-react"
import { useNodes } from "@/nodes/NodesProvider"
import { useProjects } from "@/projects/ProjectProvider"
import { ticketKey } from "@/lib/validation"
import { renderMarkdown } from "@/lib/markdown"
import { memberLabel } from "@/lib/members"
import { TYPE_META } from "@/nodes/nodeGrammar"
import { PIXEL_ICONS } from "@/nodes/pixelIcons"
import { BLOOM_GLYPH } from "@/nodes/bloomGlyph"
import { CATEGORY_COLOR } from "@/lib/statuses"
import { FeatureUrPanel } from "@/ur/FeatureUrPanel"
import { TaskChecklist } from "@/ur/TaskChecklist"
import { TaskUrLinks } from "@/ur/TaskUrLinks"
import { TaskBlocks } from "@/ur/TaskBlocks"
import type { AppNode, NodeDomain } from "@/lib/nodes"
import type { StatusCategory } from "@/lib/statuses"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const DOMAINS: NodeDomain[] = [
  "기획",
  "디자인",
  "사운드",
  "구현",
  "밸런싱",
  "기타",
]
const CATEGORY_ORDER: StatusCategory[] = ["할일", "진행중", "완료", "취소됨"]

const chipBase =
  "h-8 appearance-none rounded-[9px] border border-transparent bg-[#F5F2F4] pr-7 text-[13px] outline-none transition-colors hover:bg-[#EFE7EC] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"

/** 인라인 property 칩 — 네이티브 select(접근성·E2E 보존)를 칩으로 재스타일 + 리딩 글리프. */
function ChipSelect({
  label,
  leading,
  value,
  onChange,
  testid,
  children,
}: {
  label: string
  leading?: ReactNode
  value: string
  onChange: (v: string) => void
  testid: string
  children: ReactNode
}) {
  return (
    <label className="inline-flex items-center gap-1.5">
      <span className="text-[11px] font-medium" style={{ color: "var(--c-ink-3)" }}>
        {label}
      </span>
      <span className="relative inline-flex items-center">
        {leading && (
          <span className="pointer-events-none absolute left-2 flex items-center">
            {leading}
          </span>
        )}
        <select
          className={cn(chipBase, leading ? "pl-[30px]" : "pl-2.5")}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          data-testid={testid}
        >
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-1.5 size-3.5"
          style={{ color: "var(--c-ink-3)" }}
        />
      </span>
    </label>
  )
}

export function NodeDetail() {
  const { nodes, selectedId, updateFields, statuses, members, getStatus } =
    useNodes()
  const { currentProject } = useProjects()
  const node = nodes.find((n) => n.id === selectedId) ?? null

  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [preview, setPreview] = useState(false)

  useEffect(() => {
    setTitle(node?.title ?? "")
    setBody(node?.body ?? "")
    setPreview(false)
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
  const ticket = currentProject
    ? ticketKey(currentProject.key_prefix, node.ticket_number)
    : `#${node.ticket_number}`

  function saveTitle() {
    const t = title.trim()
    if (node && t && t !== node.title) void updateFields(node.id, { title: t })
    else setTitle(node?.title ?? "")
  }
  function saveBody() {
    if (node && body !== (node.body ?? ""))
      void updateFields(node.id, { body })
  }

  // 작업의 기능 조상(부모의 부모) — UR 피커 기본 강조용.
  let featureAncestorId: string | null = null
  if (isTask) {
    let cur: AppNode | null = node
    while (cur && cur.type !== "기능") {
      cur = cur.parent_id
        ? (nodes.find((n) => n.id === cur!.parent_id) ?? null)
        : null
    }
    featureAncestorId = cur?.id ?? null
  }

  // 브레드크럼: 조상 경로(자기 제외, 루트→부모)
  const breadcrumb: string[] = []
  {
    let cur: AppNode | null = node.parent_id
      ? (nodes.find((n) => n.id === node.parent_id) ?? null)
      : null
    while (cur) {
      breadcrumb.unshift(cur.title)
      cur = cur.parent_id
        ? (nodes.find((n) => n.id === cur!.parent_id) ?? null)
        : null
    }
  }

  const TypeIcon = PIXEL_ICONS[node.type]

  // 상태 칩 리딩 글리프
  const curStatus = getStatus(node.status_id)
  const StatusGlyph = curStatus ? BLOOM_GLYPH[curStatus.category] : null
  const statusLeading = StatusGlyph ? (
    <StatusGlyph
      className="size-[14px]"
      style={{
        color: curStatus!.color ?? CATEGORY_COLOR[curStatus!.category],
      }}
    />
  ) : (
    <span
      className="inline-block size-[10px] rounded-full border"
      style={{ borderColor: "var(--c-ink-3)" }}
    />
  )

  // 담당 칩 리딩 아바타
  const assignee = node.assignee_id
    ? members.find((m) => m.id === node.assignee_id)
    : undefined
  const assigneeLeading = assignee ? (
    <span
      className="inline-flex size-[18px] items-center justify-center rounded-full text-[9.5px] font-bold"
      style={{
        background: "linear-gradient(150deg,#F6CFDD,#EC9EBA)",
        color: "#9b3a5e",
      }}
    >
      {memberLabel(assignee).slice(0, 1).toUpperCase()}
    </span>
  ) : undefined

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 p-7" data-testid="node-detail">
      {/* 헤더: 브레드크럼 + 티켓키 + 타입태그 */}
      <div className="flex flex-col gap-2">
        {breadcrumb.length > 0 && (
          <nav
            className="flex items-center gap-1 text-xs"
            style={{ color: "var(--c-ink-3)" }}
          >
            {breadcrumb.map((b, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <span className="opacity-50">/</span>}
                <span className="truncate">{b}</span>
              </span>
            ))}
          </nav>
        )}
        <div className="flex items-center gap-1.5">
          <code
            className="tnum font-mono text-[11.5px] font-semibold"
            style={{ color: "var(--c-plum)" }}
            data-testid="detail-ticket"
          >
            {ticket}
          </code>
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            title="티켓키 복사"
            data-testid="copy-ticket"
            onClick={() => void navigator.clipboard?.writeText(ticket)}
          >
            <Copy className="size-3.5" />
          </Button>
          <span
            className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium"
            style={{ color: "var(--c-ink-2)" }}
            data-testid="detail-type"
          >
            <TypeIcon
              className="size-3.5"
              style={{
                color:
                  node.type === "컨텐츠"
                    ? "var(--c-sakura)"
                    : "var(--c-ink-3)",
              }}
            />
            {TYPE_META[node.type].label}
          </span>
        </div>
      </div>

      {/* 제목 — 메이플체 Bold 21px (편집 가능) */}
      <Input
        id="detail-title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={saveTitle}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur()
        }}
        className="font-display -mx-2 h-auto border-transparent bg-transparent px-2 py-1 text-[22px] leading-tight font-bold shadow-none hover:bg-[#F5F2F4]/60 focus-visible:bg-transparent"
        data-testid="detail-title"
      />

      {/* 작업 전용 — property 칩 행 */}
      {isTask && (
        <div className="flex flex-wrap items-center gap-2">
          <ChipSelect
            label="상태"
            leading={statusLeading}
            value={node.status_id ?? ""}
            onChange={(v) => void updateFields(node.id, { status_id: v || null })}
            testid="detail-status"
          >
            <option value="">미지정</option>
            {statusGroups.map((g) => (
              <optgroup key={g.cat} label={g.cat}>
                {g.items.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </ChipSelect>

          <ChipSelect
            label="도메인"
            value={node.domain ?? ""}
            onChange={(v) =>
              void updateFields(node.id, {
                domain: (v || null) as NodeDomain | null,
              })
            }
            testid="detail-domain"
          >
            <option value="">미지정</option>
            {DOMAINS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </ChipSelect>

          <ChipSelect
            label="담당"
            leading={assigneeLeading}
            value={node.assignee_id ?? ""}
            onChange={(v) =>
              void updateFields(node.id, { assignee_id: v || null })
            }
            testid="detail-assignee"
          >
            <option value="">없음</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {memberLabel(m)}
              </option>
            ))}
          </ChipSelect>
        </div>
      )}

      {/* 설명(body) */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span
            className="text-[11px] font-semibold tracking-wide uppercase"
            style={{ color: "var(--c-ink-3)" }}
          >
            설명
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              if (!preview) saveBody()
              setPreview((p) => !p)
            }}
            data-testid="body-preview-toggle"
          >
            {preview ? "편집" : "미리보기"}
          </Button>
        </div>
        {preview ? (
          <div
            className="prose-sm border-border min-h-24 rounded-[10px] border p-3.5 text-sm [&_a]:underline [&_code]:bg-muted [&_code]:rounded [&_code]:px-1 [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:pl-5"
            data-testid="body-preview"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(body) }}
          />
        ) : (
          <textarea
            id="detail-body"
            className="min-h-24 rounded-[10px] border border-transparent bg-[#F5F2F4] p-3.5 text-sm leading-relaxed outline-none transition-colors hover:bg-[#EFE7EC] focus-visible:border-ring focus-visible:bg-transparent focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onBlur={saveBody}
            placeholder="마크다운으로 설명을 작성하세요 (#, **굵게**, - 목록 …)"
            data-testid="detail-body"
          />
        )}
      </div>

      {/* 기능: UR 관리 */}
      {node.type === "기능" && (
        <div className="border-border border-t pt-5">
          <FeatureUrPanel featureId={node.id} />
        </div>
      )}

      {/* 작업: 작업내용 + 만족 UR (나란히) + 선제조건 */}
      {isTask && (
        <>
          <div className="border-border grid grid-cols-1 gap-5 border-t pt-5 lg:grid-cols-2">
            <TaskChecklist workId={node.id} />
            <TaskUrLinks workId={node.id} featureId={featureAncestorId} />
          </div>
          <div className="border-border border-t pt-5">
            <TaskBlocks nodeId={node.id} />
          </div>
        </>
      )}
    </div>
  )
}
