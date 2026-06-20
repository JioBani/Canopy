/**
 * 아주 가벼운 마크다운 → HTML 렌더러 (과한 에디터 금지 방침).
 * 보안: 먼저 모든 HTML 을 escape 한 뒤 우리가 정한 인라인/블록 규칙만 태그로 바꾼다.
 * 따라서 입력에 든 raw HTML/스크립트는 그대로 노출되지 않는다(XSS 방지).
 * 지원: #/##/### 제목, **굵게**, *기울임*, `코드`, [텍스트](링크), - 목록, 줄바꿈.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/** 허용 프로토콜만 링크로. 그 외(javascript: 등)는 텍스트만 남긴다. */
function safeHref(url: string): string | null {
  return /^(https?:\/\/|mailto:|\/|#)/i.test(url.trim()) ? url.trim() : null
}

function inline(escaped: string): string {
  let s = escaped
  // 코드(다른 규칙보다 먼저)
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>")
  // 굵게 → 기울임 순서
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
  s = s.replace(/\*([^*]+)\*/g, "<em>$1</em>")
  s = s.replace(/_([^_]+)_/g, "<em>$1</em>")
  // 링크 [텍스트](url) — escape 된 상태이므로 괄호만 매칭
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_full, text, url) => {
    const href = safeHref(url)
    return href
      ? `<a href="${href}" target="_blank" rel="noreferrer noopener">${text}</a>`
      : text
  })
  return s
}

export function renderMarkdown(src: string): string {
  const lines = escapeHtml(src ?? "").split(/\r?\n/)
  const out: string[] = []
  let para: string[] = []
  let list: string[] = []

  const flushPara = () => {
    if (para.length) {
      out.push(`<p>${para.map(inline).join("<br/>")}</p>`)
      para = []
    }
  }
  const flushList = () => {
    if (list.length) {
      out.push(`<ul>${list.map((li) => `<li>${inline(li)}</li>`).join("")}</ul>`)
      list = []
    }
  }

  for (const line of lines) {
    const heading = /^(#{1,3})\s+(.*)$/.exec(line)
    const item = /^\s*[-*]\s+(.*)$/.exec(line)

    if (heading) {
      flushPara()
      flushList()
      const level = heading[1].length
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`)
    } else if (item) {
      flushPara()
      list.push(item[1])
    } else if (line.trim() === "") {
      flushPara()
      flushList()
    } else {
      flushList()
      para.push(line)
    }
  }
  flushPara()
  flushList()
  return out.join("\n")
}
