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

async function buildTree(page: Page) {
  await addContentRoot(page, "전장")
  await addChildSingle(page, "전장", "소환수기능")
  await addChildTyped(page, "소환수기능", "세부기능", "합성세부")
  await addChildSingle(page, "합성세부", "로직작업")
}

test.describe.serial("검색 + 카드 점프", () => {
  test.afterAll(cleanupCreatedProjects)

  test("보드 카드 클릭 → 트리 전환 + 상세 표시", async ({ page }) => {
    await signupAndEnter(page)
    await createProject(page, `검색테스트 ${Date.now()}`, "SC")
    await buildTree(page)

    await page.getByTestId("view-tab-board").click()
    await page.getByTestId("board-card").filter({ hasText: "로직작업" }).click()

    // 트리로 전환되고 상세에 그 작업이 뜸
    await expect(page.getByTestId("node-detail")).toBeVisible()
    await expect(page.getByTestId("detail-title")).toHaveValue("로직작업")
  })

  test("전역 텍스트 검색 → 결과 클릭 점프", async ({ page }) => {
    await signupAndEnter(page)
    await createProject(page, `검색테스트2 ${Date.now()}`, "SD")
    await buildTree(page)

    await page.getByTestId("search-open").click()
    await expect(page.getByTestId("search-dialog")).toBeVisible()
    await page.getByTestId("search-input").fill("로직")
    const hit = page.getByTestId("search-result").filter({ hasText: "로직작업" })
    await expect(hit).toBeVisible()
    await hit.click()

    await expect(page.getByTestId("search-dialog")).toHaveCount(0)
    await expect(page.getByTestId("detail-title")).toHaveValue("로직작업")
  })

  test("패싯(타입) 필터", async ({ page }) => {
    await signupAndEnter(page)
    await createProject(page, `검색테스트3 ${Date.now()}`, "SE")
    await buildTree(page)

    await page.getByTestId("search-open").click()
    await selectByLabel(page, "search-type", "컨텐츠")
    // 컨텐츠 타입은 '전장' 하나만
    await expect(page.getByTestId("search-result")).toHaveCount(1)
    await expect(page.getByTestId("search-result")).toContainText("전장")
  })
})
