import { test, expect, type Page } from "@playwright/test"
import { restGet } from "../helpers/rest"
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

/** 임베드 작업 행(작업탭 활성화 후). */
function embedWork(page: Page, title: string) {
  return page
    .getByTestId("subfeature-embed")
    .getByTestId("work-row")
    .filter({ hasText: title })
}

test.describe.serial("노드 상세 패널", () => {
  test.afterAll(cleanupCreatedProjects)

  test("선택→상세, 제목·body 편집, 상태→임베드 뱃지, 도메인 저장", async ({
    page,
  }) => {
    await signupAndEnter(page)
    const projectName = await createProject(page, `상세테스트 ${Date.now()}`, "DT")

    await addContentRoot(page, "전장")
    await addChildSingle(page, "전장", "소환수기능")
    await addChildTyped(page, "소환수기능", "세부기능", "합성세부")
    await addWork(page, "합성세부", "로직작업")

    // 작업 선택(임베드) → 상세 표시
    await selectWorkInEmbed(page, "로직작업")
    await expect(page.getByTestId("node-detail")).toBeVisible()
    await expect(page.getByTestId("detail-type")).toHaveText("작업")
    await expect(page.getByTestId("detail-ticket")).toContainText("Task-")

    // 상태/도메인: property '수정' 토글 후 변경(즉시 저장)
    await enterEdit(page)
    await selectByLabel(page, "detail-status", "완료")
    await selectByLabel(page, "detail-domain", "디자인")
    await saveEdit(page)
    await expect(
      embedWork(page, "로직작업").getByTestId("status-badge")
    ).toHaveAttribute("data-status", "완료")

    // 제목: 인라인 상시 편집(Enter 저장) → 임베드 행 반영
    await page.getByTestId("detail-title").fill("로직작업-수정")
    await page.getByTestId("detail-title").press("Enter")
    await expect(embedWork(page, "로직작업-수정")).toBeVisible()

    // 설명: '수정' 토글 → 입력 → '완료'(저장) → 마크다운 렌더
    await page.getByTestId("body-edit-toggle").click()
    await page.getByTestId("detail-body").fill("# 개요\n**중요** 항목")
    await page.getByTestId("body-edit-toggle").click()
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
    expect(tasks[0].status_id).not.toBeNull()
  })

  test("비-작업 노드도 상태는 있고(전 타입) 기본=할일, 도메인/담당은 없다", async ({
    page,
  }) => {
    await signupAndEnter(page)
    await createProject(page, `상세테스트2 ${Date.now()}`)
    await addContentRoot(page, "전장")

    await rowByTitle(page, "전장").click()
    await expect(page.getByTestId("node-detail")).toBeVisible()
    await expect(page.getByTestId("detail-type")).toHaveText("컨텐츠")
    // 상태 셀렉트는 전 타입 노출 + 신규 기본 '할일'
    await expect(page.getByTestId("detail-status")).toHaveCount(1)
    await expect(page.getByTestId("detail-status")).toContainText("할일")
    // 도메인/담당은 작업 전용
    await expect(page.getByTestId("detail-domain")).toHaveCount(0)
    await expect(page.getByTestId("detail-assignee")).toHaveCount(0)
  })
})
