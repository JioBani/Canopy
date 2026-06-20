import { test, expect, type Page } from "@playwright/test"
import { restGet, restPatch } from "../helpers/rest"
import {
  addContentRoot,
  addChildSingle,
  cleanupCreatedProjects,
  createProject,
  rowByTitle,
  signupAndEnter,
} from "./_helpers"

/**
 * 노드 트리 CRUD — 단계 1(렌더) + 2(인라인 생성) 검증.
 * 문법상 허용된 자식 타입만 추가 가능, 접기/펼치기.
 */
async function setup(page: Page): Promise<string> {
  await signupAndEnter(page)
  return createProject(page, `트리테스트 ${Date.now()}`, "TR")
}

test.describe.serial("노드 트리", () => {
  test.afterAll(cleanupCreatedProjects)

  test("문법대로 컨텐츠>기능>세부기능>작업을 인라인 생성한다", async ({
    page,
  }) => {
    const projectName = await setup(page)

    // 컨텐츠 (최상위)
    await addContentRoot(page, "전장")
    await expect(rowByTitle(page, "전장")).toBeVisible()

    // 컨텐츠 → 기능 (허용 1종, 바로 입력)
    await addChildSingle(page, "전장", "소환수기능")
    await expect(rowByTitle(page, "소환수기능")).toBeVisible()

    // 기능 → (세부기능|마스터데이터): 드롭다운에서 세부기능 선택
    await rowByTitle(page, "소환수기능").getByTestId("node-add").click()
    await page
      .getByTestId("add-type-option")
      .filter({ hasText: "세부기능" })
      .click()
    {
      const input = page.getByTestId("inline-add-input")
      await input.fill("합성세부")
      await input.press("Enter")
      await expect(rowByTitle(page, "합성세부")).toBeVisible()
      await input.press("Escape")
      await expect(input).toHaveCount(0)
    }

    // 세부기능 → 작업 (허용 1종)
    await addChildSingle(page, "합성세부", "로직작업")
    await expect(rowByTitle(page, "로직작업")).toBeVisible()

    // 백엔드 검증: 노드 4개 + 타입 구성
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
    // 티켓번호는 1..4 발급
    expect(nodes.map((n) => n.ticket_number).sort((a, b) => a - b)).toEqual([
      1, 2, 3, 4,
    ])
  })

  test("잎(작업)에는 자식 추가 버튼이 없다", async ({ page }) => {
    await setup(page)
    await addContentRoot(page, "전장")
    await addChildSingle(page, "전장", "소환수기능")
    await rowByTitle(page, "소환수기능").getByTestId("node-add").click()
    await page
      .getByTestId("add-type-option")
      .filter({ hasText: "세부기능" })
      .click()
    {
      const input = page.getByTestId("inline-add-input")
      await input.fill("합성세부")
      await input.press("Enter")
      await expect(rowByTitle(page, "합성세부")).toBeVisible()
      await input.press("Escape")
      await expect(input).toHaveCount(0)
    }
    await addChildSingle(page, "합성세부", "로직작업")

    // 작업 행에는 node-add 가 없어야 함
    await expect(
      rowByTitle(page, "로직작업").getByTestId("node-add")
    ).toHaveCount(0)
  })

  test("접기/펼치기로 하위가 숨겨졌다 보인다", async ({ page }) => {
    await setup(page)
    await addContentRoot(page, "전장")
    await addChildSingle(page, "전장", "소환수기능")
    await expect(rowByTitle(page, "소환수기능")).toBeVisible()

    // 접기 → 자식 숨김
    await rowByTitle(page, "전장").getByTestId("tree-toggle").click()
    await expect(rowByTitle(page, "소환수기능")).toHaveCount(0)

    // 펼치기 → 다시 보임
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

    // 컨텐츠+하위 모두 사라지고 빈 상태로
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
    // 부모(전장)는 유지
    await expect(rowByTitle(page, "전장")).toBeVisible()
  })

  test("진행바·상태뱃지 렌더 (null/0%/완료) + 작업 상태 뱃지", async ({
    page,
  }) => {
    const projectName = await setup(page)

    // 전장 > 소환수기능 > 합성세부 > 로직작업 (작업 상태 미지정)
    await addContentRoot(page, "전장")
    await addChildSingle(page, "전장", "소환수기능")
    await rowByTitle(page, "소환수기능").getByTestId("node-add").click()
    await page
      .getByTestId("add-type-option")
      .filter({ hasText: "세부기능" })
      .click()
    {
      const input = page.getByTestId("inline-add-input")
      await input.fill("합성세부")
      await input.press("Enter")
      await expect(rowByTitle(page, "합성세부")).toBeVisible()
      await input.press("Escape")
      await expect(input).toHaveCount(0)
    }
    await addChildSingle(page, "합성세부", "로직작업")

    // 작업: 미지정 뱃지
    await expect(
      rowByTitle(page, "로직작업").getByTestId("status-badge")
    ).toHaveAttribute("data-status", "미지정")

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

    // 작업 상태를 '완료'로 (REST) 후 새로고침 → 100% + 완료 뱃지
    const projs = await restGet<{ id: string }>(
      `project?name=eq.${encodeURIComponent(projectName)}&select=id`
    )
    const doneStatus = await restGet<{ id: string }>(
      `status?project_id=eq.${projs[0].id}&category=eq.${encodeURIComponent("완료")}&select=id`
    )
    const tasks = await restGet<{ id: string }>(
      `node?project_id=eq.${projs[0].id}&type=eq.${encodeURIComponent("작업")}&select=id`
    )
    await restPatch(`node?id=eq.${tasks[0].id}`, {
      status_id: doneStatus[0].id,
    })

    await page.reload()
    await expect(
      rowByTitle(page, "합성세부").getByTestId("node-progress")
    ).toHaveAttribute("data-progress", "100")
    await expect(
      rowByTitle(page, "로직작업").getByTestId("status-badge")
    ).toHaveAttribute("data-status", "완료")
  })
})
