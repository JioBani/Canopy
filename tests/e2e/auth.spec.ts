import { test, expect } from "@playwright/test"
import {
  cleanupCreatedProjects,
  createProject,
  signupAndEnter,
} from "./_helpers"

/**
 * 진입 플로우 (팀 내부용 — 로그인 게이트 제거).
 * 로그인 없이 바로 앱 셸에 진입하고 anon 으로 DB 에 접근할 수 있어야 한다.
 */
test.afterAll(cleanupCreatedProjects)

test("로그인 없이 앱 셸에 바로 진입한다", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByTestId("app-shell")).toBeVisible()
  // 로그인 폼은 뜨지 않는다
  await expect(page.getByTestId("auth-form")).toHaveCount(0)
})

test("anon 으로 프로젝트 생성/조회가 된다(DB 접근 허용)", async ({ page }) => {
  await signupAndEnter(page) // 로그인 없이 진입
  // anon RLS 허용 + 기본 상태 트리거 동작 확인
  await createProject(page, `anon 진입 ${Date.now()}`)
  await expect(page.getByTestId("current-project-name")).toBeVisible()
})
