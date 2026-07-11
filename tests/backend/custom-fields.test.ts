import { afterAll, describe, expect, it } from "vitest"
import {
  adminClient,
  cleanupProjects,
  createNode,
  createProject,
} from "../helpers/supabase"

const admin = adminClient()
const projectIds: string[] = []
afterAll(() => cleanupProjects(admin, projectIds))

async function newProject(name: string) {
  const id = await createProject(admin, name)
  projectIds.push(id)
  return id
}

describe("0007 커스텀 필드 — field_def 시드 + node.fields", () => {
  it("프로젝트 생성 시 우선순위(priority) 필드가 6단계로 시드된다", async () => {
    const pid = await newProject(`fld_${Date.now()}`)
    const { data } = await admin
      .from("field_def")
      .select("*")
      .eq("project_id", pid)
    expect(data).toHaveLength(1)
    const f = data![0]
    expect(f.key).toBe("priority")
    expect(f.label).toBe("우선순위")
    expect(f.type).toBe("select")
    expect(f.applies_to).toEqual(["*"])
    const values = (f.options as { value: string; order: number }[])
      .sort((a, b) => a.order - b.order)
      .map((o) => o.value)
    expect(values).toEqual([
      "매우낮음",
      "낮음",
      "보통",
      "높음",
      "매우높음",
      "최우선",
    ])
  })

  it("노드 fields 기본은 {} 이고, 우선순위 값을 저장·조회할 수 있다", async () => {
    const pid = await newProject(`fld2_${Date.now()}`)
    const { data: node, error } = await createNode(admin, {
      project_id: pid,
      type: "컨텐츠",
      title: "전장",
    })
    expect(error).toBeNull()
    expect(node!.fields).toEqual({})

    await admin
      .from("node")
      .update({ fields: { priority: "높음" } })
      .eq("id", node!.id)
    const { data: got } = await admin
      .from("node")
      .select("fields")
      .eq("id", node!.id)
      .single()
    expect(got!.fields).toEqual({ priority: "높음" })
  })

  it("field_def.key 는 프로젝트 내 유일하다(중복 시드 거부)", async () => {
    const pid = await newProject(`fld3_${Date.now()}`)
    const { error } = await admin
      .from("field_def")
      .insert({ project_id: pid, key: "priority", label: "x", type: "select" })
    expect(error).not.toBeNull() // unique(project_id, key) 위반
  })
})
