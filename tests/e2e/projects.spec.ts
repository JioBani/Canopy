import { test, expect } from "@playwright/test"
import { restGet } from "../helpers/rest"
import {
  cleanupCreatedProjects,
  createProject,
  signupAndEnter,
} from "./_helpers"

/**
 * 프로젝트 생성/전환 E2E (로컬 Supabase 대상).
 * 격리: 각 테스트가 고유 이름 프로젝트를 만들고 afterAll 에서 그것만 정리한다.
 * (전역 wipe 안 함 → 시드/다른 스펙 프로젝트 보존)
 *
 * 참고: "프로젝트 0개일 때 NoProjects 빈 상태" 는 RLS 가 프로젝트를 전체 공유하므로
 * DB 가 비어야만 재현된다(시드 공존 불가) → 격리 위해 해당 전역 의존 테스트는 제외.
 * createProject 헬퍼가 빈 DB/스위처 양쪽 진입을 모두 커버한다.
 */
test.describe.serial("프로젝트 생성/전환", () => {
  test.afterAll(cleanupCreatedProjects)

  test("생성 → 스위처에 표시, 빈 컨텐츠 상태, 상태 4개만 시드(중복 없음)", async ({
    page,
  }) => {
    await signupAndEnter(page)
    const name = `생성테스트 ${Date.now()}`
    // 키 프리픽스는 소문자/기호 입력해도 대문자 영숫자로 정규화돼야 함
    await createProject(page, name, "td-1")

    await expect(page.getByTestId("empty-state")).toBeVisible()
    await expect(page.getByText("첫 컨텐츠를 추가")).toBeVisible()

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

    await createProject(page, a, "AAA")
    await createProject(page, b, "BBB")
    // 마지막 생성(B)이 현재 프로젝트
    await expect(page.getByTestId("current-project-name")).toHaveText(b)

    // A 로 전환
    await page.getByTestId("project-switcher").click()
    await page.getByTestId("project-option").filter({ hasText: a }).click()
    await expect(page.getByTestId("current-project-name")).toHaveText(a)

    // 새로고침 후에도 A 유지 (localStorage 지속)
    await page.reload()
    await expect(page.getByTestId("current-project-name")).toHaveText(a)
  })
})
