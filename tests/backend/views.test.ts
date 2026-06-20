import { afterAll, beforeAll, describe, expect, it } from "vitest"
import {
  adminClient,
  createNode,
  createProject,
  cleanupProjects,
} from "../helpers/supabase"

const admin = adminClient()
const created: string[] = []

let pid: string
let contentId: string
let featureId: string
let subId: string
let taskAId: string
let taskBId: string
let doneStatusId: string
let todoStatusId: string

async function progressOf(nodeId: string) {
  const { data, error } = await admin
    .from("node_progress")
    .select("total_tasks, done_tasks, progress")
    .eq("node_id", nodeId)
    .single()
  if (error) throw new Error(error.message)
  return {
    total: Number(data.total_tasks),
    done: Number(data.done_tasks),
    progress: data.progress === null ? null : Number(data.progress),
  }
}

beforeAll(async () => {
  pid = await createProject(admin, "뷰 테스트", "VW")
  created.push(pid)

  const { data: statuses } = await admin
    .from("status")
    .select("id, category")
    .eq("project_id", pid)
  doneStatusId = statuses!.find((s) => s.category === "완료")!.id
  todoStatusId = statuses!.find((s) => s.category === "할일")!.id

  contentId = (
    await createNode(admin, { project_id: pid, type: "컨텐츠", title: "C" })
  ).data!.id
  featureId = (
    await createNode(admin, {
      project_id: pid,
      type: "기능",
      title: "F",
      parent_id: contentId,
    })
  ).data!.id
  subId = (
    await createNode(admin, {
      project_id: pid,
      type: "세부기능",
      title: "S",
      parent_id: featureId,
    })
  ).data!.id
  taskAId = (
    await createNode(admin, {
      project_id: pid,
      type: "작업",
      title: "작업A(완료)",
      parent_id: subId,
      status_id: doneStatusId,
    })
  ).data!.id
  taskBId = (
    await createNode(admin, {
      project_id: pid,
      type: "작업",
      title: "작업B(할일)",
      parent_id: subId,
      status_id: todoStatusId,
    })
  ).data!.id
})

afterAll(async () => {
  await cleanupProjects(admin, created)
})

describe("node_progress 뷰 (재귀 roll-up)", () => {
  it("작업 2개 중 1개 완료 → 세부기능 진행률 0.5", async () => {
    expect(await progressOf(subId)).toEqual({
      total: 2,
      done: 1,
      progress: 0.5,
    })
  })

  it("상위 노드(기능·컨텐츠)로 roll-up 된다", async () => {
    expect(await progressOf(featureId)).toMatchObject({ total: 2, done: 1 })
    expect(await progressOf(contentId)).toMatchObject({ total: 2, done: 1 })
  })

  it("작업 노드 자신은 완료면 1/1, 미완료면 0/1", async () => {
    expect(await progressOf(taskAId)).toEqual({
      total: 1,
      done: 1,
      progress: 1,
    })
    expect(await progressOf(taskBId)).toEqual({
      total: 1,
      done: 0,
      progress: 0,
    })
  })

  it("하위 작업이 없는 빈 컨텐츠는 progress=null", async () => {
    const empty = (
      await createNode(admin, {
        project_id: pid,
        type: "컨텐츠",
        title: "빈 컨텐츠",
      })
    ).data!.id
    expect(await progressOf(empty)).toEqual({
      total: 0,
      done: 0,
      progress: null,
    })
  })
})

describe("ur_coverage 뷰 (UR 커버리지/미커버)", () => {
  it("연결 작업 2개 모두 완료 → linked 2 / done 2 / 미커버 아님", async () => {
    // taskA(완료), 그리고 taskB 를 완료로 바꿔 둘 다 완료로
    const ur = (
      await admin
        .from("ur")
        .insert({ feature_id: featureId, text: "커버된 UR" })
        .select("id")
        .single()
    ).data!
    await admin.from("ur_work_link").insert([
      { ur_id: ur.id, work_id: taskAId },
      { ur_id: ur.id, work_id: taskBId },
    ])
    await admin
      .from("node")
      .update({ status_id: doneStatusId })
      .eq("id", taskBId)

    const { data } = await admin
      .from("ur_coverage")
      .select("linked_work_count, done_work_count, is_uncovered")
      .eq("ur_id", ur.id)
      .single()

    expect(Number(data!.linked_work_count)).toBe(2)
    expect(Number(data!.done_work_count)).toBe(2)
    expect(data!.is_uncovered).toBe(false)
  })

  it("연결 작업 0개 UR 은 미커버로 표시된다", async () => {
    const ur = (
      await admin
        .from("ur")
        .insert({ feature_id: featureId, text: "미커버 UR" })
        .select("id")
        .single()
    ).data!

    const { data } = await admin
      .from("ur_coverage")
      .select("linked_work_count, is_uncovered")
      .eq("ur_id", ur.id)
      .single()

    expect(Number(data!.linked_work_count)).toBe(0)
    expect(data!.is_uncovered).toBe(true)
  })
})
