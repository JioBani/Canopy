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

describe("기본 상태 자동 시드 (project AFTER INSERT 트리거)", () => {
  it("프로젝트 생성 시 4 카테고리 기본 상태가 1개씩 생긴다", async () => {
    const pid = await createProject(admin, "시드 테스트", "SD")
    created.push(pid)

    const { data, error } = await admin
      .from("status")
      .select("name, category")
      .eq("project_id", pid)

    expect(error).toBeNull()
    expect(data).toHaveLength(4)
    const categories = (data ?? []).map((s) => s.category).sort()
    expect(categories).toEqual(["진행중", "완료", "취소됨", "할일"].sort())
  })
})

describe("티켓 번호 발급 (node BEFORE INSERT 트리거)", () => {
  it("첫 노드의 ticket_number 는 1, 이후 순차 증가", async () => {
    const pid = await createProject(admin, "티켓 순차", "TS")
    created.push(pid)

    const first = await createNode(admin, {
      project_id: pid,
      type: "컨텐츠",
      title: "첫 컨텐츠",
    })
    expect(first.error).toBeNull()
    expect(first.data?.ticket_number).toBe(1)

    const second = await createNode(admin, {
      project_id: pid,
      type: "컨텐츠",
      title: "둘째 컨텐츠",
    })
    expect(second.data?.ticket_number).toBe(2)
  })

  it("동시 insert 시에도 번호 중복/누락이 없다 (원자적 발급)", async () => {
    const pid = await createProject(admin, "티켓 동시성", "TC")
    created.push(pid)

    const N = 12
    const results = await Promise.all(
      Array.from({ length: N }, (_, i) =>
        createNode(admin, {
          project_id: pid,
          type: "컨텐츠",
          title: `동시-${i}`,
        })
      )
    )
    for (const r of results) expect(r.error).toBeNull()

    const { data } = await admin
      .from("node")
      .select("ticket_number")
      .eq("project_id", pid)
      .order("ticket_number", { ascending: true })

    const nums = (data ?? []).map((r) => r.ticket_number as number)
    expect(new Set(nums).size).toBe(N) // 중복 없음
    expect(nums).toEqual(Array.from({ length: N }, (_, i) => i + 1)) // 1..N 누락 없음
  })

  it("프로젝트별로 티켓 카운터가 독립적이다", async () => {
    const a = await createProject(admin, "프로젝트 A", "AA")
    const b = await createProject(admin, "프로젝트 B", "BB")
    created.push(a, b)

    const na = await createNode(admin, {
      project_id: a,
      type: "컨텐츠",
      title: "A-1",
    })
    const nb = await createNode(admin, {
      project_id: b,
      type: "컨텐츠",
      title: "B-1",
    })
    expect(na.data?.ticket_number).toBe(1)
    expect(nb.data?.ticket_number).toBe(1)
  })
})
