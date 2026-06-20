import { test, expect } from "@playwright/test"
import {
  addChildSingle,
  addContentRoot,
  cleanupCreatedProjects,
  createProject,
  rowByTitle,
  signupAndEnter,
} from "./_helpers"

test.describe.serial("반응형 레이아웃", () => {
  test.afterAll(cleanupCreatedProjects)

  test("모바일(<768px): 트리↔상세 단일 패널 토글", async ({ page }) => {
    // 트리 구성은 데스크탑 뷰포트(기본)에서 — 모바일은 생성 시 상세로 전환되므로.
    await signupAndEnter(page)
    await createProject(page, `반응형 ${Date.now()}`)
    await addContentRoot(page, "전장")
    await addChildSingle(page, "전장", "소환수기능")

    // 데스크탑: 트리+상세 분할(둘 다 표시), 리사이저 존재
    await expect(page.getByTestId("tree-panel")).toBeVisible()
    await expect(page.getByTestId("sidebar-resize")).toBeVisible()

    // 모바일 전환 → 단일 패널. 선택 노드(소환수기능) 있어 상세 + '트리로' 버튼.
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.getByTestId("mobile-back-tree")).toBeVisible()
    await expect(page.getByTestId("node-detail")).toBeVisible()
    await expect(page.getByTestId("sidebar-resize")).toHaveCount(0) // 리사이저 없음
    await expect(page.getByTestId("tree-panel")).toBeHidden()

    // '트리로' → 트리 표시, 상세 숨김
    await page.getByTestId("mobile-back-tree").click()
    await expect(page.getByTestId("tree-panel")).toBeVisible()
    await expect(page.getByTestId("node-detail")).toBeHidden()

    // 트리 행 클릭 → 상세 단일 패널 복귀
    await rowByTitle(page, "전장").click()
    await expect(page.getByTestId("node-detail")).toBeVisible()
    await expect(page.getByTestId("detail-title")).toHaveValue("전장")
  })

  test("데스크탑(≥768px): 트리+상세 동시 표시(분할 유지)", async ({ page }) => {
    await signupAndEnter(page)
    await createProject(page, `반응형2 ${Date.now()}`)
    await addContentRoot(page, "전장")

    // 기본 데스크탑 뷰포트: 트리와 상세가 함께
    await expect(page.getByTestId("tree-panel")).toBeVisible()
    await rowByTitle(page, "전장").click()
    await expect(page.getByTestId("node-detail")).toBeVisible()
    await expect(page.getByTestId("tree-panel")).toBeVisible() // 동시 표시
    await expect(page.getByTestId("mobile-back-tree")).toHaveCount(0)
  })
})
