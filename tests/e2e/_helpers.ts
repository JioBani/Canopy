import { expect, type Page, type Locator } from "@playwright/test"

export const PASSWORD = "password123"

export function uniqueEmail(prefix = "e2e") {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e6)}@example.com`
}

export function rowByTitle(page: Page, title: string): Locator {
  return page.getByTestId("tree-node").filter({ hasText: title })
}

/** 가입 → 인증 셸 진입. */
export async function signupAndEnter(page: Page) {
  await page.goto("/")
  await page.getByTestId("toggle-mode").click()
  await page.getByTestId("email-input").fill(uniqueEmail())
  await page.getByTestId("password-input").fill(PASSWORD)
  await page.getByTestId("submit-button").click()
  await expect(page.getByTestId("app-shell")).toBeVisible()
}

/** 프로젝트 생성 → 현재 프로젝트로. 이름 반환. */
export async function createProject(
  page: Page,
  name: string,
  prefix: string
): Promise<string> {
  await page.getByTestId("create-first-project").click()
  await page.getByTestId("project-name-input").fill(name)
  await page.getByTestId("project-prefix-input").fill(prefix)
  await page.getByTestId("create-project-submit").click()
  await expect(page.getByTestId("current-project-name")).toHaveText(name)
  return name
}

/** 루트 컨텐츠 추가 (빈 트리/비어있지 않은 트리 모두). */
export async function addContentRoot(page: Page, title: string) {
  const firstBtn = page.getByTestId("add-first-content")
  const rootBtn = page.getByTestId("root-add")
  await expect(firstBtn.or(rootBtn)).toBeVisible()
  if (await firstBtn.count()) await firstBtn.click()
  else await rootBtn.click()
  const input = page.getByTestId("inline-add-input")
  await input.fill(title)
  await input.press("Enter")
  await expect(rowByTitle(page, title)).toBeVisible()
  await input.press("Escape")
  await expect(input).toHaveCount(0)
}

/** 허용 자식타입이 1종인 부모에 인라인 추가. */
export async function addChildSingle(
  page: Page,
  parentTitle: string,
  title: string
) {
  await rowByTitle(page, parentTitle).getByTestId("node-add").click()
  const input = page.getByTestId("inline-add-input")
  await input.fill(title)
  await input.press("Enter")
  await expect(rowByTitle(page, title)).toBeVisible()
  await input.press("Escape")
  await expect(input).toHaveCount(0)
}

/** 허용 자식타입이 여러 종인 부모(예: 기능)에 타입 선택 후 추가. */
export async function addChildTyped(
  page: Page,
  parentTitle: string,
  typeLabel: string,
  title: string
) {
  await rowByTitle(page, parentTitle).getByTestId("node-add").click()
  await page.getByTestId("add-type-option").filter({ hasText: typeLabel }).click()
  const input = page.getByTestId("inline-add-input")
  await input.fill(title)
  await input.press("Enter")
  await expect(rowByTitle(page, title)).toBeVisible()
  await input.press("Escape")
  await expect(input).toHaveCount(0)
}
