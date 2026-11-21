import { test, expect, type Page } from "@playwright/test"
import { restGet, restPost } from "../helpers/rest"
import {
  addChildSingle,
  addChildTyped,
  addContentRoot,
  addWork,
  cleanupCreatedProjects,
  createProject,
  rowByTitle,
  signupAndEnter,
} from "./_helpers"

/**
 * 세부기능 상세 탭 [요구사항 → 작업 | 작업 → 요구사항]
 * — 미연결 묶음·빨간 점, UR 아래 "+ 작업"(생성+자동 링크), 작업 쪽 "요구사항 연결" 피커,
 *   공유 배지, ?tab= URL 반영 + localStorage 기본값, UR 그룹 키 표시.
 */

const detail = (page: Page) => page.getByTestId("node-detail")
const urRow = (page: Page, text: string) =>
  detail(page).getByTestId("ur-row").filter({ hasText: text })
const taskRow = (page: Page, title: string) =>
  detail(page).getByTestId("task-ur-row").filter({ hasText: title })

let projectId = ""
let subId = ""

async function subPath() {
  const n = (await restGet<{ ticket_number: number }>(`node?id=eq.${subId}&select=ticket_number`))[0]
  return `/p/${projectId}/tree/SubFeature-${n.ticket_number}`
}

test.describe.serial("세부기능 탭", () => {
  test.afterAll(cleanupCreatedProjects)

  test("요구사항 → 작업: 미연결 표시와 UR 아래 + 작업", async ({ page }) => {
    await signupAndEnter(page)
    const name = await createProject(page, `탭 ${Date.now()}`)
    projectId = (await restGet<{ id: string }>(`project?name=eq.${encodeURIComponent(name)}&select=id`))[0].id

    await addContentRoot(page, "전장")
    await addChildSingle(page, "전장", "소환기능")
    await addChildTyped(page, "소환기능", "세부기능", "구매세부")
    await addWork(page, "구매세부", "고아작업") // 어떤 UR 에도 안 붙은 작업

    subId = (
      await restGet<{ id: string }>(
        `node?project_id=eq.${projectId}&type=eq.${encodeURIComponent("세부기능")}&select=id`
      )
    )[0].id
    await restPost("ur_group", { feature_id: subId, name: "구매 흐름", sort_order: 0 })
    const gid = (await restGet<{ id: string }>(`ur_group?feature_id=eq.${subId}&select=id`))[0].id
    await restPost("ur", [
      { feature_id: subId, ur_group_id: gid, text: "요구사항 A", status: "미구현", sort_order: 0 },
      { feature_id: subId, ur_group_id: gid, text: "요구사항 B", status: "미구현", sort_order: 1 },
    ])

    await rowByTitle(page, "구매세부").click()
    // 기본 탭 = 요구사항 → 작업, 빈 곳 빨간 점
    await expect(detail(page).getByTestId("detail-tab-ur")).toHaveAttribute("aria-selected", "true")
    await expect(detail(page).getByTestId("tab-gap-dot").first()).toBeVisible()
    // 그룹 키 표시
    await expect(detail(page).getByTestId("ur-group-key")).toContainText("RequirementGroup-")
    // 미연결 작업 묶음
    await expect(detail(page).getByTestId("unlinked-works")).toContainText("고아작업")
    // 작업 없는 UR → 경고 문구
    await expect(urRow(page, "요구사항 A").getByTestId("ur-coverage")).toHaveAttribute("data-uncovered", "true")

    // UR 아래 + 작업 → 생성 + 자동 링크, 화면 유지
    const before = page.url()
    await urRow(page, "요구사항 A").getByTestId("ur-add-work").click()
    const input = urRow(page, "요구사항 A").getByTestId("ur-add-work-input")
    await input.fill("A용 작업")
    await input.press("Enter")
    await expect(urRow(page, "요구사항 A").getByTestId("ur-works")).toContainText("A용 작업")
    await expect(urRow(page, "요구사항 A").getByTestId("ur-coverage")).toContainText("작업 1")
    expect(page.url()).toBe(before)
    await expect(detail(page).getByTestId("detail-title")).toHaveValue("구매세부")
  })

  test("작업 → 요구사항: 탭 URL 반영, 요구사항 연결 피커, 공유 배지, 미연결 UR", async ({ page }) => {
    await page.goto(await subPath())
    await detail(page).getByTestId("detail-tab-task").click()
    await expect.poll(() => new URL(page.url()).searchParams.get("tab")).toBe("task")

    // 고아작업: 요구사항 없음 → 피커로 요구사항 B 연결
    await expect(taskRow(page, "고아작업")).toContainText("충족하는 요구사항 없음")
    await taskRow(page, "고아작업").getByTestId("work-link-ur").click()
    await detail(page).getByTestId("ur-picker-option").filter({ hasText: "요구사항 B" }).click()
    await expect(taskRow(page, "고아작업").getByTestId("linked-ur-line")).toContainText("요구사항 B")

    // A용 작업도 요구사항 B 를 충족 → 공유
    await taskRow(page, "A용 작업").getByTestId("work-link-ur").click()
    await detail(page).getByTestId("ur-picker-option").filter({ hasText: "요구사항 B" }).click()
    await expect(taskRow(page, "A용 작업").getByTestId("linked-ur-line")).toHaveCount(2)

    // 모든 UR 연결됨 → 미연결 UR 묶음 없음
    await expect(detail(page).getByTestId("unlinked-urs")).toHaveCount(0)

    // 요구사항 탭에서 공유 배지
    await detail(page).getByTestId("detail-tab-ur").click()
    await expect(
      urRow(page, "요구사항 A").getByTestId("work-row").filter({ hasText: "A용 작업" }).getByTestId("shared-badge")
    ).toContainText("공유 2")
  })

  test("탭: ?tab= 링크로 열기 + URL 에 없으면 마지막 선택 기억", async ({ page }) => {
    await page.goto(`${await subPath()}?tab=task`)
    await expect(detail(page).getByTestId("detail-tab-task")).toHaveAttribute("aria-selected", "true")
    await expect(detail(page).getByTestId("task-ur-tab")).toBeVisible()

    // 탭 클릭으로 task 를 고른 뒤, tab 없는 URL 로 열면 task 유지(localStorage)
    await detail(page).getByTestId("detail-tab-ur").click()
    await detail(page).getByTestId("detail-tab-task").click()
    await page.goto(await subPath())
    await expect(detail(page).getByTestId("detail-tab-task")).toHaveAttribute("aria-selected", "true")

    // 새 UR(작업 없음) → 작업 탭 하단 미연결 UR 묶음 + "+ 작업"
    await restPost("ur", { feature_id: subId, text: "요구사항 C", status: "미구현", sort_order: 9 })
    await page.reload()
    const unlinked = detail(page).getByTestId("unlinked-urs")
    await expect(unlinked).toContainText("요구사항 C")
    await unlinked.getByTestId("ur-add-work").click()
    await unlinked.getByTestId("ur-add-work-input").fill("C용 작업")
    await unlinked.getByTestId("ur-add-work-input").press("Enter")
    await expect(taskRow(page, "C용 작업").getByTestId("linked-ur-line")).toContainText("요구사항 C")
    await expect(detail(page).getByTestId("unlinked-urs")).toHaveCount(0)
  })
})
