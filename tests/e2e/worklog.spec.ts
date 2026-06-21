import { test, expect, type Page } from "@playwright/test"
import {
  addChildSingle,
  addChildTyped,
  addContentRoot,
  addWork,
  cleanupCreatedProjects,
  createProject,
  selectWorkInEmbed,
  signupAndEnter,
} from "./_helpers"

function detail(page: Page) {
  return page.getByTestId("node-detail")
}

test.describe.serial("작업 시간 측정", () => {
  test.afterAll(cleanupCreatedProjects)

  test("시작→진행중 타이머→종료(note)→로그+총시간, duration 편집 반영", async ({
    page,
  }) => {
    await signupAndEnter(page)
    await createProject(page, `시간측정 ${Date.now()}`)
    await addContentRoot(page, "전장")
    await addChildSingle(page, "전장", "소환수기능")
    await addChildTyped(page, "소환수기능", "세부기능", "합성세부")
    await addWork(page, "합성세부", "작업A")
    await selectWorkInEmbed(page, "작업A")

    const d = detail(page)
    await expect(d.getByTestId("work-log-section")).toBeVisible()
    await expect(d.getByTestId("work-log-total")).toContainText("0분")

    // 시작 → 진행 중 타이머(즉시 동작)
    await d.getByTestId("work-log-start").click()
    await expect(d.getByTestId("work-log-active")).toBeVisible()
    await expect(d.getByTestId("work-log-start")).toHaveCount(0)

    // 종료 + 노트(선택)
    await d.getByTestId("work-log-stop-note").fill("코딩 세션")
    await d.getByTestId("work-log-stop").click()
    const row = d.getByTestId("work-log-row").first()
    await expect(row).toBeVisible()
    await expect(row).toContainText("코딩 세션")
    // 종료되면 다시 시작 버튼
    await expect(d.getByTestId("work-log-start")).toBeVisible()

    // 로그 '수정' → duration 45분 → '완료' → 총 작업 시간 45분 반영(구성상 일관)
    await d.getByTestId("work-log-edit").click()
    await row.getByTestId("work-log-duration-input").fill("45")
    await row.getByTestId("work-log-duration-input").blur()
    await d.getByTestId("work-log-edit").click()
    await expect(d.getByTestId("work-log-total")).toContainText("45분")
  })

  test("총 작업 시간 직접 보정", async ({ page }) => {
    await signupAndEnter(page)
    await createProject(page, `시간측정2 ${Date.now()}`)
    await addContentRoot(page, "전장")
    await addChildSingle(page, "전장", "소환수기능")
    await addChildTyped(page, "소환수기능", "세부기능", "합성세부")
    await addWork(page, "합성세부", "작업A")
    await selectWorkInEmbed(page, "작업A")

    const d = detail(page)
    await d.getByTestId("work-log-total-edit").click()
    await d.getByTestId("work-log-total-input").fill("120")
    await d.getByTestId("work-log-total-input").blur()
    await d.getByTestId("work-log-total-edit").click()
    await expect(d.getByTestId("work-log-total")).toContainText("2시간 0분")
  })
})
