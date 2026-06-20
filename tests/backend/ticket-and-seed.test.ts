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
    const pid = await createProject(admin, "시드 테스트")
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

  it("프로젝트는 name 만 저장한다 (key_prefix/ticket_seq 폐기)", async () => {
    const pid = await createProject(admin, "이름만")
    created.push(pid)

    const { data, error } = await admin
      .from("project")
      .select("name")
      .eq("id", pid)
      .single()

    expect(error).toBeNull()
    expect(data!.name).toBe("이름만")
  })
})

describe("티켓 번호 발급 (node BEFORE INSERT 트리거, 타입별)", () => {
  it("같은 타입의 첫 노드는 1, 이후 순차 증가", async () => {
    const pid = await createProject(admin, "티켓 순차")
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

  it("타입별로 카운터가 독립적이다 (Content/Feature/SubFeature/Task)", async () => {
    const pid = await createProject(admin, "타입별 카운터")
    created.push(pid)

    const c = await createNode(admin, {
      project_id: pid,
      type: "컨텐츠",
      title: "C",
    })
    const f1 = await createNode(admin, {
      project_id: pid,
      type: "기능",
      title: "F1",
      parent_id: c.data!.id,
    })
    const f2 = await createNode(admin, {
      project_id: pid,
      type: "기능",
      title: "F2",
      parent_id: c.data!.id,
    })
    const s = await createNode(admin, {
      project_id: pid,
      type: "세부기능",
      title: "S",
      parent_id: f1.data!.id,
    })
    const t = await createNode(admin, {
      project_id: pid,
      type: "작업",
      title: "T",
      parent_id: s.data!.id,
    })

    // 각 타입 독립: 첫 노드는 타입 무관하게 1, 같은 타입 둘째만 2
    expect(c.data?.ticket_number).toBe(1)
    expect(f1.data?.ticket_number).toBe(1)
    expect(f2.data?.ticket_number).toBe(2)
    expect(s.data?.ticket_number).toBe(1)
    expect(t.data?.ticket_number).toBe(1)
  })

  it("동시 insert 시에도 번호 중복/누락이 없다 (원자적 발급)", async () => {
    const pid = await createProject(admin, "티켓 동시성")
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
    const a = await createProject(admin, "프로젝트 A")
    const b = await createProject(admin, "프로젝트 B")
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

describe("UR 번호 발급 (ur BEFORE INSERT 트리거, 프로젝트 단위)", () => {
  async function makeSubFeature(pid: string): Promise<string> {
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
    return s.data!.id
  }
  async function insertUr(featureId: string, text: string) {
    return admin.from("ur").insert({ feature_id: featureId, text }).select("*").single()
  }

  it("UR 은 프로젝트 단위로 1부터 순차 발급된다 (세부기능 무관)", async () => {
    const pid = await createProject(admin, "UR 번호")
    created.push(pid)
    const s1 = await makeSubFeature(pid)
    const s2 = await makeSubFeature(pid) // 다른 세부기능(같은 프로젝트)

    const u1 = await insertUr(s1, "UR-1")
    const u2 = await insertUr(s1, "UR-2")
    const u3 = await insertUr(s2, "UR-3") // 다른 세부기능이어도 프로젝트 카운터 공유

    expect(u1.data?.ticket_number).toBe(1)
    expect(u2.data?.ticket_number).toBe(2)
    expect(u3.data?.ticket_number).toBe(3)
  })

  it("동시 insert 에도 UR 번호 중복/누락이 없다", async () => {
    const pid = await createProject(admin, "UR 동시성")
    created.push(pid)
    const s = await makeSubFeature(pid)

    const N = 10
    const results = await Promise.all(
      Array.from({ length: N }, (_, i) => insertUr(s, `동시 UR-${i}`))
    )
    for (const r of results) expect(r.error).toBeNull()
    const nums = results.map((r) => r.data!.ticket_number as number).sort((a, b) => a - b)
    expect(new Set(nums).size).toBe(N)
    expect(nums).toEqual(Array.from({ length: N }, (_, i) => i + 1))
  })

  it("UR 카운터는 프로젝트별로 독립적이다", async () => {
    const a = await createProject(admin, "UR 프로젝트 A")
    const b = await createProject(admin, "UR 프로젝트 B")
    created.push(a, b)
    const sa = await makeSubFeature(a)
    const sb = await makeSubFeature(b)

    const ua = await insertUr(sa, "A의 UR")
    const ub = await insertUr(sb, "B의 UR")
    expect(ua.data?.ticket_number).toBe(1)
    expect(ub.data?.ticket_number).toBe(1)
  })
})
