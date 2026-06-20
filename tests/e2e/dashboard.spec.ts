import { test, expect, type Page } from "@playwright/test"
import {
  addChildSingle,
  addChildTyped,
  addContentRoot,
  cleanupCreatedProjects,
  createProject,
  rowByTitle,
  signupAndEnter,
} from "./_helpers"

async function build(page: Page, myEmail: string) {
  await addContentRoot(page, "전장")
  await addChildSingle(page, "전장", "소환수기능")
  await addChildTyped(page, "소환수기능", "세부기능", "합성세부")
  await addChildSingle(page, "합성세부", "로직작업")

  // 작업: 완료 + 도메인 구현 + 나에게 배정(현재 유저 이메일로)
  await rowByTitle(page, "로직작업").click()
  await page.getByTestId("detail-status").selectOption({ label: "완료" })
  await page.getByTestId("detail-domain").selectOption("구현")
  await page.getByTestId("detail-assignee").selectOption({ label: myEmail })

  // 기능에 UR 추가(연결 작업 없음 → 미커버)
  await rowByTitle(page, "소환수기능").click()
  await page.getByTestId("add-ur").first().click()
  await page.getByTestId("ur-text-input").fill("미커버 요구사항")
  await page.getByTestId("ur-text-input").press("Enter")
  await expect(
    page.getByTestId("ur-row").filter({ hasText: "미커버 요구사항" })
  ).toBeVisible()
}

test.describe.serial("대시보드", () => {
  test.afterAll(cleanupCreatedProjects)

  test("컨텐츠 진행률·도메인·내 작업·미커버 렌더 + 점프", async ({ page }) => {
    const email = await signupAndEnter(page)
    await createProject(page, `대시보드테스트 ${Date.now()}`, "DB")
    await build(page, email)

    await page.getByTestId("view-tab-dashboard").click()
    await expect(page.getByTestId("dashboard-view")).toBeVisible()

    // 컨텐츠 진행률(전장) 1개
    await expect(page.getByTestId("dash-content-progress")).toHaveCount(1)
    await expect(page.getByTestId("dash-content-progress")).toContainText("전장")

    // 도메인 분포: 구현 1건
    await expect(
      page.getByTestId("dash-domain").filter({ hasText: "구현" })
    ).toBeVisible()

    // 미커버 UR 수 ≥ 1
    await expect(page.getByTestId("dash-uncovered-count")).toHaveText("1")
    await expect(
      page.getByTestId("dash-uncovered-feature").filter({ hasText: "소환수기능" })
    ).toBeVisible()

    // 내 작업 → 클릭 시 트리 전환 + 상세
    const myTask = page.getByTestId("dash-my-task").filter({ hasText: "로직작업" })
    await expect(myTask).toBeVisible()
    await myTask.click()
    await expect(page.getByTestId("node-detail")).toBeVisible()
    await expect(page.getByTestId("detail-title")).toHaveValue("로직작업")
  })

  test("미커버 기능 클릭 → 해당 기능 점프", async ({ page }) => {
    const email = await signupAndEnter(page)
    await createProject(page, `대시보드테스트2 ${Date.now()}`, "DC")
    await build(page, email)

    await page.getByTestId("view-tab-dashboard").click()
    await page
      .getByTestId("dash-uncovered-feature")
      .filter({ hasText: "소환수기능" })
      .click()
    await expect(page.getByTestId("detail-title")).toHaveValue("소환수기능")
  })
})
