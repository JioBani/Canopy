import { test, expect, type Page } from "@playwright/test"
import {
  addChildSingle,
  addChildTyped,
  addContentRoot,
  cleanupCreatedProjects,
  createProject,
  rowByTitle,
  selectByLabel,
  signupAndEnter,
} from "./_helpers"

function column(page: Page, category: string) {
  return page.locator(
    `[data-testid="board-column"][data-category="${category}"]`
  )
}
function cardIn(page: Page, category: string, text: string) {
  return column(page, category).getByTestId("board-card").filter({ hasText: text })
}

async function buildBoardData(page: Page) {
  await addContentRoot(page, "전장")
  await addChildSingle(page, "전장", "소환수기능")
  await addChildTyped(page, "소환수기능", "세부기능", "합성세부")
  await addChildSingle(page, "합성세부", "작업A")
  await addChildSingle(page, "합성세부", "작업B")

  // 작업A → 완료 + 도메인 디자인
  await rowByTitle(page, "작업A").click()
  await selectByLabel(page, "detail-status", "완료")
  await selectByLabel(page, "detail-domain", "디자인")
  // 작업B 는 미지정으로 둠
}

test.describe.serial("보드 뷰", () => {
  test.afterAll(cleanupCreatedProjects)

  test("보드 렌더 + 카테고리별 카드 분류 + 미지정 컬럼", async ({ page }) => {
    await signupAndEnter(page)
    await createProject(page, `보드테스트 ${Date.now()}`, "BD")
    await buildBoardData(page)

    await page.getByTestId("view-tab-board").click()
    await expect(page.getByTestId("board-view")).toBeVisible()

    await expect(cardIn(page, "완료", "작업A")).toBeVisible()
    await expect(cardIn(page, "미지정", "작업B")).toBeVisible()
    // 작업A 카드에 티켓키/도메인 표시
    await expect(cardIn(page, "완료", "작업A")).toContainText("BD-")
    await expect(cardIn(page, "완료", "작업A")).toContainText("디자인")
  })

  test("도메인 필터", async ({ page }) => {
    await signupAndEnter(page)
    await createProject(page, `보드테스트2 ${Date.now()}`, "BE")
    await buildBoardData(page)
    await page.getByTestId("view-tab-board").click()

    await selectByLabel(page, "board-filter-domain", "디자인")
    await expect(page.getByTestId("board-card")).toHaveCount(1)
    await expect(page.getByTestId("board-card")).toContainText("작업A")
  })

  test("드래그로 상태 변경 (미지정 → 진행중)", async ({ page }) => {
    await signupAndEnter(page)
    await createProject(page, `보드테스트3 ${Date.now()}`, "BF")
    await buildBoardData(page)
    await page.getByTestId("view-tab-board").click()

    const card = cardIn(page, "미지정", "작업B")
    await expect(card).toBeVisible()
    await card.dragTo(column(page, "진행중"))

    await expect(cardIn(page, "진행중", "작업B")).toBeVisible()
  })
})
