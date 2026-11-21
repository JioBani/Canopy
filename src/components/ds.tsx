/**
 * Canopy 디자인 시스템 v2 공통 컴포넌트 — docs/design/design-system-v2.md §3.
 * Section · Count · TicketKey · StatusChip · LayerChip · PropertyRow · SubLabel · EmptyNote
 */
import { useState, type ReactNode } from "react"
import { Check, Copy } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Status } from "@/lib/statuses"
import { statusTone } from "@/lib/statusTone"
import { BLOOM_GLYPH } from "@/nodes/bloomGlyph"
import { LAYER_COLOR } from "@/nodes/layerColors"
import { PIXEL_ICONS } from "@/nodes/pixelIcons"
import { TYPE_META, type NodeType } from "@/nodes/nodeGrammar"

/** 섹션 카드 — 흰 면 + 테두리. 헤더(아이콘·제목·개수·액션) + 바디. */
export function Section({
  icon,
  title,
  count,
  meta,
  actions,
  children,
  flush = false,
  className,
  bodyClassName,
  ...rest
}: {
  icon?: ReactNode
  title: ReactNode
  count?: ReactNode
  meta?: ReactNode
  actions?: ReactNode
  children?: ReactNode
  /** 바디 패딩 제거(행 목록이 카드 가장자리까지). */
  flush?: boolean
  className?: string
  bodyClassName?: string
} & Omit<React.HTMLAttributes<HTMLElement>, "title">) {
  return (
    <section
      className={cn("bg-surface border-line rounded-card border", className)}
      {...rest}
    >
      <header className="border-line flex min-h-[54px] flex-wrap items-center gap-x-2.5 gap-y-1 border-b px-5 py-3">
        {icon && (
          <span className="text-fg-2 flex shrink-0 [&_svg]:size-[18px]">{icon}</span>
        )}
        <h2 className="text-heading text-fg">{title}</h2>
        {count != null && <Count>{count}</Count>}
        {meta && <span className="text-meta text-fg-3">{meta}</span>}
        {actions && (
          <div className="ml-auto flex items-center gap-1.5">{actions}</div>
        )}
      </header>
      {children != null && (
        <div className={cn(flush ? "" : "p-5", bodyClassName)}>{children}</div>
      )}
    </section>
  )
}

/** 개수 pill. */
export function Count({
  children,
  className,
  ...rest
}: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "bg-sunken text-fg-2 text-micro tnum inline-flex h-5 min-w-[22px] items-center justify-center rounded-full px-[7px]",
        className
      )}
      {...rest}
    >
      {children}
    </span>
  )
}

/** 티켓키 — 모노 13, 조용한 회색. copy=true 면 클릭 복사. */
export function TicketKey({
  value,
  copy = false,
  className,
  ...rest
}: { value: string; copy?: boolean; className?: string } & React.HTMLAttributes<HTMLElement>) {
  const [done, setDone] = useState(false)
  if (!copy)
    return (
      <code
        className={cn("text-fg-3 tnum font-mono text-[13px] leading-[18px] whitespace-nowrap", className)}
        {...rest}
      >
        {value}
      </code>
    )
  return (
    <span className="inline-flex items-center gap-1">
      <code
        className={cn("text-fg-3 tnum font-mono text-[13px] leading-[18px] whitespace-nowrap", className)}
        {...rest}
      >
        {value}
      </code>
      <button
        type="button"
        title="티켓키 복사"
        aria-label="티켓키 복사"
        data-testid="copy-ticket"
        className="text-fg-3 hover:bg-hover hover:text-fg flex size-7 items-center justify-center rounded-md"
        onClick={() => {
          void navigator.clipboard?.writeText(value)
          setDone(true)
          setTimeout(() => setDone(false), 1200)
        }}
      >
        {done ? <Check className="text-st-done size-4" /> : <Copy className="size-4" />}
      </button>
    </span>
  )
}

/** 상태 칩 — 의미색 배경 + 모양 글리프 + 이름. status 없으면 "미지정". */
export function StatusChip({
  status,
  size = "md",
  className,
  ...rest
}: {
  status: Pick<Status, "category" | "color" | "name"> | null | undefined
  size?: "sm" | "md"
  className?: string
} & React.HTMLAttributes<HTMLSpanElement>) {
  const h = size === "sm" ? "h-[22px] px-1.5 gap-1" : "h-6 px-2 gap-1.5"
  if (!status)
    return (
      <span
        className={cn(
          "text-label text-fg-3 border-line-strong inline-flex shrink-0 items-center rounded-md border border-dashed whitespace-nowrap",
          h,
          className
        )}
        {...rest}
      >
        미지정
      </span>
    )
  const tone = statusTone(status)
  const G = BLOOM_GLYPH[status.category]
  return (
    <span
      className={cn(
        "text-label inline-flex shrink-0 items-center rounded-md whitespace-nowrap",
        h,
        status.category === "취소됨" && "line-through",
        className
      )}
      style={{ background: tone.bg, color: tone.fg }}
      {...rest}
    >
      <G className="size-3.5 shrink-0" />
      {status.name}
    </span>
  )
}

/** 레이어(계층 타입) 칩 — soft 배경 + ink 글자 + 픽셀 아이콘. */
export function LayerChip({
  type,
  className,
  ...rest
}: { type: NodeType; className?: string } & React.HTMLAttributes<HTMLSpanElement>) {
  const c = LAYER_COLOR[type]
  const Icon = PIXEL_ICONS[type]
  return (
    <span
      className={cn(
        "text-label inline-flex h-6 shrink-0 items-center gap-1.5 rounded-md px-2 whitespace-nowrap",
        className
      )}
      style={{ background: c.soft, color: c.ink }}
      {...rest}
    >
      <Icon className="size-3.5 shrink-0" style={{ color: c.base }} />
      {TYPE_META[type].label}
    </span>
  )
}

/** 레이어 아이콘만 (트리·경로·목록). */
export function LayerIcon({ type, className }: { type: NodeType; className?: string }) {
  const Icon = PIXEL_ICONS[type]
  return (
    <Icon
      aria-hidden
      className={cn("size-4 shrink-0", className)}
      style={{ color: LAYER_COLOR[type].base }}
    />
  )
}

/** 속성 행 — 라벨(13/600) + 값. 레일에서는 라벨 왼쪽 고정폭. */
export function PropertyRow({
  label,
  children,
  htmlFor,
}: {
  label: string
  children: ReactNode
  htmlFor?: string
}) {
  return (
    <div className="grid min-h-9 grid-cols-[76px_minmax(0,1fr)] items-center gap-2">
      <label htmlFor={htmlFor} className="text-label text-fg-2">
        {label}
      </label>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

/** 카드 내부 소제목 (13/600 fg-2) + 선택적 개수·액션. */
export function SubLabel({
  children,
  count,
  actions,
  className,
}: {
  children: ReactNode
  count?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("mb-2 flex min-h-7 items-center gap-2", className)}>
      <span className="text-label text-fg-2">{children}</span>
      {count != null && <Count>{count}</Count>}
      {actions && <div className="ml-auto flex items-center gap-1">{actions}</div>}
    </div>
  )
}

/** 비어 있음 안내 — 다음 행동을 알려주는 문장. */
export function EmptyNote({
  children,
  className,
  ...rest
}: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "border-line-strong text-body text-fg-3 rounded-lg border border-dashed px-4 py-3",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  )
}
