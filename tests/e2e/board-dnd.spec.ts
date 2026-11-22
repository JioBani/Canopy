import { test, expect, type Page } from "@playwright/test"
import { restGet, restPatch } from "../helpers/rest"
import {
  addChildSingle,
  addChildTyped,
  addContentRoot,
  addWork,
  cleanupCreatedProjects,
  createProject,
  dragCard,
  expand,
  rowByTitle,
  selectByLabel,
  signupAndEnter,
} from "./_helpers"

/**
 * 보드 드래그(dnd-kit) — 상태 변경 영속, 같은 열 순서 변경(board_rank) 영속,
 * 카드 위 우선순위 메뉴, ?sort= 정렬, 우선순위 아이콘(보드·트리).
 */

const column = (page: Page, cat: string) =>
  page.locator(`[data-testid="board-column"][data-category="${cat}"]`)
const cardIn = (page: Page, cat: string, text: string) =>
  column(page, cat).getByTestId("board-card").filter({ hasText: text })
const orderIn = async (page: Page, cat: string) =>
  (await column(page, cat).getByTestId("board-card").allInnerTexts()).map(
    (t) => ["작업1", "작업2", "작업3"].find((w) => t.includes(w)) ?? "?"
  )

let projectId = ""
const boardPath = (q = "") => `/p/${projectId}/board${q}`

async function nodeByTitle(title: string) {
  return (
    await restGet<{ id: string; status_id: string; fields: Record<string, unknown> }>(
      `node?project_id=eq.${projectId}&title=eq.${encodeURIComponent(title)}&select=id,status_id,fields`
    )
  )[0]
}

test.describe.serial("보드 드래그·순서·우선순위", () => {
  test.afterAll(cleanupCreatedProjects)

  test("드래그로 상태 변경 → 저장되고 새로고침 후에도 유지", async ({ page }) => {
    await signupAndEnter(page)
    const name = await createProject(page, `보드DnD ${Date.now()}`)
    projectId = (
      await restGet<{ id: string }>(`project?name=eq.${encodeURIComponent(name)}&select=id`)
    )[0].id
    await addContentRoot(page, "전장")
    await addChildSingle(page, "전장", "소환기능")
    await addChildTyped(page, "소환기능", "세부기능", "구매세부")
    await addWork(page, "구매세부", "작업1")
    await addWork(page, "구매세부", "작업2")
    await addWork(page, "구매세부", "작업3")

    await page.goto(boardPath())
    await expect(cardIn(page, "할일", "작업1")).toBeVisible()
    await dragCard(page, cardIn(page, "할일", "작업1"), column(page, "진행중"))
    await expect(cardIn(page, "진행중", "작업1")).toBeVisible()
    // 드래그 후 상세로 이동하지 않음
    expect(new URL(page.url()).pathname).toBe(boardPath())

    const statuses = await restGet<{ id: string; category: string }>(
      `status?project_id=eq.${projectId}&select=id,category`
    )
    await expect
      .poll(async () => {
        const n = await nodeByTitle("작업1")
        return statuses.find((s) => s.id === n.status_id)?.category
      })
      .toBe("진행중")
    await page.reload()
    await expect(cardIn(page, "진행중", "작업1")).toBeVisible()

    // 되돌리기(할일) — 이후 테스트 기준 상태
    await dragCard(page, cardIn(page, "진행중", "작업1"), column(page, "할일"))
    await expect(cardIn(page, "할일", "작업1")).toBeVisible()
  })

  test("같은 열 안에서 끌어 순서 변경 → 저장되고 새로고침 후에도 유지", async ({ page }) => {
    await page.goto(boardPath())
    await expect(column(page, "할일").getByTestId("board-card")).toHaveCount(3)
    const before = await orderIn(page, "할일")
    const last = before[2]
    const first = before[0]

    await dragCard(page, cardIn(page, "할일", last), cardIn(page, "할일", first), "top")
    await expect.poll(() => orderIn(page, "할일")).toEqual([last, before[0], before[1]])

    await expect
      .poll(async () => typeof (await nodeByTitle(last)).fields.board_rank)
      .toBe("number")
    await page.reload()
    await expect.poll(() => orderIn(page, "할일")).toEqual([last, before[0], before[1]])
  })

  test("카드 위 우선순위 메뉴 → 상세 안 열고 바로 반영, 아이콘 표시", async ({ page }) => {
    await page.goto(boardPath())
    const card = cardIn(page, "할일", "작업2")
    await card.hover()
    await card.getByTestId("board-card-priority").click()
    await page
      .getByTestId("board-priority-option")
      .and(page.locator('[data-value="최우선"]'))
      .click()
    await expect(card.getByTestId("board-card-priority")).toHaveAttribute("data-priority", "최우선")
    await expect(card.locator('[data-priority-icon="최우선"]')).toBeVisible()
    expect(new URL(page.url()).pathname).toBe(boardPath())
    await expect.poll(async () => (await nodeByTitle("작업2")).fields.priority).toBe("최우선")
    // board_rank 등 다른 fields 키 보존
    const f = (await nodeByTitle("작업2")).fields
    expect(Object.keys(f)).toContain("priority")

    // 다른 카드: 낮음
    const c3 = cardIn(page, "할일", "작업3")
    await c3.hover()
    await c3.getByTestId("board-card-priority").click()
    await page
      .getByTestId("board-priority-option")
      .and(page.locator('[data-value="낮음"]'))
      .click()
    await expect(c3.getByTestId("board-card-priority")).toHaveAttribute("data-priority", "낮음")
  })

  test("정렬 = 우선순위 높은 순 (?sort=priority) + 그 정렬에선 같은 열 순서 변경 안내", async ({
    page,
  }) => {
    await page.goto(boardPath())
    await selectByLabel(page, "board-sort", "우선순위 높은 순")
    await expect.poll(() => new URL(page.url()).searchParams.get("sort")).toBe("priority")
    // 최우선(작업2) → 낮음(작업3) → 미지정(작업1)
    await expect.poll(() => orderIn(page, "할일")).toEqual(["작업2", "작업3", "작업1"])

    // 링크로 열어도 같은 정렬
    await page.goto(boardPath("?sort=priority"))
    await expect.poll(() => orderIn(page, "할일")).toEqual(["작업2", "작업3", "작업1"])

    // 우선순위 정렬에서 같은 열 드래그 → 순서 그대로 + 안내
    await dragCard(page, cardIn(page, "할일", "작업1"), cardIn(page, "할일", "작업2"), "top")
    await expect(page.getByText("카드 순서는 정렬을 '수동 순서'로")).toBeVisible()
    await expect.poll(() => orderIn(page, "할일")).toEqual(["작업2", "작업3", "작업1"])
  })

  test("트리에도 우선순위 아이콘(보통 외)", async ({ page }) => {
    // 트리는 작업을 행으로 그리지 않음 → 세부기능에 우선순위 지정 후 확인
    const sub = await nodeByTitle("구매세부")
    await restPatch(`node?id=eq.${sub.id}`, { fields: { ...sub.fields, priority: "높음" } })
    await page.goto(`/p/${projectId}/tree`)
    await expand(page, "전장")
    await expand(page, "소환기능")
    await expect(rowByTitle(page, "구매세부").getByTestId("tree-priority")).toHaveAttribute(
      "data-priority",
      "높음"
    )
    await expect(rowByTitle(page, "소환기능").getByTestId("tree-priority")).toHaveCount(0)
  })
})
