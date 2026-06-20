import { test, expect, type Page } from "@playwright/test"
import { restGet, restPatch } from "../helpers/rest"
import {
  addChildSingle,
  addChildTyped,
  addContentRoot,
  addWork,
  cleanupCreatedProjects,
  createProject,
  expand,
  rowByTitle,
  signupAndEnter,
} from "./_helpers"

/**
 * 노드 트리 CRUD. 세부기능 펼침은 작업 raw 행 대신 UR/작업 임베드 패널을 보인다
 * (작업은 트리 행이 아님 → 임베드/REST 로 검증).
 */
async function setup(page: Page): Promise<string> {
  await signupAndEnter(page)
  return createProject(page, `트리테스트 ${Date.now()}`, "TR")
}

/** 임베드 작업 행 상태 뱃지 (작업탭 활성화 후). */
async function embedWorkBadge(page: Page, title: string) {
  const embed = page.getByTestId("subfeature-embed")
  await embed.getByTestId("work-tab").click()
  return embed
    .getByTestId("work-row")
    .filter({ hasText: title })
    .getByTestId("status-badge")
}

test.describe.serial("노드 트리", () => {
  test.afterAll(cleanupCreatedProjects)

  test("문법대로 컨텐츠>기능>세부기능>작업을 생성한다", async ({ page }) => {
    const projectName = await setup(page)

    await addContentRoot(page, "전장")
    await expect(rowByTitle(page, "전장")).toBeVisible()
    await addChildSingle(page, "전장", "소환수기능")
    await expect(rowByTitle(page, "소환수기능")).toBeVisible()
    await addChildTyped(page, "소환수기능", "세부기능", "합성세부")
    await expect(rowByTitle(page, "합성세부")).toBeVisible()
    await addWork(page, "합성세부", "로직작업") // 작업은 트리 행 아님

    // 백엔드 검증: 노드 4개 + 타입 + 티켓 1..4
    const projs = await restGet<{ id: string }>(
      `project?name=eq.${encodeURIComponent(projectName)}&select=id`
    )
    const nodes = await restGet<{ type: string; ticket_number: number }>(
      `node?project_id=eq.${projs[0].id}&select=type,ticket_number`
    )
    expect(nodes).toHaveLength(4)
    expect(nodes.map((n) => n.type).sort()).toEqual(
      ["기능", "세부기능", "작업", "컨텐츠"].sort()
    )
    expect(nodes.map((n) => n.ticket_number).sort((a, b) => a - b)).toEqual([
      1, 2, 3, 4,
    ])
  })

  test("세부기능 펼침 = 작업이 트리 행이 아니라 임베드 패널에 표시", async ({
    page,
  }) => {
    await setup(page)
    await addContentRoot(page, "전장")
    await addChildSingle(page, "전장", "소환수기능")
    await addChildTyped(page, "소환수기능", "세부기능", "합성세부")
    await addWork(page, "합성세부", "로직작업")

    // 작업은 트리 행으로 없음
    await expect(rowByTitle(page, "로직작업")).toHaveCount(0)
    // 임베드 작업탭에 표시
    const embed = page.getByTestId("subfeature-embed")
    await expect(embed).toBeVisible()
    await embed.getByTestId("work-tab").click()
    await expect(
      embed.getByTestId("work-row").filter({ hasText: "로직작업" })
    ).toBeVisible()
  })

  test("접기/펼치기로 하위가 숨겨졌다 보인다", async ({ page }) => {
    await setup(page)
    await addContentRoot(page, "전장")
    await addChildSingle(page, "전장", "소환수기능")
    await expect(rowByTitle(page, "소환수기능")).toBeVisible()

    await rowByTitle(page, "전장").getByTestId("tree-toggle").click()
    await expect(rowByTitle(page, "소환수기능")).toHaveCount(0)
    await rowByTitle(page, "전장").getByTestId("tree-toggle").click()
    await expect(rowByTitle(page, "소환수기능")).toBeVisible()
  })

  test("이름 변경 — 더블클릭 인라인 편집", async ({ page }) => {
    await setup(page)
    await addContentRoot(page, "전장")
    await rowByTitle(page, "전장").getByTestId("node-title").dblclick()
    const input = page.getByTestId("rename-input")
    await input.fill("정비")
    await input.press("Enter")
    await expect(rowByTitle(page, "정비")).toBeVisible()
    await expect(rowByTitle(page, "전장")).toHaveCount(0)
  })

  test("이름 변경 — Esc 로 취소하면 원래 제목 유지", async ({ page }) => {
    await setup(page)
    await addContentRoot(page, "전장")
    await rowByTitle(page, "전장").getByTestId("node-title").dblclick()
    const input = page.getByTestId("rename-input")
    await input.fill("버려질이름")
    await input.press("Escape")
    await expect(rowByTitle(page, "전장")).toBeVisible()
    await expect(rowByTitle(page, "버려질이름")).toHaveCount(0)
  })

  test("삭제 — 하위 cascade confirm 후 트리 갱신", async ({ page }) => {
    await setup(page)
    await addContentRoot(page, "전장")
    await addChildSingle(page, "전장", "소환수기능")

    await rowByTitle(page, "전장").getByTestId("node-more").click()
    await page.getByTestId("delete-action").click()
    await expect(page.getByTestId("delete-message")).toContainText("하위 1개")
    await page.getByTestId("confirm-delete").click()

    await expect(rowByTitle(page, "전장")).toHaveCount(0)
    await expect(rowByTitle(page, "소환수기능")).toHaveCount(0)
    await expect(page.getByTestId("empty-state")).toBeVisible()
  })

  test("삭제 — 잎 노드는 하위 안내 없이 삭제", async ({ page }) => {
    await setup(page)
    await addContentRoot(page, "전장")
    await addChildSingle(page, "전장", "소환수기능")

    await rowByTitle(page, "소환수기능").getByTestId("node-more").click()
    await page.getByTestId("delete-action").click()
    await expect(page.getByTestId("delete-message")).not.toContainText("하위")
    await page.getByTestId("confirm-delete").click()

    await expect(rowByTitle(page, "소환수기능")).toHaveCount(0)
    await expect(rowByTitle(page, "전장")).toBeVisible()
  })

  test("진행바(null/0%/완료) + 작업 상태 뱃지(임베드)", async ({ page }) => {
    const projectName = await setup(page)
    await addContentRoot(page, "전장")
    await addChildSingle(page, "전장", "소환수기능")
    await addChildTyped(page, "소환수기능", "세부기능", "합성세부")
    await addWork(page, "합성세부", "로직작업")

    // 작업(임베드): 미지정 뱃지
    await expect(await embedWorkBadge(page, "로직작업")).toHaveAttribute(
      "data-status",
      "미지정"
    )

    // 비-잎: 작업 1개·완료 0 → 0%
    await expect(
      rowByTitle(page, "합성세부").getByTestId("node-progress")
    ).toHaveAttribute("data-progress", "0")
    await expect(
      rowByTitle(page, "전장").getByTestId("node-progress")
    ).toHaveAttribute("data-progress", "0")

    // 하위 작업 없는 컨텐츠 → 중립 "—"
    await addContentRoot(page, "정비")
    await expect(
      rowByTitle(page, "정비").getByTestId("node-progress")
    ).toHaveAttribute("data-progress", "none")

    // 작업 완료(REST) + 새로고침 → 세부기능 100% + 임베드 작업 완료 뱃지
    const projs = await restGet<{ id: string }>(
      `project?name=eq.${encodeURIComponent(projectName)}&select=id`
    )
    const doneStatus = await restGet<{ id: string }>(
      `status?project_id=eq.${projs[0].id}&category=eq.${encodeURIComponent("완료")}&select=id`
    )
    const tasks = await restGet<{ id: string }>(
      `node?project_id=eq.${projs[0].id}&type=eq.${encodeURIComponent("작업")}&select=id`
    )
    await restPatch(`node?id=eq.${tasks[0].id}`, { status_id: doneStatus[0].id })

    await page.reload()
    // 기본 접힘 → 경로 펼치기(전장 > 소환수기능 > 합성세부)
    await expand(page, "전장")
    await expand(page, "소환수기능")
    await expect(
      rowByTitle(page, "합성세부").getByTestId("node-progress")
    ).toHaveAttribute("data-progress", "100")
    await expand(page, "합성세부")
    await expect(await embedWorkBadge(page, "로직작업")).toHaveAttribute(
      "data-status",
      "완료"
    )
  })
})
