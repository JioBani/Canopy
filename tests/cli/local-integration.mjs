import { readFileSync, writeFileSync, unlinkSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
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

function cliFull(...args) {
  const result = spawnSync(process.execPath, ["cli/canopy.mjs", ...args, "--url", `${url}/rest/v1`.replace(/\/rest\/v1\/rest\/v1$/, "/rest/v1"), "--key", key, "--compact"], { cwd: process.cwd(), encoding: "utf8" })
  if (result.status !== 0) throw new Error(`canopy ${args.join(" ")} failed:\n${result.stderr || result.stdout}`)
  return JSON.parse(result.stdout)
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
  check(statuses.find((s) => s.category === "완료").icon === "circle-check", "default status icon missing")
  check(first(cli("status", "update", "--project", projectId, "--id", custom.id, "--icon", "loader")).icon === "loader", "status --icon update failed")
  const iconStatus = first(cli("status", "create", "--project", projectId, "--name", "아이콘", "--category", "할일", "--icon", "circle-dashed"))
  check(iconStatus.icon === "circle-dashed", "status create --icon failed")
  check(first(cli("status", "update", "--project", projectId, "--id", iconStatus.id, "--icon", "null")).icon === null, "status --icon null should clear")
  cli("status", "delete", "--project", projectId, "--id", iconStatus.id, "--yes")
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
  // 완결형 create: 시작/종료 지정 → duration 자동 계산(150분). 진행 중 세션과 무관해 공존 가능.
  const backfill = first(cli("work-log", "create", "--project", projectId, "--work", task.id, "--started", "2026-07-10T09:00:00Z", "--ended", "2026-07-10T11:30:00Z", "--note", "백필"))
  check(backfill.duration_minutes === 150, "backfilled work log duration should auto-compute to 150")
  check(cli("work-log", "list", "--project", projectId, "--work", task.id).length === 2, "work log missing")
  cli("work-log", "delete", "--project", projectId, "--id", backfill.id, "--yes")
  check(cli("work-log", "list", "--project", projectId, "--work", task.id).length === 1, "backfilled work log not deleted")
  step("work log start/stop/update/create/list")

  check(cli("report", "progress", "--project", projectId, "--node", task.id).length === 1, "progress report missing")
  check(cli("report", "coverage", "--project", projectId, "--feature", sub.id).length === 1, "coverage report missing")
  step("progress/coverage reports")

  // ── v1.1: 키 참조·이름 해석·필터·페이지네이션·일괄 작업·집계 ──
  const pid = projectId
  const subKey = `SubFeature-${sub.ticket_number}`
  const featKey = `Feature-${feature.ticket_number}`
  check(cli("node", "get", "--project", pid, "--id", `Task-${task.ticket_number}`).id === task.id, "node get by key failed")
  const listed = cli("node", "list", "--project", pid, "--type", "작업")
  check(listed.length === 1 && listed[0].body === undefined && listed[0].key === `Task-${task.ticket_number}` && listed[0].status === "진행중", `node list brief shape wrong: ${JSON.stringify(listed[0])}`)
  check(cli("node", "list", "--project", pid, "--type", "작업", "--full")[0].body === "CLI 통합 테스트", "node list --full missing body")
  check(cli("node", "list", "--project", pid, "--status", "진행중").length === 1, "status-name filter failed")
  check(cli("node", "list", "--project", pid, "--under", featKey).length === 3, "subtree filter failed")
  check(cli("node", "search", "--project", pid, "--query", "공격, (구현)").length === 0, "search with commas/parens must not break")
  const paged = cliFull("node", "list", "--project", pid, "--limit", "1")
  check(paged.data.length === 1 && paged.page.total === 4, `pagination meta wrong: ${JSON.stringify(paged.page)}`)

  const bulk = cli("node", "create", "--project", pid, "--parent", subKey, "--items", JSON.stringify([
    { type: "작업", title: "일괄 A", domain: "기획", status: "할일" },
    { type: "작업", title: "일괄 B", assignee: "CLI Agent Updated" },
  ]))
  check(bulk.length === 2 && bulk[1].sort_order === bulk[0].sort_order + 1 && bulk[1].assignee_id === memberId, "bulk node create failed")
  const bulkKeys = bulk.map((n) => `Task-${n.ticket_number}`)
  check(cli("node", "update", "--project", pid, "--ids", bulkKeys.join(","), "--status", "완료").every((n) => n.status === "완료"), "bulk node update failed")

  const lines = cli("node", "tree", "--project", pid, "--progress")
  check(lines.length === 6 && lines[0].startsWith("Content-") && lines.some((l) => l.includes("100%")), `tree output wrong: ${JSON.stringify(lines)}`)
  check(cli("node", "tree", "--project", pid, "--exclude-type", "작업").length === 3, "tree --exclude-type failed")

  const urs2 = cli("ur", "create", "--project", pid, "--feature", subKey, "--items", JSON.stringify([
    { text: "치명타가 적용된다", description: "## 히스토리\n- 최초" },
    { text: "회피가 적용된다", group: "핵심 요구사항" },
  ]))
  check(urs2.length === 2 && urs2[1].ur_group_id === group.id && urs2[0].key.startsWith("Requirement-"), "bulk UR create failed")
  const urKeys = urs2.map((u) => u.key)
  const groupKey = `RequirementGroup-${group.ticket_number}`
  check(typeof group.ticket_number === "number", "ur-group create must return ticket_number")
  check(cli("ur-group", "get", "--project", pid, "--id", groupKey).id === group.id, "ur-group get by key failed")
  check(cli("ur-group", "list", "--project", pid, "--feature", subKey)[0].key === groupKey, "ur-group list key missing")
  check(cli("ur", "list", "--project", pid, "--group", groupKey).length === 2, "ur list --group by key failed")
  const uncovered = cli("ur", "list", "--project", pid, "--uncovered")
  check(uncovered.length === 2 && uncovered[0].description === undefined, `uncovered filter wrong: ${JSON.stringify(uncovered)}`)
  check(cli("ur", "list", "--project", pid, "--under", featKey, "--status", "완료").length === 1, "UR status+under filter failed")
  check(cli("ur", "search", "--project", pid, "--query", "히스토리").length === 1, "UR description search failed")
  const linkRes = cli("ur-link", "create", "--project", pid, "--ur", urKeys.join(","), "--work", bulkKeys[0])
  check(linkRes.created === 2, "bulk link failed")
  check(cli("ur-link", "create", "--project", pid, "--ur", urKeys[0], "--work", bulkKeys[0]).created === 0, "duplicate link should be ignored")
  check(cli("ur", "list", "--project", pid, "--uncovered").length === 0, "links should cover URs")
  check(cli("ur-link", "list", "--project", pid, "--feature", subKey).length === 3, "ur-link list by feature failed")
  const urGot = cli("ur", "get", "--project", pid, "--id", urKeys[0])
  check(urGot.description.includes("히스토리") && urGot.works.length === 1, "ur get with works failed")
  cli("ur", "update", "--project", pid, "--ids", urKeys.join(","), "--status", "오구현", "--misimpl-reason", "범위 누락")
  check(cli("ur", "update", "--project", pid, "--id", urKeys[0], "--status", "완료")[0].misimpl_reason === null, "status change should clear misimpl_reason")

  // JSON 옵션 @파일 / stdin (Windows PowerShell 5.1 따옴표 제거 우회)
  const tmpJson = join(tmpdir(), `canopy-items-${Date.now()}.json`)
  writeFileSync(tmpJson, "﻿" + JSON.stringify(["a"]))
  cli("checklist", "create", "--project", pid, "--work", bulkKeys[0], "--items", `@${tmpJson}`)
  unlinkSync(tmpJson)
  const piped = spawnSync(process.execPath, ["cli/canopy.mjs", "checklist", "create", "--project", pid, "--work", bulkKeys[0], "--items", "-", "--url", `${url}/rest/v1`, "--key", key], { encoding: "utf8", input: JSON.stringify([{ text: "b", done: true }]) })
  check(piped.status === 0 && JSON.parse(piped.stdout).data[0].done === true, `stdin --items failed: ${piped.stderr}`)
  const stripped = spawnSync(process.execPath, ["cli/canopy.mjs", "node", "update", "--project", pid, "--id", bulkKeys[0], "--json", "{title:x}", "--url", `${url}/rest/v1`, "--key", key], { encoding: "utf8" })
  check(stripped.status !== 0 && stripped.stderr.includes("@file.json"), "stripped-quote JSON should explain the PowerShell workaround")
  const shown = cli("node", "show", "--project", pid, "--id", bulkKeys[0])
  check(shown.path.length === 3 && shown.checklist.length === 2 && shown.urs.length === 2, `node show (작업) wrong: ${JSON.stringify(shown)}`)
  const shownSub = cli("node", "show", "--project", pid, "--id", subKey)
  check(shownSub.urs.length === 3 && shownSub.children.length === 3 && shownSub.progress.total_urs === 3, "node show (세부기능) wrong")

  cli("node-link", "create", "--project", pid, "--from", bulkKeys[0], "--to", bulkKeys[1], "--type", "blocks")
  check(cli("node-link", "list", "--project", pid, "--to", bulkKeys[1])[0].from_key === bulkKeys[0], "incoming node link failed")
  check(cli("node-link", "list", "--project", pid, "--node", bulkKeys[1]).length === 1, "node-link --node failed")
  cli("node-link", "delete", "--project", pid, "--from", bulkKeys[0], "--to", bulkKeys[1], "--type", "blocks", "--yes")

  const mover = first(cli("node", "create", "--project", pid, "--parent", featKey, "--type", "세부기능", "--title", "이동 대상"))
  cli("node", "move", "--project", pid, "--id", bulkKeys[1], "--parent", `SubFeature-${mover.ticket_number}`)
  check(cli("node", "get", "--project", pid, "--id", bulkKeys[1]).parent_id === mover.id, "node move failed")
  const badMove = spawnSync(process.execPath, ["cli/canopy.mjs", "node", "move", "--project", pid, "--id", bulkKeys[1], "--parent", featKey, "--url", `${url}/rest/v1`, "--key", key], { encoding: "utf8" })
  check(badMove.status !== 0, "hierarchy violation on move must fail")
  cli("ur", "update", "--project", pid, "--id", urKeys[1], "--feature-id", `SubFeature-${mover.ticket_number}`)
  check(cli("ur", "list", "--project", pid, "--feature", `SubFeature-${mover.ticket_number}`)[0].ur_group_id === null, "UR move should clear group")

  cli("work-log", "start", "--project", pid, "--work", bulkKeys[0], "--member", "CLI Agent Updated")
  check(cli("work-log", "list", "--project", pid, "--active").length === 1, "active work log filter failed")
  cli("work-log", "stop", "--project", pid, "--work", bulkKeys[0])
  check(cli("work-log", "list", "--project", pid, "--member", "CLI Agent Updated").length === 2, "project-wide work log member filter failed")
  const time = cli("report", "time", "--project", pid)
  check(time.log_count === 2 && time.by_member["CLI Agent Updated"] !== undefined, `time report wrong: ${JSON.stringify(time)}`)

  const summary = cli("report", "summary", "--project", pid)
  check(summary.urs.total === 3 && summary.nodes["작업"] === 3 && summary.contents.length === 1, `summary wrong: ${JSON.stringify(summary)}`)
  check(cli("report", "progress", "--project", pid).length === 4, "progress list failed")
  const found = cli("search", "--project", pid, "--query", "치명타")
  check(found.urs.total === 1 && found.nodes.total === 0, "unified search failed")
  check(cli("search", "--project", pid, "--query", bulkKeys[0]).nodes.items[0].key === bulkKeys[0], "search by key failed")
  check(cli("status", "get", "--project", pid, "--id", "할일").category === "할일", "status by name failed")
  cli("node", "delete", "--project", pid, "--id", `SubFeature-${mover.ticket_number}`, "--yes")
  for (const k of [bulkKeys[0]]) cli("node", "delete", "--project", pid, "--id", k, "--yes")
  cli("ur", "delete", "--project", pid, "--ids", urKeys[0], "--yes")
  step("v1.1 keys/filters/pagination/bulk/tree/show/move/search/reports")

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
