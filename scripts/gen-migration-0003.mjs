// 0003 마이그레이션 생성기 — 현재 로컬 DB 의 검증된 요구사항 데이터(Tactica Defense)를
// 정식 등록용 SQL(INSERT)로 직렬화한다. 작업(Task)·링크는 제외(요구사항만).
// 티켓 번호는 트리거가 INSERT 순서대로 부여(Content-1, Feature-1.., SubFeature-1.., Requirement-1..).
// 실행: node scripts/gen-migration-0003.mjs  (로컬 스택 떠 있고 Tatica/Tactica 데이터가 있어야 함)
import { writeFileSync } from "node:fs"
import { randomUUID } from "node:crypto"
import { createClient } from "@supabase/supabase-js"

const URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54621"
const KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
const db = createClient(URL, KEY, { auth: { persistSession: false } })

const OUT = "supabase/migrations/0003_seed_tactica.sql"
const PROJECT_NAME = "Tactica Defense"

const q = (s) => (s == null ? "null" : `'${String(s).replace(/'/g, "''")}'`)

async function main() {
  const { data: proj } = await db
    .from("project")
    .select("id")
    .ilike("name", "%a Defense")
    .limit(1)
    .single()
  const srcPid = proj.id

  const nodesRes = await db
    .from("node")
    .select("id,parent_id,type,title,sort_order,status_id,status:status_id(category)")
    .eq("project_id", srcPid)
    .order("sort_order", { ascending: true })
  const nodes = nodesRes.data
  const content = nodes.find((n) => n.type === "컨텐츠")
  const features = nodes
    .filter((n) => n.type === "기능")
    .sort((a, b) => a.sort_order - b.sort_order)
  const subsByFeature = (fid) =>
    nodes
      .filter((n) => n.type === "세부기능" && n.parent_id === fid)
      .sort((a, b) => a.sort_order - b.sort_order)

  const subIds = nodes.filter((n) => n.type === "세부기능").map((n) => n.id)
  let groups = []
  let urs = []
  for (let i = 0; i < subIds.length; i += 50) {
    const c = subIds.slice(i, i + 50)
    groups = groups.concat(
      (await db.from("ur_group").select("id,feature_id,name,sort_order").in("feature_id", c)).data
    )
    urs = urs.concat(
      (
        await db
          .from("ur")
          .select("id,feature_id,ur_group_id,text,status,misimpl_reason,sort_order")
          .in("feature_id", c)
      ).data
    )
  }

  // old id -> new uuid
  const nid = new Map()
  const uid = (old) => {
    if (!nid.has(old)) nid.set(old, randomUUID())
    return nid.get(old)
  }
  const pid = randomUUID()
  const st = (cat) =>
    `(select id from status where project_id='${pid}' and category='${cat}' order by sort_order limit 1)`

  const L = []
  L.push("-- ===========================================================================")
  L.push("-- 0003 — 검증된 요구사항 데이터 정식 등록 (Tactica Defense)")
  L.push("--   컨텐츠/기능/세부기능/요구사항(+그룹)만. 작업(Task)·링크는 추후.")
  L.push("--   티켓 번호는 트리거가 INSERT 순서대로 부여(명시 안 함).")
  L.push("--   ※ 데이터 마이그레이션 — single source. seed-demo 스크립트는 폐기.")
  L.push("-- ===========================================================================")
  L.push("")
  L.push(`insert into project (id, name) values ('${pid}', ${q(PROJECT_NAME)});`)
  L.push("")
  L.push("-- 컨텐츠")
  L.push(
    `insert into node (id, project_id, parent_id, type, title, sort_order, status_id) values (` +
      `'${uid(content.id)}', '${pid}', null, '컨텐츠', ${q(content.title)}, ${content.sort_order}, ${st("할일")});`
  )
  L.push("")
  L.push("-- 기능")
  features.forEach((f) => {
    L.push(
      `insert into node (id, project_id, parent_id, type, title, sort_order, status_id) values (` +
        `'${uid(f.id)}', '${pid}', '${uid(content.id)}', '기능', ${q(f.title)}, ${f.sort_order}, ${st("할일")});`
    )
  })
  L.push("")
  L.push("-- 세부기능 (상태 = 기존 검증값)")
  features.forEach((f) => {
    subsByFeature(f.id).forEach((s) => {
      const cat = s.status?.category ?? "할일"
      L.push(
        `insert into node (id, project_id, parent_id, type, title, sort_order, status_id) values (` +
          `'${uid(s.id)}', '${pid}', '${uid(f.id)}', '세부기능', ${q(s.title)}, ${s.sort_order}, ${st(cat)});`
      )
    })
  })
  if (groups.length) {
    L.push("")
    L.push("-- UR 그룹")
    groups.forEach((g) => {
      L.push(
        `insert into ur_group (id, feature_id, name, sort_order) values (` +
          `'${uid(g.id)}', '${uid(g.feature_id)}', ${q(g.name)}, ${g.sort_order});`
      )
    })
  }
  L.push("")
  L.push("-- 요구사항(UR) — 세부기능 순서대로 (Requirement-1..N)")
  // 기능→세부기능→UR 순으로 정렬해 번호가 트리 순서를 따르게.
  const orderedUrs = []
  features.forEach((f) => {
    subsByFeature(f.id).forEach((s) => {
      urs
        .filter((u) => u.feature_id === s.id)
        .sort((a, b) => a.sort_order - b.sort_order)
        .forEach((u) => orderedUrs.push(u))
    })
  })
  orderedUrs.forEach((u) => {
    L.push(
      `insert into ur (id, feature_id, ur_group_id, text, status, misimpl_reason, sort_order) values (` +
        `'${uid(u.id)}', '${uid(u.feature_id)}', ${u.ur_group_id ? `'${uid(u.ur_group_id)}'` : "null"}, ` +
        `${q(u.text)}, ${q(u.status)}, ${q(u.misimpl_reason)}, ${u.sort_order});`
    )
  })
  L.push("")

  writeFileSync(OUT, L.join("\n"), "utf8")
  console.log(
    `생성: ${OUT}  (컨텐츠 1 / 기능 ${features.length} / 세부기능 ${subIds.length} / UR ${orderedUrs.length} / 그룹 ${groups.length})`
  )
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
