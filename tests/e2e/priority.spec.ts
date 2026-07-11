import { test, expect } from "@playwright/test"
import { restGet } from "../helpers/rest"
import {
  addContentRoot,
  cleanupCreatedProjects,
  createProject,
  rowByTitle,
  selectByLabel,
  signupAndEnter,
} from "./_helpers"

test.describe.serial("우선순위 필드 (커스텀 필드)", () => {
  test.afterAll(cleanupCreatedProjects)

  test("상세에서 우선순위 지정 → 영속 + 보드 뱃지·필터", async ({ page }) => {
    await signupAndEnter(page)
    const projectName = await createProject(page, `우선순위 ${Date.now()}`)
    await addContentRoot(page, "전장")

    // 상세: 우선순위 셀렉터는 전 타입 노출(여기선 컨텐츠)
    await rowByTitle(page, "전장").click()
    await expect(page.getByTestId("node-detail")).toBeVisible()
    await expect(page.getByTestId("detail-priority")).toHaveCount(1)
    await selectByLabel(page, "detail-priority", "높음")

    // 영속성 검증(REST) — node.fields.priority
    const projs = await restGet<{ id: string }>(
      `project?name=eq.${encodeURIComponent(projectName)}&select=id`
    )
    await expect
      .poll(async () => {
        const rows = await restGet<{ fields: { priority?: string } }>(
          `node?project_id=eq.${projs[0].id}&select=fields`
        )
        return rows[0]?.fields?.priority
      })
      .toBe("높음")

    // 보드: 컨텐츠 레이어 카드에 우선순위 뱃지
    await page.getByTestId("view-tab-board").click()
    await page.getByTestId("board-layer-컨텐츠").click()
    const card = page.getByTestId("board-card").filter({ hasText: "전장" })
    await expect(card.getByTestId("board-card-priority")).toHaveAttribute(
      "data-priority",
      "높음"
    )

    // 우선순위 필터: 최우선 → 0건, 높음 → 1건
    await selectByLabel(page, "board-filter-priority", "최우선")
    await expect(page.getByTestId("board-card")).toHaveCount(0)
    await selectByLabel(page, "board-filter-priority", "높음")
    await expect(page.getByTestId("board-card")).toHaveCount(1)
  })
})
