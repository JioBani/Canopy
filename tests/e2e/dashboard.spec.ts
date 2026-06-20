import { test, expect, type Page } from "@playwright/test"
import {
  addChildSingle,
  addChildTyped,
  addContentRoot,
  addWork,
  cleanupCreatedProjects,
  createProject,
  enterEdit,
  rowByTitle,
  saveEdit,
  selectByLabel,
  selectWorkInEmbed,
  signupAndEnter,
} from "./_helpers"

async function build(page: Page) {
  await addContentRoot(page, "전장")
  await addChildSingle(page, "전장", "소환수기능")
  await addChildTyped(page, "소환수기능", "세부기능", "합성세부")
  await addWork(page, "합성세부", "로직작업")

  // 작업: 완료 + 도메인 구현 (상세 '수정' → 저장)
  await selectWorkInEmbed(page, "로직작업")
  await enterEdit(page)
  await selectByLabel(page, "detail-status", "완료")
  await selectByLabel(page, "detail-domain", "구현")
  await saveEdit(page)

  // 세부기능에 UR 추가(UR 섹션 상시 편집, 연결 작업 없음 → 미커버)
  await rowByTitle(page, "합성세부").click()
  await page.getByTestId("add-ur").first().click()
  await page.getByTestId("ur-text-input").fill("미커버 요구사항")
  await page.getByTestId("ur-text-input").press("Enter")
  await expect(
    page.getByTestId("ur-row").filter({ hasText: "미커버 요구사항" })
  ).toBeVisible()
}

test.describe.serial("대시보드", () => {
  test.afterAll(cleanupCreatedProjects)

  test("컨텐츠 진행률·도메인·요구사항 통계·미커버 렌더", async ({ page }) => {
    await signupAndEnter(page)
    await createProject(page, `대시보드테스트 ${Date.now()}`)
    await build(page)

    await page.getByTestId("view-tab-dashboard").click()
    await expect(page.getByTestId("dashboard-view")).toBeVisible()

    // 컨텐츠 진행률(전장) 1개
    await expect(page.getByTestId("dash-content-progress")).toHaveCount(1)
    await expect(page.getByTestId("dash-content-progress")).toContainText("전장")

    // 도메인 분포: 구현 1건
    await expect(
      page.getByTestId("dash-domain").filter({ hasText: "구현" })
    ).toBeVisible()

    // 요구사항 상태 통계: 미구현 1 / 완료 0 (방금 추가한 UR 기본 미구현)
    await expect(page.getByTestId("dash-ur-stats")).toBeVisible()
    await expect(page.getByTestId("dash-ur-stat-미구현")).toContainText("1")
    await expect(page.getByTestId("dash-ur-stat-완료")).toContainText("0")

    // 미커버 UR 수 = 1 (연결 작업 0 · 미완)
    await expect(page.getByTestId("dash-uncovered-count")).toHaveText("1")
    await expect(
      page.getByTestId("dash-uncovered-feature").filter({ hasText: "합성세부" })
    ).toBeVisible()
  })

  test("미커버 기능 클릭 → 해당 기능 점프", async ({ page }) => {
    await signupAndEnter(page)
    await createProject(page, `대시보드테스트2 ${Date.now()}`)
    await build(page)

    await page.getByTestId("view-tab-dashboard").click()
    await page
      .getByTestId("dash-uncovered-feature")
      .filter({ hasText: "합성세부" })
      .click()
    await expect(page.getByTestId("detail-title")).toHaveValue("합성세부")
  })

  test("완료 UR 은 작업 0개여도 미커버에서 빠진다", async ({ page }) => {
    await signupAndEnter(page)
    await createProject(page, `대시보드테스트3 ${Date.now()}`)
    await build(page)

    // 초기: 미커버 1
    await page.getByTestId("view-tab-dashboard").click()
    await expect(page.getByTestId("dash-uncovered-count")).toHaveText("1")

    // 트리에서 그 UR 을 완료로 변경
    await page.getByTestId("view-tab-tree").click()
    await rowByTitle(page, "합성세부").click()
    const detail = page.getByTestId("node-detail")
    const row = detail
      .getByTestId("ur-row")
      .filter({ hasText: "미커버 요구사항" })
    await row.getByTestId("ur-state").click()
    await page.getByTestId("ur-state-option").filter({ hasText: "완료" }).click()
    await expect(row.getByTestId("ur-state")).toHaveAttribute(
      "data-status",
      "완료"
    )

    // 대시보드 재진입: 미커버 0(완료 제외) + 상태통계 완료 1
    await page.getByTestId("view-tab-dashboard").click()
    await expect(page.getByTestId("dash-uncovered-count")).toHaveText("0")
    await expect(page.getByTestId("dash-ur-stat-완료")).toContainText("1")
  })
})
