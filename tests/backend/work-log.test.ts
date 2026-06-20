import { afterAll, beforeAll, describe, expect, it } from "vitest"
import {
  adminClient,
  cleanupProjects,
  createNode,
  createProject,
} from "../helpers/supabase"

const admin = adminClient()
const created: string[] = []
let pid: string
let taskId: string
let subId: string

beforeAll(async () => {
  pid = await createProject(admin, "워크로그 테스트")
  created.push(pid)
  const c = await createNode(admin, { project_id: pid, type: "컨텐츠", title: "C" })
  const f = await createNode(admin, {
    project_id: pid,
    type: "기능",
    title: "F",
    parent_id: c.data!.id,
  })
  const s = await createNode(admin, {
    project_id: pid,
    type: "세부기능",
    title: "S",
    parent_id: f.data!.id,
  })
  subId = s.data!.id
  const t = await createNode(admin, {
    project_id: pid,
    type: "작업",
    title: "T",
    parent_id: subId,
  })
  taskId = t.data!.id
})

afterAll(async () => {
  await cleanupProjects(admin, created)
})

describe("work_log (작업 시간 측정)", () => {
  it("진행 중(미종료) 세션은 작업당 1개만 (부분 유니크)", async () => {
    const a = await admin
      .from("work_log")
      .insert({ work_id: taskId })
      .select("id")
      .single()
    expect(a.error).toBeNull()

    // 두 번째 진행 중 → 거부
    const b = await admin.from("work_log").insert({ work_id: taskId })
    expect(b.error).not.toBeNull()

    // 첫 세션 종료 → duration 기록
    await admin
      .from("work_log")
      .update({ ended_at: new Date().toISOString(), duration_minutes: 30 })
      .eq("id", a.data!.id)

    // 종료 후엔 새 진행 중 세션 가능
    const c = await admin
      .from("work_log")
      .insert({ work_id: taskId })
      .select("id")
      .single()
    expect(c.error).toBeNull()
    await admin.from("work_log").delete().eq("id", c.data!.id)
  })

  it("작업이 아닌 노드의 work_log 는 거부된다", async () => {
    const { error } = await admin.from("work_log").insert({ work_id: subId })
    expect(error).not.toBeNull()
  })

  it("멤버 삭제 시 work_log.member_id 가 null 된다(ON DELETE SET NULL)", async () => {
    const m = await admin
      .from("member")
      .insert({ display_name: "로거" })
      .select("id")
      .single()
    const log = await admin
      .from("work_log")
      .insert({
        work_id: taskId,
        member_id: m.data!.id,
        ended_at: new Date().toISOString(),
        duration_minutes: 10,
      })
      .select("id")
      .single()

    await admin.from("member").delete().eq("id", m.data!.id)
    const after = await admin
      .from("work_log")
      .select("member_id")
      .eq("id", log.data!.id)
      .single()
    expect(after.data!.member_id).toBeNull()
  })

  it("note 는 선택(null 허용)", async () => {
    const { error } = await admin.from("work_log").insert({
      work_id: taskId,
      ended_at: new Date().toISOString(),
      duration_minutes: 5,
    })
    expect(error).toBeNull()
  })
})
