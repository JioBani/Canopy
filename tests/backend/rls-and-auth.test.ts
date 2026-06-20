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

describe("RLS — 비로그인(anon) 거부", () => {
  it("anon 은 project 를 insert 할 수 없다", async () => {
    const anon = anonClient()
    const { error } = await anon
      .from("project")
      .insert({ name: "anon 침입", key_prefix: "XX" })
    expect(error).not.toBeNull()
  })

  it("anon 은 기존 project 행을 읽을 수 없다", async () => {
    const pid = (
      await admin
        .from("project")
        .insert({ name: "비공개", key_prefix: "PV" })
        .select("id")
        .single()
    ).data!.id
    created.push(pid)

    const anon = anonClient()
    const { data } = await anon.from("project").select("id").eq("id", pid)
    expect(data ?? []).toHaveLength(0)
  })
})

describe("RLS — 로그인(authenticated) 허용", () => {
  it("로그인 사용자는 project insert/select 가능", async () => {
    const { client } = await authedClient()

    const ins = await client
      .from("project")
      .insert({ name: "로그인 생성", key_prefix: "LG" })
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
