import { afterAll, describe, expect, it } from "vitest"
import {
  adminClient,
  createNode,
  createProject,
  cleanupProjects,
} from "../helpers/supabase"

const admin = adminClient()
const created: string[] = []

afterAll(async () => {
  await cleanupProjects(admin, created)
})

/** 컨텐츠>기능>세부기능>작업 + UR/그룹/링크/체크리스트/노드링크 한 세트 구성. */
async function buildScenario() {
  const pid = await createProject(admin, "cascade 테스트", "CC")
  created.push(pid)

  const content = (
    await createNode(admin, { project_id: pid, type: "컨텐츠", title: "C" })
  ).data!
  const feature = (
    await createNode(admin, {
      project_id: pid,
      type: "기능",
      title: "F",
      parent_id: content.id,
    })
  ).data!
  const sub = (
    await createNode(admin, {
      project_id: pid,
      type: "세부기능",
      title: "S",
      parent_id: feature.id,
    })
  ).data!
  const task = (
    await createNode(admin, {
      project_id: pid,
      type: "작업",
      title: "T",
      parent_id: sub.id,
    })
  ).data!

  const group = (
    await admin
      .from("ur_group")
      .insert({ feature_id: sub.id, name: "그룹" })
      .select("id")
      .single()
  ).data!
  const ur = (
    await admin
      .from("ur")
      .insert({ feature_id: sub.id, ur_group_id: group.id, text: "UR-1" })
      .select("id")
      .single()
  ).data!
  const link = (
    await admin
      .from("ur_work_link")
      .insert({ ur_id: ur.id, work_id: task.id })
      .select("id")
      .single()
  ).data!
  const check = (
    await admin
      .from("task_checklist")
      .insert({ work_id: task.id, text: "할 일" })
      .select("id")
      .single()
  ).data!
  const nlink = (
    await admin
      .from("node_link")
      .insert({ from_node_id: task.id, to_node_id: feature.id, type: "relates" })
      .select("id")
      .single()
  ).data!

  return { pid, content, feature, sub, task, group, ur, link, check, nlink }
}

async function nodeExists(id: string) {
  const { data } = await admin.from("node").select("id").eq("id", id)
  return (data ?? []).length > 0
}
async function rowExists(table: string, id: string) {
  const { data } = await admin.from(table).select("id").eq("id", id)
  return (data ?? []).length > 0
}

describe("노드 삭제 cascade (FK ON DELETE CASCADE)", () => {
  it("기능 삭제 → 하위 노드 + 그 기능의 UR/그룹/링크/노드링크가 함께 사라지고 상위는 남는다", async () => {
    const s = await buildScenario()

    await admin.from("node").delete().eq("id", s.feature.id)

    // 기능과 그 하위(세부기능/작업) 삭제됨
    expect(await nodeExists(s.feature.id)).toBe(false)
    expect(await nodeExists(s.sub.id)).toBe(false)
    expect(await nodeExists(s.task.id)).toBe(false)
    // 참조행 정리됨
    expect(await rowExists("ur_group", s.group.id)).toBe(false)
    expect(await rowExists("ur", s.ur.id)).toBe(false)
    expect(await rowExists("ur_work_link", s.link.id)).toBe(false)
    expect(await rowExists("task_checklist", s.check.id)).toBe(false)
    expect(await rowExists("node_link", s.nlink.id)).toBe(false)
    // 상위(컨텐츠)는 유지
    expect(await nodeExists(s.content.id)).toBe(true)
  })

  it("작업 삭제 → 그 작업의 ur_work_link·체크리스트는 사라지고 UR 은 남는다", async () => {
    const s = await buildScenario()

    await admin.from("node").delete().eq("id", s.task.id)

    expect(await nodeExists(s.task.id)).toBe(false)
    expect(await rowExists("ur_work_link", s.link.id)).toBe(false)
    expect(await rowExists("task_checklist", s.check.id)).toBe(false)
    expect(await rowExists("node_link", s.nlink.id)).toBe(false)
    // UR/그룹/기능/세부기능은 작업 삭제와 무관하게 유지
    expect(await rowExists("ur", s.ur.id)).toBe(true)
    expect(await rowExists("ur_group", s.group.id)).toBe(true)
    expect(await nodeExists(s.feature.id)).toBe(true)
    expect(await nodeExists(s.sub.id)).toBe(true)
  })

  it("컨텐츠(루트) 삭제 → 전체 서브트리와 모든 참조행이 사라진다", async () => {
    const s = await buildScenario()

    await admin.from("node").delete().eq("id", s.content.id)

    for (const id of [s.content.id, s.feature.id, s.sub.id, s.task.id]) {
      expect(await nodeExists(id)).toBe(false)
    }
    expect(await rowExists("ur", s.ur.id)).toBe(false)
    expect(await rowExists("ur_group", s.group.id)).toBe(false)
    expect(await rowExists("ur_work_link", s.link.id)).toBe(false)
    expect(await rowExists("task_checklist", s.check.id)).toBe(false)
    expect(await rowExists("node_link", s.nlink.id)).toBe(false)
  })
})
