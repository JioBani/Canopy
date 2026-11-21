#!/usr/bin/env node

const DEFAULT_URL = "https://canopy-api.lnk.sarl/rest/v1"
const DEFAULT_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzk1MjY0MDc1LCJleHAiOjE5NTI5NDQwNzV9.3Rj3Z3OhIScmh70Dk1gF-S01O8axKT8nZ8HmyQBrR70"
const WRITABLE = new Set([
  "project", "member", "status", "node", "ur_group", "ur", "ur_work_link",
  "task_checklist", "node_link", "work_log", "field_def",
])
const READABLE = new Set([...WRITABLE, "node_progress", "ur_coverage"])

function fail(message, code = 1) {
  console.error(JSON.stringify({ ok: false, error: message }, null, 2))
  process.exit(code)
}

function parse(argv) {
  const positional = []
  const options = {}
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]
    if (!token.startsWith("--")) { positional.push(token); continue }
    const eq = token.indexOf("=")
    const key = token.slice(2, eq < 0 ? undefined : eq)
    if (eq >= 0) options[key] = token.slice(eq + 1)
    else if (argv[i + 1] && !argv[i + 1].startsWith("--")) options[key] = argv[++i]
    else options[key] = true
  }
  return { positional, options }
}

const { positional, options } = parse(process.argv.slice(2))
const [group, action] = positional
const base = String(options.url || process.env.CANOPY_URL || DEFAULT_URL).replace(/\/$/, "")
const key = String(options.key || process.env.CANOPY_KEY || DEFAULT_KEY)

function value(name, required = false) {
  const v = options[name]
  if (required && (v === undefined || v === true || v === "")) fail(`--${name} is required`)
  return v
}

function bool(v) {
  if (typeof v === "boolean") return v
  if (v === "true") return true
  if (v === "false") return false
  fail(`Expected true or false, received: ${v}`)
}

function integer(v, name) {
  const n = Number(v)
  if (!Number.isInteger(n)) fail(`--${name} must be an integer`)
  return n
}

function nullable(v) { return v === "null" || v === "none" ? null : v }

function jsonOption(name = "json", required = false) {
  const raw = value(name, required)
  if (raw === undefined) return undefined
  try { return JSON.parse(String(raw)) } catch { fail(`--${name} must be valid JSON`) }
}

