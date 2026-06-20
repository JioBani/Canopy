import { test, expect, type Page } from "@playwright/test"
import { restGet, wipeAllProjects } from "../helpers/rest"

/**
 * 프로젝트 생성/전환 E2E (로컬 Supabase 대상).
 * 프로젝트는 RLS 상 전체 공유(내부용)이므로 DB 에 누적된다 → beforeEach 로 클린 슬레이트.
 */
const PASSWORD = "password123"
function uniqueEmail() {
  return `e2e_proj_${Date.now()}_${Math.floor(Math.random() * 1e6)}@example.com`
}

async function signupAndEnter(page: Page) {
  await page.goto("/")
  await page.getByTestId("toggle-mode").click()
  await page.getByTestId("email-input").fill(uniqueEmail())
  await page.getByTestId("password-input").fill(PASSWORD)
  await page.getByTestId("submit-button").click()
  await expect(page.getByTestId("app-shell")).toBeVisible()
}

async function createViaDialog(page: Page, name: string, prefixTyped: string) {
  await page.getByTestId("project-name-input").fill(name)
  await page.getByTestId("project-prefix-input").fill(prefixTyped)
  await page.getByTestId("create-project-submit").click()
  await expect(page.getByTestId("current-project-name")).toHaveText(name)
}

test.describe.serial("프로젝트 생성/전환", () => {
  test.beforeEach(async () => {
    await wipeAllProjects()
  })

  test("프로젝트가 없으면 빈 상태(새 프로젝트 만들기)를 보여준다", async ({
    page,
  }) => {
    await signupAndEnter(page)
    await expect(page.getByTestId("no-projects")).toBeVisible()
    await expect(page.getByTestId("create-first-project")).toBeVisible()
  })

  test("모달로 생성 → 스위처에 표시, 빈 컨텐츠 상태, 상태 4개만 시드(중복 없음)", async ({
    page,
  }) => {
    await signupAndEnter(page)
    const name = `생성테스트 ${Date.now()}`

    await page.getByTestId("create-first-project").click()
    // 키 프리픽스는 소문자/기호 입력해도 대문자 영숫자로 정규화돼야 함
    await createViaDialog(page, name, "td-1")

    // 빈 컨텐츠 상태 노출
    await expect(page.getByTestId("empty-state")).toBeVisible()
    await expect(page.getByText("첫 컨텐츠를 추가")).toBeVisible()

    // 백엔드 검증: key_prefix 정규화 + 기본상태 정확히 4개(프론트 중복시드 없음)
    const projs = await restGet<{ id: string; key_prefix: string }>(
      `project?name=eq.${encodeURIComponent(name)}&select=id,key_prefix`
    )
    expect(projs).toHaveLength(1)
    expect(projs[0].key_prefix).toBe("TD1")
    const statuses = await restGet<{ id: string }>(
      `status?project_id=eq.${projs[0].id}&select=id`
    )
    expect(statuses).toHaveLength(4)
  })

  test("두 프로젝트 생성 → 전환 → 새로고침 후에도 현재 프로젝트 유지", async ({
    page,
  }) => {
    await signupAndEnter(page)
    const a = `프로젝트A ${Date.now()}`
    const b = `프로젝트B ${Date.now()}`

    // A 생성 (빈 상태 버튼)
    await page.getByTestId("create-first-project").click()
    await createViaDialog(page, a, "AAA")

    // B 생성 (스위처의 새 프로젝트)
    await page.getByTestId("project-switcher").click()
    await page.getByTestId("new-project-button").click()
    await createViaDialog(page, b, "BBB")
    // 생성 직후 현재는 B
    await expect(page.getByTestId("current-project-name")).toHaveText(b)

    // A 로 전환
    await page.getByTestId("project-switcher").click()
    await page
      .getByTestId("project-option")
      .filter({ hasText: a })
      .click()
    await expect(page.getByTestId("current-project-name")).toHaveText(a)

    // 새로고침 후에도 A 유지 (localStorage 지속)
    await page.reload()
    await expect(page.getByTestId("current-project-name")).toHaveText(a)
  })
})
