import { test, expect, type Page } from "@playwright/test"
import { restGet } from "../helpers/rest"
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

function detail(page: Page) {
  return page.getByTestId("node-detail")
}

test.describe.serial("상세 드릴다운 + 작업 독립 생성", () => {
  test.afterAll(cleanupCreatedProjects)

  test("비-잎 노드 상세에서 자식 네비로 계층을 파고든다", async ({ page }) => {
    await signupAndEnter(page)
    await createProject(page, `드릴다운 ${Date.now()}`, "DR")

    await addContentRoot(page, "전장")
    await addChildSingle(page, "전장", "소환수기능")
    await addChildTyped(page, "소환수기능", "세부기능", "합성세부")

    // 컨텐츠 선택 → 하위 기능 네비
    await rowByTitle(page, "전장").click()
    const featureRow = detail(page)
      .getByTestId("child-nav-row")
      .filter({ hasText: "소환수기능" })
    await expect(featureRow).toBeVisible()
    await featureRow.click()
    await expect(detail(page).getByTestId("detail-title")).toHaveValue(
      "소환수기능"
    )

    // 기능 선택 → 하위 세부기능 네비 → 세부기능 상세(UR/작업 섹션)
    const subRow = detail(page)
      .getByTestId("child-nav-row")
      .filter({ hasText: "합성세부" })
    await expect(subRow).toBeVisible()
    await subRow.click()
    await expect(detail(page).getByTestId("detail-title")).toHaveValue(
      "합성세부"
    )
    await expect(detail(page).getByTestId("subfeature-sections")).toBeVisible()
  })

  test("작업 탭에서 작업을 UR 무관하게 직접 생성한다", async ({ page }) => {
    await signupAndEnter(page)
    const projectName = await createProject(page, `작업생성 ${Date.now()}`, "WC")

    await addContentRoot(page, "전장")
    await addChildSingle(page, "전장", "소환수기능")
    await addChildTyped(page, "소환수기능", "세부기능", "합성세부")

    // 세부기능 상세 → 작업 탭 → 작업 추가(특정 UR 종속 없음)
    await rowByTitle(page, "합성세부").click()
    await detail(page).getByTestId("work-tab").click()
    await detail(page).getByTestId("add-work").click()
    await detail(page).getByTestId("add-work-input").fill("독립작업")
    await detail(page).getByTestId("add-work-input").press("Enter")

    // 생성 직후 새 작업이 선택됨(상세 전환) + UR 무관 생성 → 연결 UR 0
    await expect(detail(page).getByTestId("detail-type")).toHaveText("작업")
    await expect(detail(page).getByTestId("detail-title")).toHaveValue("독립작업")
    await expect(detail(page).getByTestId("task-ur-links")).toContainText(
      "연결된 UR"
    )

    // REST: 작업의 부모 = 세부기능, ur_work_link 0개
    const projs = await restGet<{ id: string }>(
      `project?name=eq.${encodeURIComponent(projectName)}&select=id`
    )
    const subs = await restGet<{ id: string }>(
      `node?project_id=eq.${projs[0].id}&type=eq.${encodeURIComponent("세부기능")}&select=id`
    )
    const works = await restGet<{ id: string; parent_id: string }>(
      `node?project_id=eq.${projs[0].id}&type=eq.${encodeURIComponent("작업")}&select=id,parent_id`
    )
    expect(works).toHaveLength(1)
    expect(works[0].parent_id).toBe(subs[0].id)
    const links = await restGet<{ id: string }>(
      `ur_work_link?work_id=eq.${works[0].id}&select=id`
    )
    expect(links).toHaveLength(0)
  })

  test("세부기능 작업 리스트 행 클릭 → 작업 상세 페이지(세로 구성)", async ({
    page,
  }) => {
    await signupAndEnter(page)
    await createProject(page, `작업드릴 ${Date.now()}`, "WD")

    await addContentRoot(page, "전장")
    await addChildSingle(page, "전장", "소환수기능")
    await addChildTyped(page, "소환수기능", "세부기능", "합성세부")
    await addWork(page, "합성세부", "합성로직") // 생성 → 작업 선택됨

    // 세부기능으로 돌아가 작업 탭의 리스트(컴팩트) 확인
    await rowByTitle(page, "합성세부").click()
    await detail(page).getByTestId("work-tab").click()
    const workRow = detail(page)
      .getByTestId("work-row")
      .filter({ hasText: "합성로직" })
    await expect(workRow).toBeVisible()

    // 행 클릭 → 작업 상세 페이지 진입(드릴다운)
    await workRow.click()
    await expect(detail(page).getByTestId("detail-type")).toHaveText("작업")
    await expect(detail(page).getByTestId("detail-title")).toHaveValue("합성로직")

    // 작업 상세 = 작업내용 + 연결 요구사항 (세로 스택, 둘 다 노출)
    await expect(detail(page).getByTestId("task-checklist")).toBeVisible()
    await expect(detail(page).getByTestId("task-ur-links")).toBeVisible()
  })

  test("커버 헤더: 레이어 칩 + 티켓키 + 브레드크럼 드릴업", async ({ page }) => {
    await signupAndEnter(page)
    await createProject(page, `커버 ${Date.now()}`, "CV")

    await addContentRoot(page, "전장")
    await addChildSingle(page, "전장", "소환수기능")
    await addChildTyped(page, "소환수기능", "세부기능", "합성세부")

    await rowByTitle(page, "합성세부").click()
    const d = detail(page)
    // 커버: 레이어 = 세부기능, 타입 기반 티켓키
    await expect(d.getByTestId("cover-header")).toHaveAttribute(
      "data-layer",
      "세부기능"
    )
    await expect(d.getByTestId("detail-type")).toHaveText("세부기능")
    await expect(d.getByTestId("detail-ticket")).toContainText("SubFeature-")

    // 브레드크럼 세그먼트 클릭 → 조상으로 드릴업(점프)
    const seg = d.getByTestId("breadcrumb-seg").filter({ hasText: "소환수기능" })
    await expect(seg).toBeVisible()
    await seg.click()
    await expect(d.getByTestId("detail-title")).toHaveValue("소환수기능")
    await expect(d.getByTestId("detail-type")).toHaveText("기능")
  })
})
