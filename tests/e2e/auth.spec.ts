import { test, expect } from "@playwright/test"

/**
 * 인증 플로우 E2E (로컬 Supabase 대상).
 * 가입 → 인증 셸 진입 → 로그아웃 → 재로그인.
 * 구글 OAuth 는 배포용으로 미뤘으므로 개발용 이메일/비밀번호 경로를 검증한다.
 */

function uniqueEmail() {
  return `e2e_${Date.now()}_${Math.floor(Math.random() * 1e6)}@example.com`
}
const PASSWORD = "password123"

test("비로그인 시 로그인 폼이 보인다", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByTestId("auth-form")).toBeVisible()
  await expect(page.getByTestId("app-shell")).toHaveCount(0)
})

test("회원가입 → 인증 셸 진입 → 로그아웃 → 재로그인", async ({ page }) => {
  const email = uniqueEmail()
  await page.goto("/")

  // 1. 회원가입 모드로 전환
  await page.getByTestId("toggle-mode").click()
  await page.getByTestId("email-input").fill(email)
  await page.getByTestId("password-input").fill(PASSWORD)
  await page.getByTestId("submit-button").click()

  // 2. 가입 즉시(이메일 확인 off) 인증 셸 진입 + 이메일 표시
  await expect(page.getByTestId("app-shell")).toBeVisible()
  await expect(page.getByTestId("user-email")).toHaveText(email)

  // 3. 로그아웃 → 로그인 폼 복귀
  await page.getByTestId("logout-button").click()
  await expect(page.getByTestId("auth-form")).toBeVisible()

  // 4. 같은 계정으로 재로그인 (login 모드 기본)
  await page.getByTestId("email-input").fill(email)
  await page.getByTestId("password-input").fill(PASSWORD)
  await page.getByTestId("submit-button").click()
  await expect(page.getByTestId("app-shell")).toBeVisible()
  await expect(page.getByTestId("user-email")).toHaveText(email)
})

test("잘못된 비밀번호로 로그인하면 에러를 보여준다", async ({ page }) => {
  const email = uniqueEmail()
  await page.goto("/")

  // 먼저 가입해 계정 생성 후 로그아웃
  await page.getByTestId("toggle-mode").click()
  await page.getByTestId("email-input").fill(email)
  await page.getByTestId("password-input").fill(PASSWORD)
  await page.getByTestId("submit-button").click()
  await expect(page.getByTestId("app-shell")).toBeVisible()
  await page.getByTestId("logout-button").click()
  await expect(page.getByTestId("auth-form")).toBeVisible()

  // 틀린 비밀번호로 로그인 시도 → 에러 표시, 셸 진입 안 함
  await page.getByTestId("email-input").fill(email)
  await page.getByTestId("password-input").fill("wrong-password")
  await page.getByTestId("submit-button").click()
  await expect(page.getByTestId("auth-error")).toBeVisible()
  await expect(page.getByTestId("app-shell")).toHaveCount(0)
})
