import { readFileSync } from "node:fs"
import { spawnSync } from "node:child_process"

function loadEnv(path) {
  const result = {}
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const at = trimmed.indexOf("=")
    if (at > 0) result[trimmed.slice(0, at)] = trimmed.slice(at + 1).replace(/^['"]|['"]$/g, "")
  }
  return result
}

const fileEnv = loadEnv(".env.e2e")
const url = process.env.CANOPY_LOCAL_URL || fileEnv.VITE_SUPABASE_URL || "http://127.0.0.1:54621"
const key = process.env.CANOPY_LOCAL_KEY || fileEnv.VITE_SUPABASE_ANON_KEY
if (!key) throw new Error("CANOPY_LOCAL_KEY or VITE_SUPABASE_ANON_KEY in .env.e2e is required")

function cli(...args) {
  const result = spawnSync(process.execPath, ["cli/canopy.mjs", ...args, "--url", `${url}/rest/v1`.replace(/\/rest\/v1\/rest\/v1$/, "/rest/v1"), "--key", key, "--compact"], {
    cwd: process.cwd(), encoding: "utf8",
  })
  if (result.status !== 0) throw new Error(`canopy ${args.join(" ")} failed:\n${result.stderr || result.stdout}`)
  const parsed = JSON.parse(result.stdout)
  return parsed.data
}

const first = (data) => Array.isArray(data) ? data[0] : data
const name = `CLI Local ${Date.now()}`
let projectId = null
let memberId = null

function check(condition, message) { if (!condition) throw new Error(message) }
function step(message) { console.log(`PASS ${message}`) }

try {
  const createdProject = first(cli("project", "create", "--name", name))
  projectId = createdProject.id
  check(projectId, "project id missing")
  step("project create")

  const gotProject = cli("project", "get", "--project", projectId)
  check(gotProject.id === projectId, "project get mismatch")
  cli("project", "update", "--project", projectId, "--name", `${name} renamed`)
  step("project get/update")

  const member = first(cli("member", "create", "--name", "CLI Agent", "--color", "#123456"))
  memberId = member.id
  cli("member", "update", "--id", memberId, "--json", JSON.stringify({ display_name: "CLI Agent Updated" }))
  check(cli("member", "get", "--id", memberId).display_name === "CLI Agent Updated", "member update mismatch")
  step("member CRUD")

  const statuses = cli("status", "list", "--project", projectId)
  check(statuses.length === 4, "default statuses were not seeded")
  const todo = statuses.find((s) => s.category === "할일")
  const doing = statuses.find((s) => s.category === "진행중")
  const custom = first(cli("status", "create", "--project", projectId, "--name", "검토", "--category", "진행중", "--color", "#abcdef", "--sort-order", "10"))
  cli("status", "update", "--project", projectId, "--id", custom.id, "--json", JSON.stringify({ name: "검토중" }))
  step("status list/create/update")

  const content = first(cli("node", "create", "--project", projectId, "--parent", "null", "--type", "컨텐츠", "--title", "테스트 게임", "--status", todo.id))
  const feature = first(cli("node", "create", "--project", projectId, "--parent", content.id, "--type", "기능", "--title", "전투", "--status", todo.id))
  const sub = first(cli("node", "create", "--project", projectId, "--parent", feature.id, "--type", "세부기능", "--title", "공격", "--status", todo.id))
  const task = first(cli("node", "create", "--project", projectId, "--parent", sub.id, "--type", "작업", "--title", "공격 구현", "--status", custom.id, "--domain", "구현", "--assignee", memberId))
  const disposableTask = first(cli("node", "create", "--project", projectId, "--parent", sub.id, "--type", "작업", "--title", "삭제 검증", "--status", todo.id))
  cli("node", "update", "--project", projectId, "--id", task.id, "--json", JSON.stringify({ body: "CLI 통합 테스트", status_id: doing.id, time_spent_minutes: 5 }))
  check(cli("node", "search", "--project", projectId, "--query", "공격").length >= 2, "node search failed")
  cli("node", "delete", "--project", projectId, "--id", disposableTask.id, "--yes")
  step("node tree create/search/update/delete")

  const priorityOptions = cli("priority", "list", "--project", projectId)
  check(priorityOptions.length === 6, "priority options were not seeded")
  cli("priority", "set", "--project", projectId, "--node", task.id, "--value", "높음")
  check(cli("priority", "get", "--project", projectId, "--node", task.id).value === "높음", "priority set failed")
  const customField = first(cli("field", "create", "--project", projectId, "--field-key", "qa_note", "--label", "QA 메모", "--type", "text", "--applies-to", "작업"))
  cli("field-value", "set", "--project", projectId, "--node", task.id, "--field", customField.id, "--value", "통합 테스트")
  const allFields = cli("field-value", "list", "--project", projectId, "--node", task.id)
  check(allFields.priority === "높음" && allFields.qa_note === "통합 테스트", `field merge did not preserve values: ${JSON.stringify(allFields)}`)
  cli("field-value", "clear", "--project", projectId, "--node", task.id, "--field", "qa_note")
  cli("field", "delete", "--project", projectId, "--field", customField.id, "--yes")
  cli("priority", "clear", "--project", projectId, "--node", task.id)
  step("custom field and priority CRUD/merge")

  const group = first(cli("ur-group", "create", "--project", projectId, "--feature", sub.id, "--name", "기본 요구사항"))
  cli("ur-group", "update", "--project", projectId, "--id", group.id, "--name", "핵심 요구사항")
  const ur = first(cli("ur", "create", "--project", projectId, "--feature", sub.id, "--group", group.id, "--text", "공격 피해가 적용된다"))
  cli("ur", "update", "--project", projectId, "--id", ur.id, "--json", JSON.stringify({ status: "완료", misimpl_reason: null }))
  cli("ur-link", "create", "--project", projectId, "--ur", ur.id, "--work", task.id)
  check(cli("ur-link", "list", "--project", projectId, "--work", task.id).length === 1, "UR link missing")
  step("UR group/UR/work link")

  const item = first(cli("checklist", "create", "--project", projectId, "--work", task.id, "--text", "단위 테스트"))
  cli("checklist", "update", "--project", projectId, "--id", item.id, "--done", "true")
  check(cli("checklist", "get", "--project", projectId, "--id", item.id).done === true, "checklist update failed")
  step("checklist CRUD")

  const relation = first(cli("node-link", "create", "--project", projectId, "--from", task.id, "--to", sub.id, "--type", "relates"))
  check(cli("node-link", "list", "--project", projectId, "--from", task.id).length === 1, "node link missing")
  cli("node-link", "delete", "--project", projectId, "--id", relation.id, "--yes")
  step("node link CRUD")

  const log = first(cli("work-log", "start", "--project", projectId, "--work", task.id, "--member", memberId, "--note", "로컬 테스트"))
  cli("work-log", "stop", "--project", projectId, "--id", log.id)
  cli("work-log", "update", "--project", projectId, "--id", log.id, "--json", JSON.stringify({ note: "로컬 테스트 완료", duration_minutes: 1 }))
  check(cli("work-log", "list", "--project", projectId, "--work", task.id).length === 1, "work log missing")
  step("work log start/stop/update/list")

  check(cli("report", "progress", "--project", projectId, "--node", task.id).length === 1, "progress report missing")
  check(cli("report", "coverage", "--project", projectId, "--feature", sub.id).length === 1, "coverage report missing")
  step("progress/coverage reports")

  cli("status", "reassign", "--project", projectId, "--id", custom.id, "--to", todo.id)
  cli("status", "delete", "--project", projectId, "--id", custom.id, "--yes")
  cli("ur-link", "delete", "--project", projectId, "--ur", ur.id, "--work", task.id)
  cli("checklist", "delete", "--project", projectId, "--id", item.id, "--yes")
  cli("work-log", "delete", "--project", projectId, "--id", log.id, "--yes")
  cli("ur", "delete", "--project", projectId, "--id", ur.id, "--yes")
  cli("ur-group", "delete", "--project", projectId, "--id", group.id, "--yes")
  step("resource delete paths")
} finally {
  if (projectId) {
    try { cli("project", "delete", "--project", projectId, "--yes"); step("temporary project cleanup") }
    catch (error) { console.error(`CLEANUP project failed: ${error.message}`); process.exitCode = 1 }
  }
  if (memberId) {
    try { cli("member", "delete", "--id", memberId, "--yes"); step("temporary member cleanup") }
    catch (error) { console.error(`CLEANUP member failed: ${error.message}`); process.exitCode = 1 }
  }
}
