import { test, expect, type Page } from "@playwright/test"
import {
  addChildSingle,
  addChildTyped,
  addContentRoot,
  addWork,
  cleanupCreatedProjects,
  createProject,
  enterEdit,
  saveEdit,
  selectByLabel,
  selectWorkInEmbed,
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
  await addWork(page, "합성세부", "작업A")
  await addWork(page, "합성세부", "작업B")

  // 작업A → 완료 + 도메인 디자인 (임베드 선택 → 상세 '수정' → 저장)
  await selectWorkInEmbed(page, "작업A")
  await enterEdit(page)
  await selectByLabel(page, "detail-status", "완료")
  await selectByLabel(page, "detail-domain", "디자인")
  await saveEdit(page)
  // 작업B 는 기본 상태(할일)로 둠
}

test.describe.serial("보드 뷰", () => {
  test.afterAll(cleanupCreatedProjects)

  test("보드 렌더 + 카테고리별 카드 분류(기본 할일)", async ({ page }) => {
    await signupAndEnter(page)
    await createProject(page, `보드테스트 ${Date.now()}`)
    await buildBoardData(page)

    await page.getByTestId("view-tab-board").click()
    await expect(page.getByTestId("board-view")).toBeVisible()

    await expect(cardIn(page, "완료", "작업A")).toBeVisible()
    await expect(cardIn(page, "할일", "작업B")).toBeVisible() // 신규 기본 = 할일
    // 작업A 카드에 티켓키/도메인 표시
    await expect(cardIn(page, "완료", "작업A")).toContainText("Task-")
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

  test("드래그로 상태 변경 (할일 → 진행중)", async ({ page }) => {
    await signupAndEnter(page)
    await createProject(page, `보드테스트3 ${Date.now()}`)
    await buildBoardData(page)
    await page.getByTestId("view-tab-board").click()

    const card = cardIn(page, "할일", "작업B")
    await expect(card).toBeVisible()
    await card.dragTo(column(page, "진행중"))

    await expect(cardIn(page, "진행중", "작업B")).toBeVisible()
  })

  test("레이어 = 세부기능: 비-작업 노드가 상태 컬럼에 카드로 + 드래그", async ({
    page,
  }) => {
    await signupAndEnter(page)
    await createProject(page, `보드레이어 ${Date.now()}`)
    await addContentRoot(page, "전장")
    await addChildSingle(page, "전장", "소환수기능")
    await addChildTyped(page, "소환수기능", "세부기능", "합성세부")
    await page.getByTestId("view-tab-board").click()

    // 레이어 작업(기본)엔 세부기능 카드 없음
    await expect(page.getByTestId("board-card")).toHaveCount(0)

    // 레이어 전환 → 세부기능 (기본 상태 할일)
    await page.getByTestId("board-layer-세부기능").click()
    await expect(cardIn(page, "할일", "합성세부")).toBeVisible()
    // 도메인/담당 필터는 작업 전용이라 숨김
    await expect(page.getByTestId("board-filter-domain")).toHaveCount(0)

    // 드래그 → 상태 변경(전 타입)
    await cardIn(page, "할일", "합성세부").dragTo(column(page, "진행중"))
    await expect(cardIn(page, "진행중", "합성세부")).toBeVisible()
  })
})
