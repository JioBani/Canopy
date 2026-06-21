import { test, expect, type Page } from "@playwright/test"
import { restGet } from "../helpers/rest"
import {
  addChildSingle,
  addChildTyped,
  addContentRoot,
  addWork,
  cleanupCreatedProjects,
  createProject,
  pickCombobox,
  rowByTitle,
  selectWorkInEmbed,
  signupAndEnter,
} from "./_helpers"

async function buildTree(page: Page) {
  await addContentRoot(page, "전장")
  await addChildSingle(page, "전장", "소환수기능")
  await addChildTyped(page, "소환수기능", "세부기능", "합성세부")
  await addWork(page, "합성세부", "로직작업")
}

function detail(page: Page) {
  return page.getByTestId("node-detail")
}
function urRow(page: Page, text: string) {
  return detail(page).getByTestId("ur-row").filter({ hasText: text })
}

test.describe.serial("UR 서브시스템 (세부기능 소유)", () => {
  test.afterAll(cleanupCreatedProjects)

  test("세부기능 UR: 추가 → 미커버 → 상태(완료/오구현+사유)", async ({ page }) => {
    const projectName = await signupProj(page, "UR")
    await buildTree(page)

    // 세부기능 선택 → 상세 UR/작업 섹션(상시 편집)
    await rowByTitle(page, "합성세부").click()
    await expect(detail(page).getByTestId("subfeature-sections")).toBeVisible()

    // UR 추가 (미분류)
    await detail(page).getByTestId("add-ur").click()
    await detail(page).getByTestId("ur-text-input").fill("2마리 합성")
    await detail(page).getByTestId("ur-text-input").press("Enter")
    const row = urRow(page, "2마리 합성")
    await expect(row).toBeVisible()
    // 타입 기반 키와 일관: UR 행에 Requirement-N 표시
    await expect(row.getByTestId("ur-key")).toContainText("Requirement-")
    await expect(row.getByTestId("ur-coverage")).toHaveAttribute(
      "data-uncovered",
      "true"
    )

    // 상태 완료
    await row.getByTestId("ur-state").click()
    await page.getByTestId("ur-state-option").filter({ hasText: "완료" }).click()
    await expect(urRow(page, "2마리 합성").getByTestId("ur-state")).toHaveAttribute(
      "data-status",
      "완료"
    )
    // UR 완료 → 세부기능 진행바 100% 실시간 반영(리로드 없음, UR 1/1)
    await expect(
      rowByTitle(page, "합성세부").getByTestId("node-progress")
    ).toHaveAttribute("data-progress", "100")

    // 상태 오구현 + 사유 입력
    await urRow(page, "2마리 합성").getByTestId("ur-state").click()
    await page.getByTestId("ur-state-option").filter({ hasText: "오구현" }).click()
    await urRow(page, "2마리 합성").getByTestId("ur-expand").click()
    await page.getByTestId("misimpl-reason").fill("물리/마법으로 분리됨")
    await page.getByTestId("misimpl-reason").blur()

    // REST 검증(프로젝트 스코프: 세부기능 id 로 한정): status 오구현 + 사유 저장
    const projs = await restGet<{ id: string }>(
      `project?name=eq.${encodeURIComponent(projectName)}&select=id`
    )
    const subs = await restGet<{ id: string }>(
      `node?project_id=eq.${projs[0].id}&type=eq.${encodeURIComponent("세부기능")}&select=id`
    )
    await expect
      .poll(async () => {
        const urs = await restGet<{ status: string; misimpl_reason: string }>(
          `ur?feature_id=eq.${subs[0].id}&select=status,misimpl_reason`
        )
        return `${urs[0]?.status}|${urs[0]?.misimpl_reason ?? ""}`
      })
      .toContain("오구현|물리/마법")
  })

  test("작업↔UR 링크 → 커버리지 + 체크리스트 + blocks", async ({ page }) => {
    await signupProj(page, "UV")
    await buildTree(page)

    // 세부기능에 UR 추가 (상시 편집)
    await rowByTitle(page, "합성세부").click()
    await detail(page).getByTestId("add-ur").click()
    await detail(page).getByTestId("ur-text-input").fill("링크대상 UR")
    await detail(page).getByTestId("ur-text-input").press("Enter")
    await expect(urRow(page, "링크대상 UR")).toBeVisible()

    // 임베드에서 작업 선택 → 작업 상세(상시 편집)
    await selectWorkInEmbed(page, "로직작업")
    await expect(page.getByTestId("task-checklist")).toBeVisible()

    // 체크리스트
    await page.getByTestId("checklist-input").fill("패널 만들기")
    await page.getByTestId("checklist-input").press("Enter")
    const item = page
      .getByTestId("checklist-item")
      .filter({ hasText: "패널 만들기" })
    await item.getByTestId("checklist-toggle").click()
    await expect(item.getByTestId("checklist-toggle")).toBeChecked()

    // 만족 UR 연결 (다이얼로그: 현재 세부기능 섹션에서 선택)
    await page.getByTestId("ur-link-open").click()
    const urDialog = page.getByTestId("ur-link-dialog")
    await expect(urDialog).toBeVisible()
    await expect(urDialog.getByTestId("ur-link-current")).toBeVisible()
    // 다른 요구사항은 계층 트리(컨텐츠 노드부터, 기본 접힘)로 제공
    await expect(urDialog.getByTestId("ur-link-tree")).toBeVisible()
    await expect(
      urDialog.getByTestId("ur-tree-node").filter({ hasText: "전장" })
    ).toBeVisible()
    await urDialog
      .getByTestId("ur-link-row")
      .filter({ hasText: "링크대상 UR" })
      .click()
    await page.keyboard.press("Escape")
    await expect(
      page.getByTestId("linked-ur").filter({ hasText: "링크대상 UR" })
    ).toBeVisible()

    // 선제조건(blocks)
    await pickCombobox(page, "block-picker")
    await expect(page.getByTestId("block-link")).toHaveCount(1)

    // 세부기능 재선택 → UR 커버리지 작업 1
    await rowByTitle(page, "합성세부").click()
    await expect(
      urRow(page, "링크대상 UR").getByTestId("ur-coverage")
    ).toContainText("작업 1")
  })
})

async function signupProj(page: Page, prefix: string): Promise<string> {
  await signupAndEnter(page)
  return createProject(page, `UR테스트 ${Date.now()}`, prefix)
}
