import { afterAll, describe, expect, it } from "vitest"
import { adminClient, createNode, createProject, cleanupProjects } from "../helpers/supabase"

const admin = adminClient()
const created: string[] = []

afterAll(async () => {
  await cleanupProjects(admin, created)
})

async function statusesOf(pid: string) {
  const { data } = await admin.from("status").select("id, name, category, sort_order").eq("project_id", pid)
  return data ?? []
}
async function newProject(name: string) {
  const pid = await createProject(admin, name)
  created.push(pid)
  const sts = await statusesOf(pid)
  const by = (cat: string) => sts.find((s) => s.category === cat)!
  return { pid, todo: by("할일"), doing: by("진행중"), done: by("완료") }
}

describe("노드 상태 필수 (0012)", () => {
  it("status_id 미지정 insert 는 프로젝트 기본 할일 상태로 채워진다 (모든 타입)", async () => {
    const { pid, todo } = await newProject("상태 기본값")
    const c = await createNode(admin, { project_id: pid, type: "컨텐츠", title: "C" })
    expect(c.error).toBeNull()
    expect(c.data?.status_id).toBe(todo.id)
    const f = await createNode(admin, { project_id: pid, type: "기능", title: "F", parent_id: c.data!.id })
    expect(f.data?.status_id).toBe(todo.id)
  })

  it("명시한 status_id 는 그대로 유지된다", async () => {
    const { pid, doing } = await newProject("상태 명시")
    const { data, error } = await admin
      .from("node").insert({ project_id: pid, type: "컨텐츠", title: "C", status_id: doing.id }).select("*").single()
    expect(error).toBeNull()
    expect(data?.status_id).toBe(doing.id)
  })

  it("기본 상태는 name='할일' 우선, 없으면 할일 분류 중 sort_order 최소", async () => {
    const { pid, todo } = await newProject("상태 기본 규칙")
    await admin.from("status").update({ name: "대기", sort_order: 5 }).eq("id", todo.id)
    const early = await admin.from("status").insert({ project_id: pid, name: "백로그", category: "할일", sort_order: 1 }).select("id").single()
    const r1 = await admin.rpc("default_todo_status_id", { p_project_id: pid })
    expect(r1.data).toBe(early.data!.id)
    const named = await admin.from("status").insert({ project_id: pid, name: "할일", category: "할일", sort_order: 9 }).select("id").single()
    const c = await createNode(admin, { project_id: pid, type: "컨텐츠", title: "C" })
    expect(c.data?.status_id).toBe(named.data!.id)
  })

  it("status_id 를 null 로 바꿀 수 없다 (NOT NULL)", async () => {
    const { pid } = await newProject("상태 NOT NULL")
    const c = await createNode(admin, { project_id: pid, type: "컨텐츠", title: "C" })
    const { error } = await admin.from("node").update({ status_id: null }).eq("id", c.data!.id)
    expect(error).not.toBeNull()
  })

  it("사용 중인 상태는 삭제할 수 없고, 다른 상태로 이전한 뒤에는 삭제된다", async () => {
    const { pid, todo } = await newProject("상태 삭제 restrict")
    const review = await admin.from("status").insert({ project_id: pid, name: "검토", category: "진행중" }).select("id").single()
    const c = await admin.from("node").insert({ project_id: pid, type: "컨텐츠", title: "C", status_id: review.data!.id }).select("id").single()
    const blocked = await admin.from("status").delete().eq("id", review.data!.id)
    expect(blocked.error).not.toBeNull()
    await admin.from("node").update({ status_id: todo.id }).eq("status_id", review.data!.id)
    const ok = await admin.from("status").delete().eq("id", review.data!.id)
    expect(ok.error).toBeNull()
    const node = await admin.from("node").select("status_id").eq("id", c.data!.id).single()
    expect(node.data?.status_id).toBe(todo.id)
  })

  it("마지막 할일 분류 상태는 삭제·분류 변경 불가, 다른 할일 상태가 있으면 가능", async () => {
    const { pid, todo } = await newProject("마지막 할일 보호")
    const del = await admin.from("status").delete().eq("id", todo.id)
    expect(del.error?.message).toContain("마지막 할일")
    const recat = await admin.from("status").update({ category: "진행중" }).eq("id", todo.id)
    expect(recat.error?.message).toContain("마지막 할일")
    await admin.from("status").insert({ project_id: pid, name: "백로그", category: "할일" })
    const recat2 = await admin.from("status").update({ category: "진행중" }).eq("id", todo.id)
    expect(recat2.error).toBeNull()
  })

  it("프로젝트 삭제는 상태·노드와 함께 정상 cascade 된다", async () => {
    const pid = await createProject(admin, "상태 cascade")
    const c = await createNode(admin, { project_id: pid, type: "컨텐츠", title: "C" })
    expect(c.error).toBeNull()
    const { error } = await admin.from("project").delete().eq("id", pid)
    expect(error).toBeNull()
    const left = await admin.from("status").select("id").eq("project_id", pid)
    expect(left.data).toHaveLength(0)
  })
})
