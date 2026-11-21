import { afterAll, describe, expect, it } from "vitest"
import { adminClient, createNode, createProject, cleanupProjects } from "../helpers/supabase"
import { urGroupKey } from "../../src/nodes/nodeGrammar"

const admin = adminClient()
const created: string[] = []

afterAll(async () => {
  await cleanupProjects(admin, created)
})

async function makeSubFeature(pid: string): Promise<string> {
  const c = await createNode(admin, { project_id: pid, type: "컨텐츠", title: "C" })
  const f = await createNode(admin, { project_id: pid, type: "기능", title: "F", parent_id: c.data!.id })
  const s = await createNode(admin, { project_id: pid, type: "세부기능", title: "S", parent_id: f.data!.id })
  return s.data!.id
}
async function insertGroup(featureId: string, name: string) {
  return admin.from("ur_group").insert({ feature_id: featureId, name }).select("*").single()
}

describe("UR 그룹 번호 발급 (ur_group BEFORE INSERT 트리거, 프로젝트 단위)", () => {
  it("프로젝트 단위로 1부터 순차 발급되고 project_id 가 채워진다", async () => {
    const pid = await createProject(admin, "그룹 번호")
    created.push(pid)
    const s1 = await makeSubFeature(pid)
    const s2 = await makeSubFeature(pid)

    const g1 = await insertGroup(s1, "G1")
    const g2 = await insertGroup(s1, "G2")
    const g3 = await insertGroup(s2, "G3") // 다른 세부기능이어도 프로젝트 카운터 공유

    expect([g1.data?.ticket_number, g2.data?.ticket_number, g3.data?.ticket_number]).toEqual([1, 2, 3])
    expect(g1.data?.project_id).toBe(pid)
    expect(urGroupKey(g3.data!.ticket_number)).toBe("RequirementGroup-3")
  })

  it("UR 번호(Requirement-N)와 카운터가 독립적이다", async () => {
    const pid = await createProject(admin, "그룹-UR 독립")
    created.push(pid)
    const s = await makeSubFeature(pid)
    const u = await admin.from("ur").insert({ feature_id: s, text: "UR" }).select("*").single()
    const g = await insertGroup(s, "G")
    expect(u.data?.ticket_number).toBe(1)
    expect(g.data?.ticket_number).toBe(1)
  })

  it("동시 insert 에도 번호 중복/누락이 없다", async () => {
    const pid = await createProject(admin, "그룹 동시성")
    created.push(pid)
    const s = await makeSubFeature(pid)
    const N = 10
    const results = await Promise.all(Array.from({ length: N }, (_, i) => insertGroup(s, `동시 G-${i}`)))
    for (const r of results) expect(r.error).toBeNull()
    const nums = results.map((r) => r.data!.ticket_number as number).sort((a, b) => a - b)
    expect(nums).toEqual(Array.from({ length: N }, (_, i) => i + 1))
  })

  it("카운터는 프로젝트별로 독립적이다", async () => {
    const a = await createProject(admin, "그룹 A")
    const b = await createProject(admin, "그룹 B")
    created.push(a, b)
    const ga = await insertGroup(await makeSubFeature(a), "A")
    const gb = await insertGroup(await makeSubFeature(b), "B")
    expect(ga.data?.ticket_number).toBe(1)
    expect(gb.data?.ticket_number).toBe(1)
  })

  it("프로젝트 내 번호는 유니크하다 (수동 중복 지정 거부)", async () => {
    const pid = await createProject(admin, "그룹 유니크")
    created.push(pid)
    const s = await makeSubFeature(pid)
    const g1 = await insertGroup(s, "G1")
    const g2 = await insertGroup(s, "G2")
    const dup = await admin.from("ur_group").update({ ticket_number: g1.data!.ticket_number }).eq("id", g2.data!.id)
    expect(dup.error).not.toBeNull()
  })

  it("다른 프로젝트의 세부기능으로 옮길 수 없다", async () => {
    const a = await createProject(admin, "그룹 이동 A")
    const b = await createProject(admin, "그룹 이동 B")
    created.push(a, b)
    const g = await insertGroup(await makeSubFeature(a), "G")
    const moved = await admin.from("ur_group").update({ feature_id: await makeSubFeature(b) }).eq("id", g.data!.id)
    expect(moved.error?.message).toContain("다른 프로젝트")
  })

  it("백필 함수는 재실행 안전하다 (번호 없는 그룹 0, 카운터 유지)", async () => {
    const pid = await createProject(admin, "그룹 백필 재실행")
    created.push(pid)
    const s = await makeSubFeature(pid)
    await insertGroup(s, "G1")
    const r = await admin.rpc("backfill_ur_group_numbers")
    expect(r.error).toBeNull()
    expect(r.data).toBe(0)
    const g2 = await insertGroup(s, "G2")
    expect(g2.data?.ticket_number).toBe(2)
  })
})
