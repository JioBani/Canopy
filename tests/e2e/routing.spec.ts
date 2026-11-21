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
 * URL 라우팅 — 상태(프로젝트·화면·선택 노드·보조 상태)가 URL 에 실리고,
 * 그 URL 로 열면 같은 상태가 복원되며, 뒤로/앞으로가 동작하고, 잘못된 id 는 안전하게 폴백.
 */

const path = (page: Page) => decodeURIComponent(new URL(page.url()).pathname)
const query = (page: Page) => new URL(page.url()).searchParams
const detail = (page: Page) => page.getByTestId("node-detail")

let projectId = ""

test.describe.serial("URL 라우팅", () => {
  test.afterAll(cleanupCreatedProjects)

  test("진입·선택·화면 전환이 URL 에 반영되고 뒤로/앞으로가 동작", async ({ page }) => {
    await signupAndEnter(page)
    const name = await createProject(page, `라우팅 ${Date.now()}`)
    const projs = await restGet<{ id: string }>(
      `project?name=eq.${encodeURIComponent(name)}&select=id`
    )
    projectId = projs[0].id

    await expect.poll(() => path(page)).toBe(`/p/${projectId}/tree`)

    await addContentRoot(page, "전장")
    await addChildSingle(page, "전장", "소환수기능")
    await addChildTyped(page, "소환수기능", "세부기능", "합성세부")
    await addWork(page, "합성세부", "합성로직")

    // 노드 선택 → 티켓키 경로
    await rowByTitle(page, "전장").click()
    await expect.poll(() => path(page)).toMatch(new RegExp(`^/p/${projectId}/tree/Content-\\d+$`))
    const contentPath = path(page)

    await rowByTitle(page, "합성세부").click()
    await expect.poll(() => path(page)).toMatch(/\/tree\/SubFeature-\d+$/)
    const subPath = path(page)

    // 화면 전환
    await page.getByTestId("view-tab-board").click()
    await expect.poll(() => path(page)).toBe(`/p/${projectId}/board`)

    // 뒤로 → 세부기능, 다시 뒤로 → 컨텐츠, 앞으로 → 세부기능
    await page.goBack()
    await expect.poll(() => path(page)).toBe(subPath)
    await expect(detail(page).getByTestId("detail-title")).toHaveValue("합성세부")
    await page.goBack()
    await expect.poll(() => path(page)).toBe(contentPath)
    await expect(detail(page).getByTestId("detail-title")).toHaveValue("전장")
    await page.goForward()
    await expect(detail(page).getByTestId("detail-title")).toHaveValue("합성세부")

    // 보드 → 트리 탭 복귀 시 마지막 선택 유지
    await page.getByTestId("view-tab-board").click()
    await page.getByTestId("view-tab-tree").click()
    await expect.poll(() => path(page)).toBe(subPath)
  })

  test("딥링크로 새 페이지를 열면 같은 노드·펼친 요구사항이 복원", async ({ page }) => {
    const subs = await restGet<{ id: string; ticket_number: number }>(
      `node?project_id=eq.${projectId}&type=eq.${encodeURIComponent("세부기능")}&select=id,ticket_number`
    )
    await restPost("ur", {
      feature_id: subs[0].id,
      text: "링크로 펼칠 요구사항",
      status: "미구현",
    })
    const urs = await restGet<{ ticket_number: number }>(
      `ur?feature_id=eq.${subs[0].id}&select=ticket_number`
    )
    const urKey = `Requirement-${urs[0].ticket_number}`
    const subKey = `SubFeature-${subs[0].ticket_number}`

    await page.goto(`/p/${projectId}/tree/${subKey}?ur=${urKey}`)
    await expect(detail(page).getByTestId("detail-title")).toHaveValue("합성세부")
    await expect(page.getByTestId("ur-detail")).toBeVisible()
    await expect(page.getByTestId("ur-detail")).toHaveCount(1)
    // 조상 자동 펼침 → 트리에서 세부기능 행이 보인다
    await expect(rowByTitle(page, "합성세부")).toBeVisible()

    // 펼침 해제 → query 제거(replace)
    await page.getByTestId("ur-row-header").filter({ hasText: "링크로 펼칠 요구사항" }).click()
    await expect.poll(() => query(page).get("ur")).toBeNull()

    // 새로고침해도 같은 노드
    await page.reload()
    await expect(detail(page).getByTestId("detail-title")).toHaveValue("합성세부")
  })

  test("보드 필터가 URL query 로 공유된다", async ({ page }) => {
    await page.goto(`/p/${projectId}/board?layer=${encodeURIComponent("요구사항")}`)
    await expect(page.getByTestId("ur-board")).toBeVisible()
    await page.getByTestId("board-layer-작업").click()
    await expect.poll(() => query(page).get("layer")).toBeNull()
    await expect(page.getByTestId("board-view")).toBeVisible()
  })

  test("잘못된 노드·프로젝트 id 는 안내 후 안전한 위치로 폴백", async ({ page }) => {
    await page.goto(`/p/${projectId}/tree/Task-999999`)
    await expect.poll(() => path(page)).toBe(`/p/${projectId}/tree`)
    await expect(page.getByText("링크의 항목(Task-999999)을 찾을 수 없습니다")).toBeVisible()

    await page.goto(`/p/00000000-0000-0000-0000-000000000000/board`)
    await expect.poll(() => path(page)).toMatch(/^\/p\/[0-9a-f-]{36}\/tree$/)
    await expect(page.getByText("링크의 프로젝트를 찾을 수 없습니다")).toBeVisible()
    await expect(page.getByTestId("app-shell")).toBeVisible()
  })

  test("링크 복사 버튼은 현재 URL 을 복사한다", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"])
    await page.goto(`/p/${projectId}/tree`)
    await rowByTitle(page, "전장").click()
    await page.getByTestId("copy-link").click()
    const copied = await page.evaluate(() => navigator.clipboard.readText())
    expect(new URL(copied).pathname).toBe(path(page))
  })
})
