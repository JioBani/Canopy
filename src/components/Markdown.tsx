import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { cn } from "@/lib/utils"

/**
 * 마크다운 렌더러 (react-markdown + GFM).
 * raw HTML 은 기본적으로 렌더하지 않아 XSS 안전. GFM(표·취소선·체크박스·자동링크) 지원.
 * Tailwind 로 최소 prose 스타일 — Pixel Blossom 톤.
 */
export function Markdown({
  children,
  className,
}: {
  children: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "text-[13.5px] leading-[1.7] break-words",
        "[&_h1]:mt-3 [&_h1]:mb-1.5 [&_h1]:text-lg [&_h1]:font-bold [&_h1:first-child]:mt-0",
        "[&_h2]:mt-3 [&_h2]:mb-1 [&_h2]:text-base [&_h2]:font-bold",
        "[&_h3]:mt-2 [&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-bold",
        "[&_p]:my-1.5",
        "[&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5",
        "[&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5",
        "[&_li]:my-0.5",
        "[&_a]:text-[var(--c-plum)] [&_a]:underline [&_a]:underline-offset-2",
        "[&_code]:rounded [&_code]:bg-[var(--c-pink-bg)] [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[12px] [&_code]:text-[var(--c-plum-d)]",
        "[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-[var(--c-bg-sunken)] [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0",
        "[&_blockquote]:border-l-2 [&_blockquote]:border-[var(--c-line-2)] [&_blockquote]:pl-3 [&_blockquote]:text-[var(--c-ink-2)]",
        "[&_table]:my-2 [&_table]:w-full [&_table]:border-collapse [&_table]:text-[12.5px]",
        "[&_th]:border [&_th]:border-[var(--c-line-2)] [&_th]:bg-[var(--c-bg-sunken)] [&_th]:px-2 [&_th]:py-1 [&_th]:text-left",
        "[&_td]:border [&_td]:border-[var(--c-line-2)] [&_td]:px-2 [&_td]:py-1",
        "[&_hr]:my-3 [&_hr]:border-[var(--c-line-2)]",
        "[&_strong]:font-bold",
        className
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  )
}
