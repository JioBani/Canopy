import { afterAll, describe, expect, it } from "vitest"
import {
  adminClient,
  anonClient,
  authedClient,
  cleanupProjects,
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

describe("member 동기화 (auth.users 트리거)", () => {
  it("회원가입하면 member 행이 자동 생성된다", async () => {
    const { userId, email } = await authedClient()

    const { data, error } = await admin
      .from("member")
      .select("id, email")
      .eq("id", userId)
      .single()

    expect(error).toBeNull()
    expect(data!.id).toBe(userId)
    expect(data!.email).toBe(email)
  })
})