async function request(table, { method = "GET", query = {}, body, prefer } = {}) {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v))
  }
  const response = await fetch(`${base}/${table}${qs.size ? `?${qs}` : ""}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(prefer ? { Prefer: prefer } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const text = await response.text()
  let data = null
  if (text) { try { data = JSON.parse(text) } catch { data = text } }
  if (!response.ok) {
    const detail = typeof data === "object" ? data?.message || JSON.stringify(data) : data
    fail(`${method} ${table} failed (${response.status}): ${detail}`)
  }
  return data
}

function output(data) {
  if (options.quiet) return
  console.log(JSON.stringify({ ok: true, data }, null, options.compact ? 0 : 2))
}

async function one(table, query, label = table) {
  const rows = await request(table, { query: { ...query, limit: 2 } })
  if (!rows?.length) fail(`${label} not found`)
  if (rows.length > 1) fail(`${label} is ambiguous; use a UUID`)
  return rows[0]
}

async function project() {
  const ref = value("project", true)
  const isId = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(String(ref))
  return one("project", isId ? { id: `eq.${ref}` } : { name: `eq.${ref}` }, "project")
}

async function assertNodeInProject(id, p, expectedType) {
  const n = await one("node", { id: `eq.${id}`, project_id: `eq.${p.id}` }, "node")
  if (expectedType && n.type !== expectedType) fail(`node ${id} must be type ${expectedType}`)
  return n
}

async function assertUrInProject(id, p) {
  const u = await one("ur", { id: `eq.${id}`, select: "*,node:feature_id!inner(project_id)", "node.project_id": `eq.${p.id}` }, "UR")
  return u
}

async function assertStatusInProject(id, p) {
  if (id === null || id === undefined) return null
  return one("status", { id: `eq.${id}`, project_id: `eq.${p.id}` }, "status")
}

async function assertUrGroupInProject(id, p) {
  if (id === null || id === undefined) return null
  return one("ur_group", { id: `eq.${id}`, select: "*,node:feature_id!inner(project_id)", "node.project_id": `eq.${p.id}` }, "UR group")
}

async function fieldDef(p, ref) {
  const isId = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(String(ref))
  return one("field_def", isId
    ? { id: `eq.${ref}`, project_id: `eq.${p.id}` }
    : { key: `eq.${ref}`, project_id: `eq.${p.id}` }, "field definition")
}

function parseFieldValue(def, raw, explicitJson) {
  let v
  if (explicitJson !== undefined) v = explicitJson
  else if (def.type === "number") {
    v = Number(raw)
    if (!Number.isFinite(v)) fail(`field ${def.key} requires a number`)
  } else if (def.type === "bool") v = bool(raw)
  else if (def.type === "multiselect") v = String(raw).split(",").map((x) => x.trim()).filter(Boolean)
  else v = String(raw)
  if (def.type === "select" && !def.options.some((o) => o.value === v)) fail(`field ${def.key} must be one of: ${def.options.map((o) => o.value).join(", ")}`)
  if (def.type === "multiselect") {
    if (!Array.isArray(v)) fail(`field ${def.key} requires an array or comma-separated values`)
    const allowed = new Set(def.options.map((o) => o.value))
    const bad = v.filter((x) => !allowed.has(x))
    if (bad.length) fail(`field ${def.key} has invalid values: ${bad.join(", ")}`)
  }
  if (def.type === "date" && Number.isNaN(Date.parse(v))) fail(`field ${def.key} requires a date`)
  return v
}

function requireYes(label) {
  if (!options.yes) fail(`${label} is destructive; pass --yes to continue`)
}

function patchFrom(allowed) {
  const raw = jsonOption("json") || {}
  for (const name of allowed) {
    const cliName = name.replaceAll("_", "-")
    const v = options[name] ?? options[cliName]
    if (v !== undefined) raw[name] = nullable(v)
  }
  return raw
}

async function projects() {
  if (action === "list") return output(await request("project", { query: { order: "created_at.asc" } }))
  if (action === "create") return output(await request("project", { method: "POST", body: { name: value("name", true) }, prefer: "return=representation" }))
  const p = await project()
  if (action === "get") return output(p)
  if (action === "update") return output(await request("project", { method: "PATCH", query: { id: `eq.${p.id}` }, body: patchFrom(["name"]), prefer: "return=representation" }))
  if (action === "delete") { requireYes("project delete (all project data cascades)"); await request("project", { method: "DELETE", query: { id: `eq.${p.id}` } }); return output({ deleted: p.id }) }
  fail("project action: list|get|create|update|delete")
}

async function members() {
  if (action === "list") return output(await request("member", { query: { order: "created_at.asc" } }))
  if (action === "create") return output(await request("member", { method: "POST", body: { display_name: value("name", true), color: nullable(value("color")) }, prefer: "return=representation" }))
  const id = value("id", true)
  if (action === "get") return output(await one("member", { id: `eq.${id}` }, "member"))
  if (action === "update") return output(await request("member", { method: "PATCH", query: { id: `eq.${id}` }, body: patchFrom(["display_name", "color"]), prefer: "return=representation" }))
  if (action === "delete") { requireYes("member delete"); await request("member", { method: "DELETE", query: { id: `eq.${id}` } }); return output({ deleted: id }) }
  fail("member action: list|get|create|update|delete")
}

async function statuses() {
  const p = await project()
  if (action === "list") return output(await request("status", { query: { project_id: `eq.${p.id}`, order: "sort_order.asc" } }))
  if (action === "create") {
    const body = { project_id: p.id, name: value("name", true), category: value("category", true), color: nullable(value("color")), sort_order: integer(value("sort-order") || 0, "sort-order") }
    return output(await request("status", { method: "POST", body, prefer: "return=representation" }))
  }
  const id = value("id", true)
  await one("status", { id: `eq.${id}`, project_id: `eq.${p.id}` }, "status")
  if (action === "update") return output(await request("status", { method: "PATCH", query: { id: `eq.${id}`, project_id: `eq.${p.id}` }, body: patchFrom(["name", "category", "color", "sort_order"]), prefer: "return=representation" }))
  if (action === "reassign") { const to = nullable(value("to", true)); await assertStatusInProject(to, p); await request("node", { method: "PATCH", query: { project_id: `eq.${p.id}`, status_id: `eq.${id}` }, body: { status_id: to } }); return output({ from: id, to }) }
  if (action === "delete") { requireYes("status delete"); await request("status", { method: "DELETE", query: { id: `eq.${id}`, project_id: `eq.${p.id}` } }); return output({ deleted: id }) }
  fail("status action: list|create|update|reassign|delete")
}

async function nodes() {
  const p = await project()
  if (action === "list" || action === "search") {
    const q = { project_id: `eq.${p.id}`, order: options.order || "sort_order.asc,created_at.asc" }
    if (options.type) q.type = `eq.${options.type}`
    if (options.parent) q.parent_id = `eq.${options.parent}`
    if (options.status) q.status_id = `eq.${options.status}`
    if (options.assignee) q.assignee_id = `eq.${options.assignee}`
    if (options.query) q.or = `(title.ilike.*${options.query}*,body.ilike.*${options.query}*)`
    return output(await request("node", { query: q }))
  }
  if (action === "create") {
    const parent = nullable(value("parent", true)); const status = nullable(value("status"))
    if (parent) await assertNodeInProject(parent, p); await assertStatusInProject(status, p)
    const body = { project_id: p.id, parent_id: parent, type: value("type", true), title: value("title", true), sort_order: integer(value("sort-order") || 0, "sort-order"), status_id: status }
    for (const x of ["body", "domain"]) if (options[x] !== undefined) body[x] = nullable(options[x])
    if (options.assignee !== undefined) body.assignee_id = nullable(options.assignee)
    return output(await request("node", { method: "POST", body, prefer: "return=representation" }))
  }
  const id = value("id", true)
  const n = await assertNodeInProject(id, p)
  if (action === "get") return output(n)
  if (action === "update") {
    const body = patchFrom(["title", "body", "sort_order", "status_id", "domain", "assignee_id", "time_spent_minutes"])
    if (body.status_id !== undefined) await assertStatusInProject(body.status_id, p)
    return output(await request("node", { method: "PATCH", query: { id: `eq.${id}`, project_id: `eq.${p.id}` }, body, prefer: "return=representation" }))
  }
  if (action === "delete") { requireYes("node delete (descendants cascade)"); await request("node", { method: "DELETE", query: { id: `eq.${id}`, project_id: `eq.${p.id}` } }); return output({ deleted: id }) }
  fail("node action: list|search|get|create|update|delete")
}

async function urGroups() {
  const p = await project(); const feature = value("feature")
  if (feature) await assertNodeInProject(feature, p, "세부기능")
  if (action === "list") return output(await request("ur_group", { query: { feature_id: `eq.${value("feature", true)}`, order: "sort_order.asc" } }))
  if (action === "create") return output(await request("ur_group", { method: "POST", body: { feature_id: value("feature", true), name: value("name", true), sort_order: integer(value("sort-order") || 0, "sort-order") }, prefer: "return=representation" }))
  const id = value("id", true); const g = await one("ur_group", { id: `eq.${id}`, select: "*,node:feature_id!inner(project_id)", "node.project_id": `eq.${p.id}` }, "UR group")
  if (action === "get") return output(g)
  if (action === "update") return output(await request("ur_group", { method: "PATCH", query: { id: `eq.${id}` }, body: patchFrom(["name", "sort_order"]), prefer: "return=representation" }))
  if (action === "delete") { requireYes("UR group delete"); await request("ur_group", { method: "DELETE", query: { id: `eq.${id}` } }); return output({ deleted: id }) }
  fail("ur-group action: list|get|create|update|delete")
}

async function urs() {
  const p = await project(); const feature = value("feature")
  if (feature) await assertNodeInProject(feature, p, "세부기능")
  if (action === "list") return output(await request("ur", { query: { feature_id: `eq.${value("feature", true)}`, order: "sort_order.asc" } }))
  if (action === "create") { const groupId = nullable(value("group")); await assertUrGroupInProject(groupId, p); return output(await request("ur", { method: "POST", body: { feature_id: value("feature", true), ur_group_id: groupId, text: value("text", true), sort_order: integer(value("sort-order") || 0, "sort-order") }, prefer: "return=representation" })) }
  const id = value("id", true); const u = await assertUrInProject(id, p)
  if (action === "get") return output(u)
  if (action === "update") { const body = patchFrom(["text", "ur_group_id", "sort_order", "status", "misimpl_reason"]); if (body.ur_group_id !== undefined) await assertUrGroupInProject(body.ur_group_id, p); return output(await request("ur", { method: "PATCH", query: { id: `eq.${id}` }, body, prefer: "return=representation" })) }
  if (action === "delete") { requireYes("UR delete"); await request("ur", { method: "DELETE", query: { id: `eq.${id}` } }); return output({ deleted: id }) }
  fail("ur action: list|get|create|update|delete")
}

async function urLinks() {
  const p = await project(); const ur = value("ur"); const work = value("work")
  if (ur) await assertUrInProject(ur, p); if (work) await assertNodeInProject(work, p, "작업")
  if (action === "list") return output(await request("ur_work_link", { query: ur ? { ur_id: `eq.${ur}` } : { work_id: `eq.${value("work", true)}` } }))
  if (action === "create") return output(await request("ur_work_link", { method: "POST", body: { ur_id: value("ur", true), work_id: value("work", true) }, prefer: "return=representation" }))
  if (action === "delete") { await request("ur_work_link", { method: "DELETE", query: { ur_id: `eq.${value("ur", true)}`, work_id: `eq.${value("work", true)}` } }); return output({ unlinked: true }) }
  fail("ur-link action: list|create|delete")
}

async function checklist() {
  const p = await project(); const work = value("work")
  if (work) await assertNodeInProject(work, p, "작업")
  if (action === "list") return output(await request("task_checklist", { query: { work_id: `eq.${value("work", true)}`, order: "sort_order.asc" } }))
  if (action === "create") return output(await request("task_checklist", { method: "POST", body: { work_id: value("work", true), text: value("text", true), sort_order: integer(value("sort-order") || 0, "sort-order") }, prefer: "return=representation" }))
  const id = value("id", true); const item = await one("task_checklist", { id: `eq.${id}`, select: "*,node:work_id!inner(project_id)", "node.project_id": `eq.${p.id}` }, "checklist item")
  if (action === "get") return output(item)
  if (action === "update") { const body = patchFrom(["text", "sort_order"]); if (options.done !== undefined) body.done = bool(options.done); return output(await request("task_checklist", { method: "PATCH", query: { id: `eq.${id}` }, body, prefer: "return=representation" })) }
  if (action === "delete") { requireYes("checklist delete"); await request("task_checklist", { method: "DELETE", query: { id: `eq.${id}` } }); return output({ deleted: id }) }
  fail("checklist action: list|get|create|update|delete")
}

async function nodeLinks() {
  const p = await project(); const from = value("from"); const to = value("to")
  if (from) await assertNodeInProject(from, p); if (to) await assertNodeInProject(to, p)
  if (action === "list") return output(await request("node_link", { query: { from_node_id: `eq.${value("from", true)}`, ...(options.type ? { type: `eq.${options.type}` } : {}) } }))
  if (action === "create") return output(await request("node_link", { method: "POST", body: { from_node_id: value("from", true), to_node_id: value("to", true), type: value("type", true) }, prefer: "return=representation" }))
  if (action === "delete") { requireYes("node link delete"); const id = value("id", true); await one("node_link", { id: `eq.${id}`, select: "*,node:from_node_id!inner(project_id)", "node.project_id": `eq.${p.id}` }, "node link"); await request("node_link", { method: "DELETE", query: { id: `eq.${id}` } }); return output({ deleted: id }) }
  fail("node-link action: list|create|delete")
}

async function workLogs() {
  const p = await project(); const work = value("work")
  if (work) await assertNodeInProject(work, p, "작업")
  if (action === "list") return output(await request("work_log", { query: { work_id: `eq.${value("work", true)}`, order: "started_at.asc" } }))
  if (action === "start") return output(await request("work_log", { method: "POST", body: { work_id: value("work", true), member_id: nullable(value("member")), ...(options.note ? { note: options.note } : {}) }, prefer: "return=representation" }))
  const id = value("id", true); const log = await one("work_log", { id: `eq.${id}`, select: "*,node:work_id!inner(project_id)", "node.project_id": `eq.${p.id}` }, "work log")
  if (action === "get") return output(log)
  if (action === "stop") { const ended = options.ended || new Date().toISOString(); const minutes = Math.max(0, Math.round((new Date(ended) - new Date(log.started_at)) / 60000)); return output(await request("work_log", { method: "PATCH", query: { id: `eq.${id}` }, body: { ended_at: ended, duration_minutes: minutes }, prefer: "return=representation" })) }
  if (action === "update") return output(await request("work_log", { method: "PATCH", query: { id: `eq.${id}` }, body: patchFrom(["member_id", "started_at", "ended_at", "duration_minutes", "note"]), prefer: "return=representation" }))
  if (action === "delete") { requireYes("work log delete"); await request("work_log", { method: "DELETE", query: { id: `eq.${id}` } }); return output({ deleted: id }) }
  fail("work-log action: list|get|start|stop|update|delete")
}

async function reports() {
  const p = await project()
  if (action === "progress") { const id = value("node", true); await assertNodeInProject(id, p); return output(await request("node_progress", { query: { node_id: `eq.${id}` } })) }
  if (action === "coverage") { const feature = value("feature", true); await assertNodeInProject(feature, p, "세부기능"); return output(await request("ur_coverage", { query: { feature_id: `eq.${feature}` } })) }
  fail("report action: progress|coverage")
}

async function fields() {
  const p = await project()
  if (action === "list") return output(await request("field_def", { query: { project_id: `eq.${p.id}`, order: "sort_order.asc" } }))
  if (action === "create") {
    const body = {
      project_id: p.id,
      key: value("field-key", true),
      label: value("label", true),
      type: value("type", true),
      options: jsonOption("options") || [],
      applies_to: String(value("applies-to") || "*").split(",").map((x) => x.trim()),
      default_value: nullable(value("default")),
      required: options.required === undefined ? false : bool(options.required),
      sort_order: integer(value("sort-order") || 0, "sort-order"),
    }
    return output(await request("field_def", { method: "POST", body, prefer: "return=representation" }))
  }
  const ref = value("field", true)
  const def = await fieldDef(p, ref)
  if (action === "get") return output(def)
  if (action === "update") return output(await request("field_def", { method: "PATCH", query: { id: `eq.${def.id}`, project_id: `eq.${p.id}` }, body: patchFrom(["key", "label", "type", "options", "applies_to", "default_value", "required", "sort_order"]), prefer: "return=representation" }))
  if (action === "delete") { requireYes("field definition delete (stored node values are not removed)"); await request("field_def", { method: "DELETE", query: { id: `eq.${def.id}`, project_id: `eq.${p.id}` } }); return output({ deleted: def.id }) }
  fail("field action: list|get|create|update|delete")
}

async function fieldValues() {
  const p = await project()
  const id = value("node", true)
  const n = await assertNodeInProject(id, p)
  if (action === "list") return output(n.fields || {})
  const def = await fieldDef(p, value("field", true))
  if (!def.applies_to.includes("*") && !def.applies_to.includes(n.type)) fail(`field ${def.key} does not apply to node type ${n.type}`)
  if (action === "get") return output({ field: def.key, value: n.fields?.[def.key] ?? null })
  const next = { ...(n.fields || {}) }
  if (action === "set") {
    const explicit = jsonOption("json-value")
    const raw = value("value", explicit === undefined)
    next[def.key] = parseFieldValue(def, raw, explicit)
  } else if (action === "clear") {
    if (def.required) fail(`field ${def.key} is required and cannot be cleared`)
    delete next[def.key]
  } else fail("field-value action: list|get|set|clear")
  const rows = await request("node", { method: "PATCH", query: { id: `eq.${id}`, project_id: `eq.${p.id}` }, body: { fields: next }, prefer: "return=representation" })
  return output({ node_id: id, fields: rows[0]?.fields ?? next })
}

async function priorities() {
  if (action === "list") { const p = await project(); return output((await fieldDef(p, "priority")).options) }
  if (["get", "set", "clear"].includes(action)) { options.field = "priority"; return fieldValues() }
  fail("priority action: list|get|set|clear")
}

async function raw() {
  const table = value("table", true)
  const method = String(action || "get").toUpperCase()
  if (!(method === "GET" ? READABLE : WRITABLE).has(table)) fail("resource is not allowed")
  if (method !== "GET" && !options.unsafe) fail("raw writes bypass project ownership checks; pass --unsafe explicitly")
  if (["PATCH", "DELETE"].includes(method) && !options.id) fail("raw patch/delete requires --id")
  if (method === "DELETE") requireYes("raw delete")
  const query = options.id ? { id: `eq.${options.id}` } : jsonOption("query") || {}
  const body = ["POST", "PATCH"].includes(method) ? jsonOption("json", true) : undefined
  return output(await request(table, { method, query, body, prefer: "return=representation" }))
}

const HELP = {
  name: "canopy",
  version: "1.0.0",
  description: "Canopy project-management CLI. JSON output and multi-project ownership checks.",
  usage: "canopy <group> <action> [options]",
  globalOptions: {
    "--project <UUID|exact-name>": "Required for project-scoped resources; UUID is recommended.",
    "--url <PostgREST-base>": "Override CANOPY_URL (default: live Canopy).",
    "--key <publishable-key>": "Override CANOPY_KEY.",
    "--json <object>": "Patch/create payload where supported.",
    "--compact": "Emit compact JSON.",
    "--quiet": "Suppress successful output.",
    "--yes": "Confirm destructive deletes.",
    "--help": "Show help for a group or action.",
  },
  safety: [
    "Use project UUIDs when possible.",
    "Read the target before a live write.",
    "Deletes require --yes and may cascade.",
    "Avoid raw writes; they require --unsafe and bypass ownership checks.",
    "Normal commands preserve and validate project ownership.",
  ],
  groups: {
    project: { description: "Projects (not project-scoped).", actions: {
      list: "List projects.", get: "Get --project.", create: "Create --name.",
      update: "Update --project with --name or --json.", delete: "Delete --project and cascaded data; requires --yes.",
    } },
    member: { description: "Global members; current schema does not scope members to projects.", actions: {
      list: "List members.", get: "Get --id.", create: "Create --name [--color].",
      update: "Update --id with --json.", delete: "Delete --id; requires --yes.",
    } },
    status: { description: "Project-specific workflow statuses.", actions: {
      list: "List for --project.", create: "Create with --project --name --category [--color] [--sort-order].",
      update: "Update --project --id with options or --json.", reassign: "Move nodes from --id to --to within --project.",
      delete: "Delete --project --id; requires --yes.",
    } },
    node: { description: "Tree nodes: 컨텐츠 > 기능 > (세부기능|마스터데이터) > 작업.", actions: {
      list: "List --project; filters: --type --parent --status --assignee.",
      search: "Search --project --query in title/body; accepts list filters.", get: "Get --project --id.",
      create: "Create --project --parent <id|null> --type --title [--status --domain --assignee --sort-order].",
      update: "Update --project --id using named options or --json.",
      delete: "Delete --project --id and descendants; requires --yes.",
    } },
    "ur-group": { description: "Requirement groups owned by a 세부기능.", actions: {
      list: "List --project --feature.", get: "Get --project --id.",
      create: "Create --project --feature --name [--sort-order].", update: "Update --project --id with --name/--json.",
      delete: "Delete --project --id; URs become ungrouped; requires --yes.",
    } },
    ur: { description: "User requirements owned by a 세부기능.", actions: {
      list: "List --project --feature.", get: "Get --project --id.",
      create: "Create --project --feature --text [--group --sort-order].",
      update: "Update --project --id; fields include text, ur_group_id, status, misimpl_reason, sort_order.",
      delete: "Delete --project --id; requires --yes.",
    } },
    "ur-link": { description: "Many-to-many UR and 작업 links.", actions: {
      list: "List --project with either --ur or --work.", create: "Link --project --ur --work.",
      delete: "Unlink exact --project --ur --work pair.",
    } },
    checklist: { description: "Task checklist items.", actions: {
      list: "List --project --work.", get: "Get --project --id.",
      create: "Create --project --work --text [--sort-order].", update: "Update --project --id [--text --done --sort-order].",
      delete: "Delete --project --id; requires --yes.",
    } },
    "node-link": { description: "Node relations: blocks or relates.", actions: {
      list: "List --project --from [--type].", create: "Create --project --from --to --type <blocks|relates>.",
      delete: "Delete --project --id; requires --yes.",
    } },
    "work-log": { description: "Task work sessions and Markdown notes.", actions: {
      list: "List --project --work.", get: "Get --project --id.",
      start: "Start --project --work [--member --note].", stop: "Stop --project --id [--ended ISO-time].",
      update: "Update --project --id; fields include member_id, started_at, ended_at, duration_minutes, note.",
      delete: "Delete --project --id; requires --yes.",
    } },
    field: { description: "Project custom-field definitions.", actions: {
      list: "List --project.", get: "Get --project --field <UUID|key>.",
      create: "Create --project --field-key --label --type [--options JSON --applies-to CSV --default --required --sort-order].",
      update: "Update --project --field <UUID|key> using --json.",
      delete: "Delete definition --project --field; stored node values remain; requires --yes.",
    } },
    "field-value": { description: "Validated node.fields values with read-merge-write preservation.", actions: {
      list: "List all values for --project --node.", get: "Get --project --node --field <UUID|key>.",
      set: "Set --project --node --field with --value or --json-value.",
      clear: "Clear --project --node --field; required fields cannot be cleared.",
    } },
    priority: { description: "Convenience commands for node.fields.priority.", actions: {
      list: "List configured priority options for --project.", get: "Get --project --node.",
      set: "Set --project --node --value <매우낮음|낮음|보통|높음|매우높음|최우선>.", clear: "Clear --project --node.",
    } },
    report: { description: "Read-only computed views.", actions: {
      progress: "Get roll-up progress for --project --node.", coverage: "Get UR coverage for --project --feature.",
    } },
    raw: { description: "Low-level deployed PostgREST escape hatch; prefer normal commands.", actions: {
      get: "GET --table [--query JSON].", post: "POST --table --json; requires --unsafe.",
      patch: "PATCH --table --id --json; requires --unsafe.", delete: "DELETE --table --id; requires --unsafe --yes.",
    } },
  },
  examples: [
    "canopy project list",
    "canopy node search --project <PID> --query 공격",
    "canopy work-log start --project <PID> --work <TASK_ID> --note 구현시작",
    "canopy priority set --project <PID> --node <NODE_ID> --value 높음",
    "canopy help --json",
  ],
}

function help(targetGroup, targetAction, asJson = false) {
  if (asJson) {
    const data = targetGroup ? { ...HELP, groups: { [targetGroup]: HELP.groups[targetGroup] } } : HELP
    if (targetGroup && !HELP.groups[targetGroup]) fail(`Unknown help group: ${targetGroup}`)
    if (targetAction && !HELP.groups[targetGroup]?.actions[targetAction]) fail(`Unknown action: ${targetGroup} ${targetAction}`)
    return output(targetAction ? { group: targetGroup, action: targetAction, description: HELP.groups[targetGroup].actions[targetAction], globalOptions: HELP.globalOptions, safety: HELP.safety } : data)
  }
  if (!targetGroup) {
    const groups = Object.entries(HELP.groups).map(([name, spec]) => `  ${name.padEnd(12)} ${Object.keys(spec.actions).join("|")}`).join("\n")
    console.log(`Canopy CLI v${HELP.version}\n${HELP.description}\n\nUsage: ${HELP.usage}\n\nGroups:\n${groups}\n\nRun 'canopy <group> --help' or 'canopy <group> <action> --help'.\nFor machine-readable documentation: canopy help --json`)
    return
  }
  const spec = HELP.groups[targetGroup]
  if (!spec) fail(`Unknown help group: ${targetGroup}`)
  if (targetAction) {
    const description = spec.actions[targetAction]
    if (!description) fail(`Unknown action: ${targetGroup} ${targetAction}`)
    console.log(`Usage: canopy ${targetGroup} ${targetAction} [options]\n\n${description}\n\nGlobal: --project --url --key --compact --quiet --help\nSafety: ${HELP.safety.join(" ")}`)
    return
  }
  const actions = Object.entries(spec.actions).map(([name, description]) => `  ${name.padEnd(10)} ${description}`).join("\n")
  console.log(`${targetGroup}: ${spec.description}\n\nUsage: canopy ${targetGroup} <action> [options]\n\nActions:\n${actions}\n\nRun 'canopy ${targetGroup} <action> --help' for action help.`)
}

const handlers = { project: projects, member: members, status: statuses, node: nodes, "ur-group": urGroups, ur: urs, "ur-link": urLinks, checklist, "node-link": nodeLinks, "work-log": workLogs, field: fields, "field-value": fieldValues, priority: priorities, report: reports, raw }
if (!group) help()
else if (group === "help") help(action, undefined, options.json === true)
else if (options.help) help(group, action, options.json === true)
else if (!handlers[group]) fail(`Unknown group: ${group}`)
else handlers[group]().catch((error) => fail(error?.message || String(error)))
