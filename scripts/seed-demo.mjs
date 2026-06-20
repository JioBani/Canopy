// 데모용 테스트 데이터 시드 — 로컬 Supabase 대상.
// 출처: C:\Project\tactica-defense-resources\decompose\완료정의-점검\01~07.md
// 매핑: 전장(컨텐츠) > 파일(기능) > [Task](세부기능 + ur_group) > 요구사항(UR + 작업, 링크)
//   작업 상태: [x]→완료 / 미구현→할일 / 오구현→진행중  (완료정의 보존)
// 실행: node scripts/seed-demo.mjs   (npx supabase start 로 로컬 스택이 떠 있어야 함)

import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"

const URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54621"
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"

const SRC_DIR = "C:/Project/tactica-defense-resources/decompose/완료정의-점검"
const PROJECT_NAME = "Tatica Defense"
const PROJECT_PREFIX = "TACD"

const db = createClient(URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function ins(table, rows, columns = "*") {
  const { data, error } = await db.from(table).insert(rows).select(columns)
  if (error) throw new Error(`${table} insert 실패: ${error.message}`)
  return data
}
async function insOne(table, row, columns = "*") {
  return (await ins(table, [row], columns))[0]
}

// ── 마크다운 파싱 ────────────────────────────────────────────
function parseFile(content) {
  const lines = content.split(/\r?\n/)
  const feature =
    /\[전장\s*-\s*(.+?)\]/.exec(lines[0] ?? "")?.[1]?.trim() ?? "기능"
  const tasks = []
  let cur = null
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const taskM = /^##\s*\[Task\]\s*\[전장\s*-\s*[^\]]+?\s*-\s*([^\]]+?)\]/.exec(
      line
    )
    if (taskM) {
      cur = { name: taskM[1].trim(), reqs: [] }
      tasks.push(cur)
      continue
    }
    const reqM = /^(\s*)-\s*\[( |x|X)\]\s+(.+?)\s*$/.exec(line)
    if (reqM && cur) {
      const indent = reqM[1].length
      const checked = reqM[2].toLowerCase() === "x"
      const text = reqM[3].trim()
      let reason = null
      const nl = lines[i + 1]
      if (nl && nl.trim() !== "") {
        const nlIndent = (nl.match(/^\s*/)?.[0] ?? "").length
        if (nlIndent > indent && /^\s*-\s+/.test(nl) && !/\[( |x|X)\]/.test(nl)) {
          reason = nl.replace(/^\s*-\s+/, "").trim()
        }
      }
      cur.reqs.push({ checked, text, reason })
    }
  }
  return { feature, tasks: tasks.filter((t) => t.reqs.length > 0) }
}

// 작업(node)의 작업상태 — 보드/진행바 데모용
function statusFor(req, statusByCat) {
  if (req.checked) return statusByCat["완료"]
  if (req.reason && req.reason.startsWith("오구현")) return statusByCat["진행중"]
  return statusByCat["할일"] // 미구현/기타
}

// UR 의 수동 상태 (완료/미구현/오구현) — 완료정의 보존
function urStatusFor(req) {
  if (req.checked) return "완료"
  if (req.reason && req.reason.startsWith("오구현")) return "오구현"
  return "미구현"
}

async function main() {
  // 멱등: 같은 이름 프로젝트가 있으면 지우고 새로 (사용자의 다른 프로젝트는 건드리지 않음)
  const { data: existing } = await db
    .from("project")
    .select("id")
    .eq("name", PROJECT_NAME)
  if (existing?.length) {
    await db.from("project").delete().eq("name", PROJECT_NAME)
    console.log(`기존 '${PROJECT_NAME}' 프로젝트 ${existing.length}개 삭제`)
  }

  const project = await insOne(
    "project",
    { name: PROJECT_NAME, key_prefix: PROJECT_PREFIX },
    "id"
  )
  console.log(`프로젝트 생성: ${PROJECT_NAME} (${project.id})`)

  const statuses = await db
    .from("status")
    .select("id, category")
    .eq("project_id", project.id)
  const statusByCat = {}
  for (const s of statuses.data) statusByCat[s.category] = s.id

  const content = await insOne(
    "node",
    { project_id: project.id, type: "컨텐츠", title: "전장", sort_order: 0 },
    "id"
  )

  const files = readdirSync(SRC_DIR)
    .filter((f) => /^\d+ .+\.md$/.test(f))
    .sort()

  let counts = { feature: 0, sub: 0, task: 0, ur: 0, link: 0 }

  for (let fi = 0; fi < files.length; fi++) {
    const parsed = parseFile(readFileSync(path.join(SRC_DIR, files[fi]), "utf8"))
    const feature = await insOne(
      "node",
      {
        project_id: project.id,
        type: "기능",
        title: parsed.feature,
        parent_id: content.id,
        sort_order: fi,
      },
      "id"
    )
    counts.feature++

    for (let ti = 0; ti < parsed.tasks.length; ti++) {
      const task = parsed.tasks[ti]
      const sub = await insOne(
        "node",
        {
          project_id: project.id,
          type: "세부기능",
          title: task.name,
          parent_id: feature.id,
          sort_order: ti,
        },
        "id"
      )
      counts.sub++

      // UR 들 (세부기능 소유, status 매핑) — 순서 보존
      const urRows = await ins(
        "ur",
        task.reqs.map((r, idx) => ({
          feature_id: sub.id, // 세부기능 소유 (컬럼명은 feature_id 유지)
          ur_group_id: null,
          text: r.text,
          status: urStatusFor(r),
          misimpl_reason:
            !r.checked && r.reason && r.reason.startsWith("오구현")
              ? r.reason
              : null,
          sort_order: idx,
        })),
        "id"
      )
      counts.ur += urRows.length

      // 작업 들 (순서 동일)
      const taskRows = await ins(
        "node",
        task.reqs.map((r, idx) => ({
          project_id: project.id,
          type: "작업",
          title: r.text,
          body: r.reason,
          parent_id: sub.id,
          status_id: statusFor(r, statusByCat),
          domain: "구현",
          sort_order: idx,
        })),
        "id"
      )
      counts.task += taskRows.length

      // UR ↔ 작업 링크 (index 짝)
      const links = urRows.map((u, idx) => ({
        ur_id: u.id,
        work_id: taskRows[idx].id,
      }))
      await ins("ur_work_link", links, "id")
      counts.link += links.length
    }
    console.log(`  ${parsed.feature}: 세부기능 ${parsed.tasks.length}`)
  }

  console.log("완료:", JSON.stringify(counts))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
