import { expect, type Page, type Locator } from "@playwright/test"
import { restDelete } from "../helpers/rest"

export const PASSWORD = "password123"

/**
 * 이 워커(스펙 파일)가 만든 프로젝트 이름들. afterAll 에서 정확히 이 프로젝트들만
 * 정리한다 → 시드(Tatica Defense)나 다른 스펙 프로젝트를 건드리지 않음(격리).
 */
export const createdProjects: string[] = []

export async function cleanupCreatedProjects() {
  for (const name of createdProjects.splice(0)) {
    await restDelete(`project?name=eq.${encodeURIComponent(name)}`)
  }
}

export function uniqueEmail(prefix = "e2e") {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e6)}@example.com`
}

export function rowByTitle(page: Page, title: string): Locator {
  return page.getByTestId("tree-node").filter({ hasText: title })
}

/** 가입 → 인증 셸 진입. 생성된 이메일 반환(현재 유저 식별용). */
export async function signupAndEnter(page: Page): Promise<string> {
  const email = uniqueEmail()
  await page.goto("/")
  await page.getByTestId("toggle-mode").click()
  await page.getByTestId("email-input").fill(email)
  await page.getByTestId("password-input").fill(PASSWORD)
  await page.getByTestId("submit-button").click()
  await expect(page.getByTestId("app-shell")).toBeVisible()
  return email
}

/**
 * 프로젝트 생성 → 현재 프로젝트로. 이름 반환.
 * 빈 DB(NoProjects)면 첫 프로젝트 버튼, 이미 프로젝트가 있으면 스위처의 새 프로젝트.
 * → 시드/다른 프로젝트가 있어도 동작(격리). 생성 이름은 cleanup 추적에 등록.
 */
export async function createProject(
  page: Page,
  name: string,
  prefix: string
): Promise<string> {
  const firstBtn = page.getByTestId("create-first-project")
  // 안정 상태까지 대기: NoProjects(첫 프로젝트 버튼) 또는 로드된 현재 프로젝트.
  // (로딩 중 EdgeShell 의 스위처를 누르면 ProjectWorkspace 로 교체되며 드롭다운이 닫혀 경합)
  const current = page.getByTestId("current-project-name")
  await expect(firstBtn.or(current)).toBeVisible()
  if (await firstBtn.count()) {
    await firstBtn.click()
  } else {
    await page.getByTestId("project-switcher").click()
    await page.getByTestId("new-project-button").click()
  }
  await page.getByTestId("project-name-input").fill(name)
  await page.getByTestId("project-prefix-input").fill(prefix)
  await page.getByTestId("create-project-submit").click()
  await expect(page.getByTestId("current-project-name")).toHaveText(name)
  createdProjects.push(name)
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
