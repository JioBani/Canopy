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
let masterId: string
let taskAId: string
let taskBId: string
let doneStatusId: string
let todoStatusId: string

async function progressOf(nodeId: string) {
  const { data, error } = await admin
    .from("node_progress")
    .select("total_urs, done_urs, progress")
    .eq("node_id", nodeId)
    .single()
  if (error) throw new Error(error.message)
  return {
    total: Number(data.total_urs),
    done: Number(data.done_urs),
    progress: data.progress === null ? null : Number(data.progress),
  }
}

beforeAll(async () => {
  pid = await createProject(admin, "뷰 테스트")
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

  // 진행도(UR 기반)용: 세부기능에 UR 2개(완료 1 / 미구현 1) → 0.5
  await admin
    .from("ur")
    .insert([
      { feature_id: subId, text: "진행UR-완료", status: "완료" },
      { feature_id: subId, text: "진행UR-미구현", status: "미구현" },
    ])

  // 마스터데이터 엣지: UR 없음 + 작업만 → progress=null(진행도 제외)
  masterId = (
    await createNode(admin, {
      project_id: pid,
      type: "마스터데이터",
      title: "M",
      parent_id: featureId,
    })
  ).data!.id
  await createNode(admin, {
    project_id: pid,
    type: "작업",
    title: "M작업",
    parent_id: masterId,
  })
})

afterAll(async () => {
  await cleanupProjects(admin, created)
})

describe("node_progress 뷰 (UR 완료율 roll-up)", () => {
  it("세부기능 = 자기 UR 완료율 (완료 1 / 총 2 → 0.5)", async () => {
    expect(await progressOf(subId)).toEqual({
      total: 2,
      done: 1,
      progress: 0.5,
    })
  })

  it("상위(기능·컨텐츠)로 UR roll-up 된다 (마스터데이터 작업은 분모에 안 들어감)", async () => {
    expect(await progressOf(featureId)).toEqual({
      total: 2,
      done: 1,
      progress: 0.5,
    })
    expect(await progressOf(contentId)).toEqual({
      total: 2,
      done: 1,
      progress: 0.5,
    })
  })

  it("작업 노드는 UR 을 소유하지 않으므로 progress=null", async () => {
    expect(await progressOf(taskAId)).toEqual({
      total: 0,
      done: 0,
      progress: null,
    })
  })

  it("마스터데이터(UR 없음, 작업만) 엣지 → progress=null (진행도 제외)", async () => {
    expect(await progressOf(masterId)).toEqual({
      total: 0,
      done: 0,
      progress: null,
    })
  })

  it("UR 이 없는 빈 컨텐츠는 progress=null", async () => {
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
        .insert({ feature_id: subId, text: "커버된 UR" })
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

  it("연결 작업 0개 + status≠완료 UR 은 미커버로 표시된다", async () => {
    const ur = (
      await admin
        .from("ur")
        .insert({ feature_id: subId, text: "미커버 UR", status: "미구현" })
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

  it("status=완료 UR 은 연결 작업 0개여도 미커버가 아니다", async () => {
    const ur = (
      await admin
        .from("ur")
        .insert({ feature_id: subId, text: "완료 UR(링크 없음)", status: "완료" })
        .select("id")
        .single()
    ).data!

    const { data } = await admin
      .from("ur_coverage")
      .select("linked_work_count, is_uncovered")
      .eq("ur_id", ur.id)
      .single()

    expect(Number(data!.linked_work_count)).toBe(0)
    expect(data!.is_uncovered).toBe(false) // 완료는 작업 없어도 커버로 침
  })
})
