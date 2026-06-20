import { test, expect } from "@playwright/test"
import { restGet } from "../helpers/rest"
import {
  addChildSingle,
  addChildTyped,
  addContentRoot,
  cleanupCreatedProjects,
  createProject,
  rowByTitle,
  signupAndEnter,
} from "./_helpers"

test.describe.serial("노드 상세 패널", () => {
  test.afterAll(cleanupCreatedProjects)

  test("선택→상세, 제목·body 편집, 상태→진행바 실시간, 도메인·작업자 저장", async ({
    page,
  }) => {
    await signupAndEnter(page)
    const projectName = await createProject(page, `상세테스트 ${Date.now()}`, "DT")

    await addContentRoot(page, "전장")
    await addChildSingle(page, "전장", "소환수기능")
    await addChildTyped(page, "소환수기능", "세부기능", "합성세부")
    await addChildSingle(page, "합성세부", "로직작업")

    // 작업 선택 → 상세 표시
    await rowByTitle(page, "로직작업").click()
    await expect(page.getByTestId("node-detail")).toBeVisible()
    await expect(page.getByTestId("detail-type")).toHaveText("작업")
    await expect(page.getByTestId("detail-ticket")).toContainText("DT-")

    // 상태 '완료' → 세부기능 진행바 100% (실시간, 새로고침 없이) + 작업 뱃지
    await page.getByTestId("detail-status").selectOption({ label: "완료" })
    await expect(
      rowByTitle(page, "합성세부").getByTestId("node-progress")
    ).toHaveAttribute("data-progress", "100")
    await expect(
      rowByTitle(page, "로직작업").getByTestId("status-badge")
    ).toHaveAttribute("data-status", "완료")

    // 도메인 / 작업자 (작업자: index 1 = 가입 유저)
    await page.getByTestId("detail-domain").selectOption("디자인")
    await page.getByTestId("detail-assignee").selectOption({ index: 1 })

    // 제목 편집 (Enter 저장) → 트리 갱신
    await page.getByTestId("detail-title").fill("로직작업-수정")
    await page.getByTestId("detail-title").press("Enter")
    await expect(rowByTitle(page, "로직작업-수정")).toBeVisible()

    // body 편집 + 미리보기 렌더
    await page.getByTestId("detail-body").fill("# 개요\n**중요** 항목")
    await page.getByTestId("body-preview-toggle").click()
    await expect(page.getByTestId("body-preview").locator("h1")).toHaveText(
      "개요"
    )
    await expect(page.getByTestId("body-preview").locator("strong")).toHaveText(
      "중요"
    )

    // 영속성 검증 (REST)
    const projs = await restGet<{ id: string }>(
      `project?name=eq.${encodeURIComponent(projectName)}&select=id`
    )
    const tasks = await restGet<{
      title: string
      body: string
      domain: string
      assignee_id: string | null
      status_id: string | null
    }>(
      `node?project_id=eq.${projs[0].id}&type=eq.${encodeURIComponent("작업")}&select=title,body,domain,assignee_id,status_id`
    )
    expect(tasks).toHaveLength(1)
    expect(tasks[0].title).toBe("로직작업-수정")
    expect(tasks[0].body).toContain("# 개요")
    expect(tasks[0].domain).toBe("디자인")
    expect(tasks[0].assignee_id).not.toBeNull()
    expect(tasks[0].status_id).not.toBeNull()
  })

  test("비-작업 노드는 상태/도메인/작업자 필드가 없다", async ({ page }) => {
    await signupAndEnter(page)
    await createProject(page, `상세테스트2 ${Date.now()}`, "DU")
    await addContentRoot(page, "전장")

    await rowByTitle(page, "전장").click()
    await expect(page.getByTestId("node-detail")).toBeVisible()
    await expect(page.getByTestId("detail-type")).toHaveText("컨텐츠")
    await expect(page.getByTestId("detail-status")).toHaveCount(0)
    await expect(page.getByTestId("detail-domain")).toHaveCount(0)
    await expect(page.getByTestId("detail-assignee")).toHaveCount(0)
  })
})
