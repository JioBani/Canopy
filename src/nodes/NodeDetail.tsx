import { useEffect, useMemo, useState } from "react"
import { Copy } from "lucide-react"
import { useNodes } from "@/nodes/NodesProvider"
import { useProjects } from "@/projects/ProjectProvider"
import { ticketKey } from "@/lib/validation"
import { renderMarkdown } from "@/lib/markdown"
import { memberLabel } from "@/lib/members"
import { TYPE_META } from "@/nodes/nodeGrammar"
import type { NodeDomain } from "@/lib/nodes"
import type { StatusCategory } from "@/lib/statuses"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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

const selectClass =
  "border-input h-9 rounded-md border bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"

export function NodeDetail() {
  const { nodes, selectedId, updateFields, statuses, members } = useNodes()
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

  return (
    <div className="flex flex-col gap-5 p-6" data-testid="node-detail">
      {/* 헤더: 티켓키 + 타입 */}
      <div className="flex items-center gap-2">
        <code
          className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs"
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
          className={cn("ml-auto text-xs font-medium", TYPE_META[node.type].color)}
          data-testid="detail-type"
        >
          {TYPE_META[node.type].label}
        </span>
      </div>

      {/* 제목 */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="detail-title">제목</Label>
        <Input
          id="detail-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur()
          }}
          data-testid="detail-title"
        />
      </div>

      {/* 작업 전용 필드 */}
      {isTask && (
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="detail-status">상태</Label>
            <select
              id="detail-status"
              className={selectClass}
              value={node.status_id ?? ""}
              onChange={(e) =>
                void updateFields(node.id, {
                  status_id: e.target.value || null,
                })
              }
              data-testid="detail-status"
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
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="detail-domain">도메인</Label>
            <select
              id="detail-domain"
              className={selectClass}
              value={node.domain ?? ""}
              onChange={(e) =>
                void updateFields(node.id, {
                  domain: (e.target.value || null) as NodeDomain | null,
                })
              }
              data-testid="detail-domain"
            >
              <option value="">미지정</option>
              {DOMAINS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="detail-assignee">작업자</Label>
            <select
              id="detail-assignee"
              className={selectClass}
              value={node.assignee_id ?? ""}
              onChange={(e) =>
                void updateFields(node.id, {
                  assignee_id: e.target.value || null,
                })
              }
              data-testid="detail-assignee"
            >
              <option value="">없음</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {memberLabel(m)}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* 설명(body) */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="detail-body">설명</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
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
            className="prose-sm min-h-24 rounded-md border p-3 text-sm [&_a]:underline [&_code]:bg-muted [&_code]:rounded [&_code]:px-1 [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:pl-5"
            data-testid="body-preview"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(body) }}
          />
        ) : (
          <textarea
            id="detail-body"
            className="border-input min-h-24 rounded-md border bg-transparent p-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onBlur={saveBody}
            placeholder="마크다운으로 설명을 작성하세요 (#, **굵게**, - 목록 …)"
            data-testid="detail-body"
          />
        )}
      </div>
    </div>
  )
}
