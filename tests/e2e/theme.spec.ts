import { test, expect, type Page } from "@playwright/test"
import { cleanupCreatedProjects, createProject, signupAndEnter } from "./_helpers"

/** 다크모드 — 라이트/다크/시스템 토글, 기억(localStorage), 첫 페인트 적용, 다크 렌더 스모크. */

const isDark = (page: Page) =>
  page.evaluate(() => document.documentElement.classList.contains("dark"))
const bodyBg = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor)

async function pick(page: Page, value: "light" | "dark" | "system") {
  await page.getByTestId("theme-toggle").click()
  await page.getByTestId(`theme-option-${value}`).click()
}

test.describe.serial("테마(다크모드)", () => {
  test.afterAll(cleanupCreatedProjects)

  test("토글: 다크 → 기억되고 새로고침 첫 페인트부터 다크, 라이트로 복귀", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" })
    await signupAndEnter(page)
    await createProject(page, `테마 ${Date.now()}`)

    // 기본 = 시스템(라이트 환경) → 라이트
    await expect(page.getByTestId("theme-toggle")).toHaveAttribute("data-theme", "system")
    expect(await isDark(page)).toBe(false)
    const lightBg = await bodyBg(page)

    await pick(page, "dark")
    await expect.poll(() => isDark(page)).toBe(true)
    expect(await page.evaluate(() => localStorage.getItem("canopy.theme"))).toBe("dark")
    await expect.poll(() => bodyBg(page)).not.toBe(lightBg)

    // 새로고침: 앱 스크립트 실행 전(DOMContentLoaded 시점)에 이미 .dark — 깜빡임 없음
    await page.reload({ waitUntil: "commit" })
    const earlyDark = await page.evaluate(
      () =>
        new Promise<boolean>((res) => {
          if (document.readyState !== "loading")
            res(document.documentElement.classList.contains("dark"))
          else
            document.addEventListener("DOMContentLoaded", () =>
              res(document.documentElement.classList.contains("dark"))
            )
        })
    )
    expect(earlyDark).toBe(true)

    await pick(page, "light")
    await expect.poll(() => isDark(page)).toBe(false)
  })

  test("시스템: OS 다크면 다크, 라이트면 라이트", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" })
    await signupAndEnter(page)
    await createProject(page, `테마2 ${Date.now()}`)
    await expect.poll(() => isDark(page)).toBe(true)
    await page.emulateMedia({ colorScheme: "light" })
    await expect.poll(() => isDark(page)).toBe(false)
  })

  test("다크 렌더 스모크: 트리·보드·대시보드 주요 표면이 다크 토큰", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" })
    await signupAndEnter(page)
    await createProject(page, `테마3 ${Date.now()}`)
    await pick(page, "dark")
    for (const tab of ["view-tab-tree", "view-tab-board", "view-tab-dashboard"]) {
      await page.getByTestId(tab).click()
      // 헤더 표면 = 다크 surface (#1d2027 → rgb(29, 32, 39))
      await expect
        .poll(() =>
          page.getByTestId("app-shell").evaluate((el) => getComputedStyle(el).backgroundColor)
        )
        .toBe("rgb(29, 32, 39)")
    }
  })
})
