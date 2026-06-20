import { afterAll, beforeAll, describe, expect, it } from "vitest"
import {
  adminClient,
  createNode,
  createProject,
  cleanupProjects,
} from "../helpers/supabase"

const admin = adminClient()
const created: string[] = []

// 공유 트리: 컨텐츠 > 기능 > (세부기능, 마스터데이터) > 작업
let pid: string
let contentId: string
let featureId: string
let subId: string
let masterId: string
let taskId: string

beforeAll(async () => {
  pid = await createProject(admin, "계층 테스트", "HR")
  created.push(pid)

  const content = await createNode(admin, {
    project_id: pid,
    type: "컨텐츠",
    title: "전장",
  })
  contentId = content.data!.id

  const feature = await createNode(admin, {
    project_id: pid,
    type: "기능",
    title: "소환수",
    parent_id: contentId,
  })
  featureId = feature.data!.id

  const sub = await createNode(admin, {
    project_id: pid,
    type: "세부기능",
    title: "소환수 합성",
    parent_id: featureId,
  })
  subId = sub.data!.id

  const master = await createNode(admin, {
    project_id: pid,
    type: "마스터데이터",
    title: "아리아",
    parent_id: featureId,
  })
  masterId = master.data!.id

  const task = await createNode(admin, {
    project_id: pid,
    type: "작업",
    title: "합성 로직",
    parent_id: subId,
  })
  taskId = task.data!.id
})

afterAll(async () => {
  await cleanupProjects(admin, created)
})

describe("타입 문법 강제 (validate_node_hierarchy 트리거) — 허용", () => {
  it("정상 트리(컨텐츠>기능>세부기능/마스터데이터>작업)는 모두 생성된다", () => {
    expect(contentId).toBeTruthy()
    expect(featureId).toBeTruthy()
    expect(subId).toBeTruthy()
    expect(masterId).toBeTruthy()
    expect(taskId).toBeTruthy()
  })

  it("마스터데이터 아래에도 작업을 만들 수 있다", async () => {
    const r = await createNode(admin, {
      project_id: pid,
      type: "작업",
      title: "아리아 일러스트",
      parent_id: masterId,
    })
    expect(r.error).toBeNull()
  })
})

describe("타입 문법 강제 — 거부", () => {
  it("컨텐츠는 부모를 가질 수 없다", async () => {
    const r = await createNode(admin, {
      project_id: pid,
      type: "컨텐츠",
      title: "잘못된 컨텐츠",
      parent_id: contentId,
    })
    expect(r.error).not.toBeNull()
  })

  it("기능은 부모(컨텐츠)가 없으면 안 된다", async () => {
    const r = await createNode(admin, {
      project_id: pid,
      type: "기능",
      title: "떠도는 기능",
      parent_id: null,
    })
    expect(r.error).not.toBeNull()
  })

  it("기능 아래 기능은 금지 (기능 중첩 X)", async () => {
    const r = await createNode(admin, {
      project_id: pid,
      type: "기능",
      title: "중첩 기능",
      parent_id: featureId,
    })
    expect(r.error).not.toBeNull()
  })

  it("세부기능의 부모는 기능이어야 한다 (컨텐츠 아래 금지)", async () => {
    const r = await createNode(admin, {
      project_id: pid,
      type: "세부기능",
      title: "잘못된 세부기능",
      parent_id: contentId,
    })
    expect(r.error).not.toBeNull()
  })

  it("작업의 부모는 세부기능/마스터데이터여야 한다 (기능 아래 금지)", async () => {
    const r = await createNode(admin, {
      project_id: pid,
      type: "작업",
      title: "잘못된 작업",
      parent_id: featureId,
    })
    expect(r.error).not.toBeNull()
  })

  it("작업 아래 작업은 금지 (작업은 잎)", async () => {
    const r = await createNode(admin, {
      project_id: pid,
      type: "작업",
      title: "중첩 작업",
      parent_id: taskId,
    })
    expect(r.error).not.toBeNull()
  })

  it("부모가 다른 프로젝트면 거부", async () => {
    const other = await createProject(admin, "다른 프로젝트", "OT")
    created.push(other)
    const r = await createNode(admin, {
      project_id: other,
      type: "기능",
      title: "타프로젝트 부모",
      parent_id: contentId, // HR 프로젝트의 컨텐츠
    })
    expect(r.error).not.toBeNull()
  })
})

describe("UR / 링크 타입 가드", () => {
  it("ur.feature_id 는 기능 노드여야 한다 — 기능이면 OK", async () => {
    const r = await admin
      .from("ur")
      .insert({ feature_id: featureId, text: "2마리 합성→상위" })
      .select("id")
      .single()
    expect(r.error).toBeNull()
  })

  it("ur.feature_id 가 컨텐츠면 거부", async () => {
    const r = await admin
      .from("ur")
      .insert({ feature_id: contentId, text: "잘못된 UR" })
    expect(r.error).not.toBeNull()
  })

  it("ur_group.feature_id 가 작업이면 거부", async () => {
    const r = await admin
      .from("ur_group")
      .insert({ feature_id: taskId, name: "잘못된 그룹" })
    expect(r.error).not.toBeNull()
  })

  it("ur_work_link.work_id 는 작업이어야 한다 — 작업이면 OK", async () => {
    const ur = await admin
      .from("ur")
      .insert({ feature_id: featureId, text: "링크용 UR" })
      .select("id")
      .single()
    const r = await admin
      .from("ur_work_link")
      .insert({ ur_id: ur.data!.id, work_id: taskId })
    expect(r.error).toBeNull()
  })

  it("ur_work_link.work_id 가 세부기능이면 거부", async () => {
    const ur = await admin
      .from("ur")
      .insert({ feature_id: featureId, text: "링크용 UR2" })
      .select("id")
      .single()
    const r = await admin
      .from("ur_work_link")
      .insert({ ur_id: ur.data!.id, work_id: subId })
    expect(r.error).not.toBeNull()
  })
})
