import { test, expect, type Page } from "@playwright/test"
import {
  addChildSingle,
  addChildTyped,
  addContentRoot,
  cleanupCreatedProjects,
  createProject,
  pickCombobox,
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

function urRow(page: Page, text: string) {
  return page.getByTestId("ur-row").filter({ hasText: text })
}

test.describe.serial("UR 서브시스템", () => {
  test.afterAll(cleanupCreatedProjects)

  test("기능 UR: 그룹/UR 추가 → 미커버 → 작업 링크 → 커버리지 → 완료 집계", async ({
    page,
  }) => {
    await signupAndEnter(page)
    await createProject(page, `UR테스트 ${Date.now()}`, "UR")
    await buildTree(page)

    // 기능 선택 → UR 패널
    await rowByTitle(page, "소환수기능").click()
    await expect(page.getByTestId("feature-ur-panel")).toBeVisible()

    // 그룹 추가
    await page.getByTestId("add-ur-group").click()
    await page.getByTestId("ur-group-name-input").fill("합성")
    await page.getByTestId("ur-group-name-input").press("Enter")
    await expect(
      page.getByTestId("ur-group-name").filter({ hasText: "합성" })
    ).toBeVisible()

    // UR 추가
    await page.getByTestId("add-ur").first().click()
    await page.getByTestId("ur-text-input").fill("2마리 합성")
    await page.getByTestId("ur-text-input").press("Enter")
    await expect(urRow(page, "2마리 합성")).toBeVisible()

    // 연결 작업 0 → 미커버
    await expect(urRow(page, "2마리 합성").getByTestId("ur-coverage")).toHaveAttribute(
      "data-uncovered",
      "true"
    )

    // 작업 선택 → UR 링크
    await rowByTitle(page, "로직작업").click()
    await expect(page.getByTestId("task-ur-links")).toBeVisible()
    await pickCombobox(page, "ur-link-picker", "2마리 합성")
    await expect(
      page.getByTestId("linked-ur").filter({ hasText: "2마리 합성" })
    ).toBeVisible()

    // 기능 재선택 → 커버리지 작업 1 / 완료 0 (미커버 해제)
    await rowByTitle(page, "소환수기능").click()
    const cov = urRow(page, "2마리 합성").getByTestId("ur-coverage")
    await expect(cov).toHaveAttribute("data-uncovered", "false")
    await expect(cov).toContainText("작업 1")
    await expect(cov).toContainText("완료 0")

    // 작업 완료 처리 → 기능 재선택 → 완료 1
    await rowByTitle(page, "로직작업").click()
    await selectByLabel(page, "detail-status", "완료")
    await rowByTitle(page, "소환수기능").click()
    await expect(
      urRow(page, "2마리 합성").getByTestId("ur-coverage")
    ).toContainText("완료 1")
  })

  test("작업: 체크리스트 + 선제조건(blocks)", async ({ page }) => {
    await signupAndEnter(page)
    await createProject(page, `UR테스트2 ${Date.now()}`, "UV")
    await buildTree(page)

    await rowByTitle(page, "로직작업").click()

    // 체크리스트 추가 + 토글
    await expect(page.getByTestId("task-checklist")).toBeVisible()
    await page.getByTestId("checklist-input").fill("합성 패널 만들기")
    await page.getByTestId("checklist-input").press("Enter")
    const item = page.getByTestId("checklist-item").filter({
      hasText: "합성 패널 만들기",
    })
    await expect(item).toBeVisible()
    await item.getByTestId("checklist-toggle").click()
    await expect(item.getByTestId("checklist-toggle")).toBeChecked()

    // 선제조건(blocks) 추가 — 콤보박스에서 첫 후보 선택
    await expect(page.getByTestId("task-blocks")).toBeVisible()
    await pickCombobox(page, "block-picker")
    await expect(page.getByTestId("block-link")).toHaveCount(1)
  })
})
