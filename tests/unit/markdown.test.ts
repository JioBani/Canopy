import { describe, expect, it } from "vitest"
import { renderMarkdown } from "../../src/lib/markdown"

describe("renderMarkdown — XSS 안전", () => {
  it("raw HTML 을 escape 한다 (스크립트 미실행)", () => {
    const html = renderMarkdown("<script>alert(1)</script>")
    expect(html).not.toContain("<script>")
    expect(html).toContain("&lt;script&gt;")
  })
  it("javascript: 링크는 href 로 렌더하지 않는다", () => {
    const html = renderMarkdown("[x](javascript:alert(1))")
    expect(html).not.toContain("href")
    expect(html).toContain("x")
  })
  it("http 링크는 href 로 렌더한다", () => {
    const html = renderMarkdown("[a](https://example.com)")
    expect(html).toContain('href="https://example.com"')
  })
})

describe("renderMarkdown — 기본 문법", () => {
  it("굵게/기울임/코드", () => {
    expect(renderMarkdown("**b**")).toContain("<strong>b</strong>")
    expect(renderMarkdown("*i*")).toContain("<em>i</em>")
    expect(renderMarkdown("`c`")).toContain("<code>c</code>")
  })
  it("제목 #/##/###", () => {
    expect(renderMarkdown("# H")).toContain("<h1>H</h1>")
    expect(renderMarkdown("## H")).toContain("<h2>H</h2>")
    expect(renderMarkdown("### H")).toContain("<h3>H</h3>")
  })
  it("목록", () => {
    expect(renderMarkdown("- a\n- b")).toContain(
      "<ul><li>a</li><li>b</li></ul>"
    )
  })
  it("문단/줄바꿈", () => {
    expect(renderMarkdown("a\nb")).toContain("a<br/>b")
  })
})
