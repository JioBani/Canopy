import { test, expect, type Page } from "@playwright/test"
import {
  addChildSingle,
  addChildTyped,
  addContentRoot,
  addWork,
  cleanupCreatedProjects,
  createProject,
  selectByLabel,
  selectWorkInEmbed,
  signupAndEnter,
} from "./_helpers"

async function buildTaskTree(page: Page) {
  await addContentRoot(page, "전장")
  await addChildSingle(page, "전장", "소환수기능")
  await addChildTyped(page, "소환수기능", "세부기능", "합성세부")
  await addWork(page, "합성세부", "로직작업")
}

function cat(page: Page, name: string) {
  return page.locator(`[data-testid="status-cat"][data-cat="${name}"]`)
}

/** 임베드 작업 행의 상태 뱃지 (작업탭 활성화 후). */
async function workBadge(page: Page, title: string) {
  const embed = page.getByTestId("subfeature-embed")
  await embed.getByTestId("work-tab").click()
  return embed.getByTestId("work-row").filter({ hasText: title }).getByTestId(
    "status-badge"
  )
}

test.describe.serial("커스텀 상태 설정", () => {
  test.afterAll(cleanupCreatedProjects)

  test("상태 추가 → 작업에 지정 → 사용중 삭제는 재지정 요구", async ({ page }) => {
    await signupAndEnter(page)
    await createProject(page, `상태테스트 ${Date.now()}`, "ST")
    await buildTaskTree(page)

    // 설정 열기 → 진행중 카테고리에 "개발중" 추가
    await page.getByTestId("project-settings").click()
    await expect(page.getByTestId("status-settings")).toBeVisible()
    await cat(page, "진행중").getByTestId("status-add-input").fill("개발중")
    await cat(page, "진행중").getByTestId("status-add").click()
    await expect(cat(page, "진행중").getByTestId("status-row")).toHaveCount(2)

    // 닫기 후 작업에 "개발중" 지정
    await page.keyboard.press("Escape")
    await expect(page.getByTestId("status-settings")).toHaveCount(0)
    await selectWorkInEmbed(page, "로직작업")
    await selectByLabel(page, "detail-status", "개발중")
    await expect(await workBadge(page, "로직작업")).toHaveAttribute(
      "data-status",
      "진행중"
    )

    // 다시 설정 → 개발중 사용 1 → 삭제 시 재지정 요구
    await page.getByTestId("project-settings").click()
    const devRow = cat(page, "진행중").getByTestId("status-row").last()
    await expect(devRow.getByTestId("status-usage")).toHaveText("사용 1")
    await devRow.getByTestId("status-delete").click()
    await expect(page.getByTestId("status-delete-confirm")).toContainText("1")
    // 이전 대상 기본값 = 할일 기본 상태(상태는 비울 수 없음)
    await expect(page.getByTestId("status-reassign")).toContainText("할일 / 할일")
    await selectByLabel(page, "status-reassign", "할일 / 할일")
    await page.getByTestId("status-delete-go").click()
    await expect(cat(page, "진행중").getByTestId("status-row")).toHaveCount(1)

    // 닫고 → 작업 상태가 할일로 이동됐는지
    await page.keyboard.press("Escape")
    await expect(await workBadge(page, "로직작업")).toHaveAttribute(
      "data-status",
      "할일"
    )
  })

  test("상태 이름 변경이 작업 뱃지에 반영된다", async ({ page }) => {
    await signupAndEnter(page)
    await createProject(page, `상태테스트2 ${Date.now()}`, "SU")
    await buildTaskTree(page)

    // 작업을 완료 상태로
    await selectWorkInEmbed(page, "로직작업")
    await selectByLabel(page, "detail-status", "완료")

    // 완료 상태 이름을 "릴리스"로 변경
    await page.getByTestId("project-settings").click()
    const doneRow = cat(page, "완료").getByTestId("status-row").first()
    await doneRow.getByTestId("status-name-input").fill("릴리스")
    await doneRow.getByTestId("status-name-input").blur()
    await page.keyboard.press("Escape")

    // 작업 뱃지: 카테고리 완료 유지 + 이름 릴리스 반영
    const badge = await workBadge(page, "로직작업")
    await expect(badge).toHaveAttribute("data-status", "완료")
    await expect(badge).toContainText("릴리스")
  })

  test("상태 필수: 상세 상태 선택지에 '미지정' 없음, 마지막 할일 상태 삭제 불가, 이전 대상 기본=할일", async ({
    page,
  }) => {
    await signupAndEnter(page)
    await createProject(page, `상태필수 ${Date.now()}`, "SR")
    await buildTaskTree(page)

    // 새 작업 = 기본 할일
    await expect(await workBadge(page, "로직작업")).toHaveAttribute("data-status", "할일")

    // 상세 상태 선택지: '미지정' 없음
    await selectWorkInEmbed(page, "로직작업")
    const arrow = page.getByTestId("detail-status-arrow")
    if (await arrow.count()) await arrow.click()
    else await page.getByTestId("detail-status").click()
    await expect(page.getByRole("option").first()).toBeVisible()
    await expect(page.getByRole("option", { name: "미지정", exact: true })).toHaveCount(0)
    await page.keyboard.press("Escape")

    // 설정: 할일 분류의 유일한 상태는 삭제 버튼 비활성
    await page.getByTestId("project-settings").click()
    const todoRows = cat(page, "할일").getByTestId("status-row")
    await expect(todoRows).toHaveCount(1)
    await expect(todoRows.first().getByTestId("status-delete")).toBeDisabled()

    // 다른 분류 상태는 삭제 가능
    const prog = cat(page, "진행중").getByTestId("status-row").first()
    await expect(prog.getByTestId("status-delete")).toBeEnabled()
  })
})
