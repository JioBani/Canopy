import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { cn } from "@/lib/utils"

/**
 * 마크다운 렌더러 (react-markdown + GFM).
 * raw HTML 은 기본적으로 렌더하지 않아 XSS 안전. GFM(표·취소선·체크박스·자동링크) 지원.
 * Tailwind prose — design-system-v2 body-reading(15/26), 줄 길이 72ch.
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
        "text-reading text-fg max-w-[72ch] break-words",
        "[&_h1]:mt-6 [&_h1]:mb-2 [&_h1]:text-[20px] [&_h1]:leading-[28px] [&_h1]:font-bold [&_h1:first-child]:mt-0",
        "[&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:text-[17px] [&_h2]:leading-[26px] [&_h2]:font-bold [&_h2:first-child]:mt-0",
        "[&_h3]:mt-5 [&_h3]:mb-1.5 [&_h3]:text-[15px] [&_h3]:leading-[24px] [&_h3]:font-bold [&_h3:first-child]:mt-0",
        "[&_h4]:mt-4 [&_h4]:mb-1 [&_h4]:text-[15px] [&_h4]:font-semibold",
        "[&_p]:my-3 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0",
        "[&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6",
        "[&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6",
        "[&_li]:my-1 [&_li>ul]:my-1 [&_li>ol]:my-1 [&_li::marker]:text-fg-3",
        "[&_a]:text-brand [&_a]:underline [&_a]:underline-offset-2",
        "[&_code]:bg-sunken [&_code]:text-fg [&_code]:rounded [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[13px]",
        "[&_pre]:bg-sunken [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:p-4 [&_pre]:leading-[22px] [&_pre_code]:bg-transparent [&_pre_code]:p-0",
        "[&_blockquote]:border-line-strong [&_blockquote]:text-fg-2 [&_blockquote]:my-3 [&_blockquote]:border-l-[3px] [&_blockquote]:pl-4",
        "[&_table]:my-3 [&_table]:block [&_table]:w-max [&_table]:max-w-full [&_table]:overflow-x-auto [&_table]:border-collapse [&_table]:text-body",
        "[&_th]:border-line-strong [&_th]:bg-sunken [&_th]:border [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold",
        "[&_td]:border-line-strong [&_td]:border [&_td]:px-3 [&_td]:py-2 [&_td]:align-top",
        "[&_hr]:border-line [&_hr]:my-5",
        "[&_strong]:font-bold",
        className
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  )
}
