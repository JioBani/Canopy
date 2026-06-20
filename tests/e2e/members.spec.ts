import { test, expect } from "@playwright/test"
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

test.describe.serial("멤버 수동 관리", () => {
  test.afterAll(cleanupCreatedProjects)

  test("멤버 추가·이름수정·담당자 셀렉트 연동·삭제", async ({ page }) => {
    const name = `아리아_${Date.now()}`
    const renamed = `${name}-수정`
    await signupAndEnter(page)
    await createProject(page, `멤버E2E ${Date.now()}`)

    const dialog = page.getByTestId("members-dialog")

    // 추가
    await page.getByTestId("members-open").click()
    await expect(dialog).toBeVisible()
    await dialog.getByTestId("member-add-input").fill(name)
    await dialog.getByTestId("member-add").click()
    const row = dialog.locator(`[data-testid="member-row"][data-name="${name}"]`)
    await expect(row).toBeVisible()

    // 이름 수정 (blur 저장)
    await row.getByTestId("member-name-input").fill(renamed)
    await row.getByTestId("member-name-input").blur()
    await expect(
      dialog.locator(`[data-testid="member-row"][data-name="${renamed}"]`)
    ).toBeVisible()

    // 닫기 → 작업 만들고 담당자 셀렉트에 그 멤버가 뜨는지(=목록 연동)
    await page.keyboard.press("Escape")
    await expect(dialog).toBeHidden()

    await addContentRoot(page, "전장")
    await addChildSingle(page, "전장", "소환수기능")
    await addChildTyped(page, "소환수기능", "세부기능", "합성세부")
    await addWork(page, "합성세부", "작업A")
    await selectWorkInEmbed(page, "작업A")
    await enterEdit(page)
    await selectByLabel(page, "detail-assignee", renamed) // 선택=할당 가능 확인
    await saveEdit(page)

    // 삭제
    await page.getByTestId("members-open").click()
    await expect(dialog).toBeVisible()
    await dialog
      .locator(`[data-testid="member-row"][data-name="${renamed}"]`)
      .getByTestId("member-delete")
      .click()
    await expect(
      dialog.locator(`[data-testid="member-row"][data-name="${renamed}"]`)
    ).toHaveCount(0)
  })
})
