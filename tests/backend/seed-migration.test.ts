import { describe, expect, it } from "vitest"
import { adminClient } from "../helpers/supabase"

const admin = adminClient()

async function tactica() {
  const { data } = await admin
    .from("project")
    .select("id")
    .eq("name", "Tactica Defense")
    .single()
  return data!.id as string
}

async function countNodes(pid: string, type: string) {
  return (
    await admin
      .from("node")
      .select("id", { count: "exact", head: true })
      .eq("project_id", pid)
      .eq("type", type)
  ).count
}

describe("0003 시드 마이그레이션 — Tactica Defense (검증된 요구사항 데이터)", () => {
  it("컨텐츠/기능/세부기능/요구사항이 등록되고 작업은 비어 있다", async () => {
    const pid = await tactica()
    expect(await countNodes(pid, "컨텐츠")).toBe(1)
    expect(await countNodes(pid, "기능")).toBe(7)
    expect(await countNodes(pid, "세부기능")).toBe(39)
    expect(await countNodes(pid, "작업")).toBe(0)

    const subs = (
      await admin.from("node").select("id").eq("project_id", pid).eq("type", "세부기능")
    ).data!.map((s) => s.id)
    let ur = 0
    for (let i = 0; i < subs.length; i += 50) {
      ur += (
        await admin
          .from("ur")
          .select("id", { count: "exact", head: true })
          .in("feature_id", subs.slice(i, i + 50))
      ).count!
    }
    expect(ur).toBe(238)
  })

  it("티켓 번호가 타입별로 1..N 부여돼 있다(기능 1..7)", async () => {
    const pid = await tactica()
    const { data } = await admin
      .from("node")
      .select("ticket_number")
      .eq("project_id", pid)
      .eq("type", "기능")
      .order("ticket_number", { ascending: true })
    expect(data!.map((f) => f.ticket_number)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it("프로젝트명 오타가 수정돼 있다(Tatica 없음)", async () => {
    const { data } = await admin
      .from("project")
      .select("name")
      .ilike("name", "Tatica%")
    expect(data ?? []).toHaveLength(0)
  })
})
