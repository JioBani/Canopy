import { afterAll, describe, expect, it } from "vitest"
import { adminClient, createProject, cleanupProjects } from "../helpers/supabase"

const admin = adminClient()
const created: string[] = []

afterAll(async () => {
  await cleanupProjects(admin, created)
})

describe("상태 아이콘 (status.icon)", () => {
  it("기본 상태 시드에 카테고리별 기본 아이콘이 들어간다", async () => {
    const pid = await createProject(admin, "상태 아이콘 시드")
    created.push(pid)
    const { data, error } = await admin.from("status").select("category, icon").eq("project_id", pid)
    expect(error).toBeNull()
    const map = Object.fromEntries((data ?? []).map((s) => [s.category, s.icon]))
    expect(map).toEqual({ 할일: "circle", 진행중: "circle-dot", 완료: "circle-check", 취소됨: "circle-x" })
  })

  it("커스텀 상태는 icon 을 지정·수정·해제할 수 있다 (미지정 시 null)", async () => {
    const pid = await createProject(admin, "상태 아이콘 수정")
    created.push(pid)
    const plain = await admin.from("status").insert({ project_id: pid, name: "검토", category: "진행중" }).select("*").single()
    expect(plain.error).toBeNull()
    expect(plain.data?.icon).toBeNull()
    const set = await admin.from("status").update({ icon: "loader" }).eq("id", plain.data!.id).select("icon").single()
    expect(set.data?.icon).toBe("loader")
    const cleared = await admin.from("status").update({ icon: null }).eq("id", plain.data!.id).select("icon").single()
    expect(cleared.data?.icon).toBeNull()
  })

  it("빈 문자열·64자 초과 icon 은 거부된다", async () => {
    const pid = await createProject(admin, "상태 아이콘 길이")
    created.push(pid)
    const empty = await admin.from("status").insert({ project_id: pid, name: "A", category: "할일", icon: "" })
    expect(empty.error).not.toBeNull()
    const long = await admin.from("status").insert({ project_id: pid, name: "B", category: "할일", icon: "x".repeat(65) })
    expect(long.error).not.toBeNull()
  })

  it("default_status_icon(category) 는 기본 아이콘 키를 돌려준다", async () => {
    const r = await admin.rpc("default_status_icon", { p_category: "완료" })
    expect(r.error).toBeNull()
    expect(r.data).toBe("circle-check")
  })
})
