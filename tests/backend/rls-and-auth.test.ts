import { afterAll, describe, expect, it } from "vitest"
import {
  adminClient,
  anonClient,
  authedClient,
  cleanupProjects,
  createNode,
  createProject,
} from "../helpers/supabase"

const admin = adminClient()
const created: string[] = []

afterAll(async () => {
  await cleanupProjects(admin, created)
})

describe("RLS — 비로그인(anon) 허용 (0002: 로그인 게이트 제거)", () => {
  it("anon 이 project 를 insert 할 수 있다", async () => {
    const anon = anonClient()
    const { data, error } = await anon
      .from("project")
      .insert({ name: "anon 생성" })
      .select("id")
      .single()
    expect(error).toBeNull()
    expect(data!.id).toBeTruthy()
    created.push(data!.id)
  })

  it("anon 이 기존 project 행을 읽을 수 있다 + 기본 상태 트리거 동작", async () => {
    const pid = (
      await admin
        .from("project")
        .insert({ name: "공개" })
        .select("id")
        .single()
    ).data!.id
    created.push(pid)

    const anon = anonClient()
    const { data } = await anon.from("project").select("id").eq("id", pid)
    expect(data ?? []).toHaveLength(1)

    // anon 직접 생성 프로젝트도 기본 상태 4종 시드됨(seed_default_statuses anon 실행 가능)
    const mine = (
      await anon
        .from("project")
        .insert({ name: "anon 트리거" })
        .select("id")
        .single()
    ).data!
    created.push(mine.id)
    const { data: statuses } = await anon
      .from("status")
      .select("id")
      .eq("project_id", mine.id)
    expect(statuses).toHaveLength(4)
  })
})

describe("RLS — 로그인(authenticated) 허용", () => {
  it("로그인 사용자는 project insert/select 가능", async () => {
    const { client } = await authedClient()

    const ins = await client
      .from("project")
      .insert({ name: "로그인 생성" })
      .select("id")
      .single()
    expect(ins.error).toBeNull()
    created.push(ins.data!.id)

    const sel = await client
      .from("project")
      .select("id")
      .eq("id", ins.data!.id)
    expect(sel.error).toBeNull()
    expect(sel.data).toHaveLength(1)
  })
})

describe("member 수동 관리 (auth 연동 제거, 0004)", () => {
  it("멤버를 직접 생성(id 자동)하고 작업에 할당, 멤버 삭제 시 assignee 가 null 된다", async () => {
    const pid = await createProject(admin, "멤버테스트")
    created.push(pid)

    // 멤버 직접 생성 (auth.users 없이 — id 는 DB 발급)
    const { data: m, error: me } = await admin
      .from("member")
      .insert({ display_name: "테스터", color: "#EC9EBA" })
      .select("id")
      .single()
    expect(me).toBeNull()
    expect(m!.id).toBeTruthy()

    // 작업 트리 생성 후 담당자 할당
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
    const t = await createNode(admin, {
      project_id: pid,
      type: "작업",
      title: "T",
      parent_id: s.data!.id,
    })
    await admin.from("node").update({ assignee_id: m!.id }).eq("id", t.data!.id)
    const before = await admin
      .from("node")
      .select("assignee_id")
      .eq("id", t.data!.id)
      .single()
    expect(before.data!.assignee_id).toBe(m!.id)

    // 멤버 삭제 → 담당 작업 assignee 자동 해제(FK ON DELETE SET NULL)
    await admin.from("member").delete().eq("id", m!.id)
    const after = await admin
      .from("node")
      .select("assignee_id")
      .eq("id", t.data!.id)
      .single()
    expect(after.data!.assignee_id).toBeNull()
  })

  it("멤버 이름/색을 수정할 수 있다", async () => {
    const { data: m } = await admin
      .from("member")
      .insert({ display_name: "수정전" })
      .select("id")
      .single()
    await admin
      .from("member")
      .update({ display_name: "수정후", color: "#7DAEDE" })
      .eq("id", m!.id)
    const { data } = await admin
      .from("member")
      .select("display_name, color")
      .eq("id", m!.id)
      .single()
    expect(data!.display_name).toBe("수정후")
    expect(data!.color).toBe("#7DAEDE")
    await admin.from("member").delete().eq("id", m!.id)
  })
})
