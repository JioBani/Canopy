import { test, expect, type Page } from "@playwright/test"
import { restGet, restPost } from "../helpers/rest"
import {
  addChildSingle,
  addChildTyped,
  addContentRoot,
  addWork,
  cleanupCreatedProjects,
  createProject,
  dragCard,
  signupAndEnter,
} from "./_helpers"

/**
 * 보드 열 묶음 [분류별 | 상태별] — 상태별은 커스텀 상태마다 열(분류 순 → sort_order),
 * 드래그 = 그 상태로 정확히, ?group= 공유 + 마지막 선택 기억.
 */

let projectId = ""
const boardPath = (q = "") => `/p/${projectId}/board${q}`
const statusCol = (page: Page, name: string) =>
  page.locator(`[data-testid="board-column"][data-status-name="${name}"]`)

async function nodeStatus(title: string) {
  return (
    await restGet<{ status_id: string }>(
      `node?project_id=eq.${projectId}&title=eq.${encodeURIComponent(title)}&select=status_id`
    )
  )[0].status_id
}

test.describe.serial("보드 열 묶음 — 상태별", () => {
  test.afterAll(cleanupCreatedProjects)

  test("상태별 보기: 커스텀 상태가 각각 열로, 분류 순 + 분류 묶음 라벨", async ({ page }) => {
    await signupAndEnter(page)
    const name = await createProject(page, `보드상태별 ${Date.now()}`)
    projectId = (
      await restGet<{ id: string }>(`project?name=eq.${encodeURIComponent(name)}&select=id`)
    )[0].id
    await restPost("status", [
      { project_id: projectId, name: "기획 대기", category: "할일", sort_order: 50 },
      { project_id: projectId, name: "배정 대기", category: "할일", sort_order: 51 },
      { project_id: projectId, name: "병합 대기", category: "진행중", sort_order: 52 },
    ])
    await addContentRoot(page, "전장")
    await addChildSingle(page, "전장", "소환기능")
    await addChildTyped(page, "소환기능", "세부기능", "구매세부")
    await addWork(page, "구매세부", "작업1")

    await page.goto(boardPath())
    // 기본 = 분류별: 커스텀 상태 열 없음
    await expect(page.getByTestId("board-group-category")).toHaveAttribute("aria-checked", "true")
    await expect(statusCol(page, "병합 대기")).toHaveCount(0)

    await page.getByTestId("board-group-status").click()
    await expect.poll(() => new URL(page.url()).searchParams.get("group")).toBe("status")
    for (const n of ["기획 대기", "배정 대기", "병합 대기"]) {
      await expect(statusCol(page, n)).toBeVisible()
    }
    await expect(statusCol(page, "병합 대기")).toHaveAttribute("data-category", "진행중")

    // 열 순서: 분류 순(할일 → 진행중 → 완료 → 취소됨)
    const cats = await page
      .getByTestId("board-column")
      .evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.category))
    const rank = { 미지정: -1, 할일: 0, 진행중: 1, 완료: 2, 취소됨: 3 } as Record<string, number>
    const ranks = cats.map((c) => rank[c ?? ""])
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks)
    // 분류 묶음 라벨
    await expect(page.getByTestId("board-group")).toHaveCount(4)
  })

  test("상태별 보기에서 드래그 → 그 상태로 정확히 변경", async ({ page }) => {
    await page.goto(boardPath("?group=status"))
    const card = page.getByTestId("board-card").filter({ hasText: "작업1" })
    await expect(card).toBeVisible()
    await dragCard(page, card, statusCol(page, "병합 대기"))
    await expect(statusCol(page, "병합 대기").getByTestId("board-card")).toContainText("작업1")

    const merge = (
      await restGet<{ id: string }>(
        `status?project_id=eq.${projectId}&name=eq.${encodeURIComponent("병합 대기")}&select=id`
      )
    )[0].id
    await expect.poll(() => nodeStatus("작업1")).toBe(merge)

    // 같은 분류(할일) 안의 다른 상태로도 정확히
    await dragCard(page, statusCol(page, "병합 대기").getByTestId("board-card").first(), statusCol(page, "배정 대기"))
    const assign = (
      await restGet<{ id: string }>(
        `status?project_id=eq.${projectId}&name=eq.${encodeURIComponent("배정 대기")}&select=id`
      )
    )[0].id
    await expect.poll(() => nodeStatus("작업1")).toBe(assign)
  })

  test("URL 에 group 이 없으면 마지막 선택 기억, 분류별로 되돌리기", async ({ page }) => {
    await page.goto(boardPath("?group=status"))
    await page.getByTestId("board-group-category").click()
    await page.getByTestId("board-group-status").click()
    await page.goto(boardPath())
    await expect(page.getByTestId("board-group-status")).toHaveAttribute("aria-checked", "true")
    await expect(statusCol(page, "병합 대기")).toBeVisible()

    await page.getByTestId("board-group-category").click()
    await expect.poll(() => new URL(page.url()).searchParams.get("group")).toBe("category")
    await expect(statusCol(page, "병합 대기")).toHaveCount(0)
    // 분류별: 배정 대기(할일) 카드는 할일 열
    await expect(
      page.locator('[data-testid="board-column"][data-category="할일"]').getByTestId("board-card")
    ).toContainText("작업1")
  })

  test("열 접기: 헤더로 접고 띠로 펼침, 프로젝트별 기억", async ({ page }) => {
    await page.goto(boardPath("?group=status"))
    const col = statusCol(page, "기획 대기")
    await col.getByTestId("board-column-collapse").click()
    await expect(col).toHaveAttribute("data-collapsed", "true")
    await page.reload()
    await expect(col).toHaveAttribute("data-collapsed", "true")
    await col.click()
    await expect(col).not.toHaveAttribute("data-collapsed", "true")
    await expect(col.getByTestId("board-column-collapse")).toBeVisible()
  })

  test("빈 상태 접기: 0개 열만 띠로, 개별 펼침 가능, 접힌 띠에 드롭 → 그 상태", async ({ page }) => {
    await page.goto(boardPath("?group=status"))
    // 작업1 은 '배정 대기'(앞 테스트)
    await expect(statusCol(page, "배정 대기").getByTestId("board-card")).toHaveCount(1)
    await page.getByTestId("board-hide-empty").click()
    await expect(page.getByTestId("board-hide-empty")).toHaveAttribute("aria-pressed", "true")
    await expect(statusCol(page, "병합 대기")).toHaveAttribute("data-collapsed", "true")
    await expect(statusCol(page, "기획 대기")).toHaveAttribute("data-collapsed", "true")
    await expect(statusCol(page, "배정 대기")).not.toHaveAttribute("data-collapsed", "true")

    // 개별 펼침(빈 상태 접기 켠 채로)
    await statusCol(page, "병합 대기").click()
    await expect(statusCol(page, "병합 대기")).not.toHaveAttribute("data-collapsed", "true")
    await expect(statusCol(page, "기획 대기")).toHaveAttribute("data-collapsed", "true")

    // 접힌 띠(기획 대기)에 드롭 → 정확히 그 상태
    await dragCard(
      page,
      statusCol(page, "배정 대기").getByTestId("board-card").first(),
      statusCol(page, "기획 대기")
    )
    const plan = (
      await restGet<{ id: string }>(
        `status?project_id=eq.${projectId}&name=eq.${encodeURIComponent("기획 대기")}&select=id`
      )
    )[0].id
    await expect.poll(() => nodeStatus("작업1")).toBe(plan)
    // 카드가 생긴 열은 펼쳐지고, 비게 된 '배정 대기'는 접힘
    await expect(statusCol(page, "기획 대기")).not.toHaveAttribute("data-collapsed", "true")
    await expect(statusCol(page, "배정 대기")).toHaveAttribute("data-collapsed", "true")

    // 기억(새로고침)
    await page.reload()
    await expect(page.getByTestId("board-hide-empty")).toHaveAttribute("aria-pressed", "true")
    await expect(statusCol(page, "배정 대기")).toHaveAttribute("data-collapsed", "true")
  })
})
