#!/usr/bin/env node
import { readFileSync } from "node:fs"

const DEFAULT_URL = "https://canopy-api.lnk.sarl/rest/v1"
const DEFAULT_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzk1MjY0MDc1LCJleHAiOjE5NTI5NDQwNzV9.3Rj3Z3OhIScmh70Dk1gF-S01O8axKT8nZ8HmyQBrR70"
const WRITABLE = new Set([
  "project", "member", "status", "node", "ur_group", "ur", "ur_work_link",
  "task_checklist", "node_link", "work_log", "field_def",
])
const READABLE = new Set([...WRITABLE, "node_progress", "ur_coverage"])
const PAGE = 1000          // PostgREST max-rows 이하로 끊어 받는 단위
const IN_CHUNK = 60        // in.(...) 필터 URL 길이 한도 보호

const TYPE_KEY = { 컨텐츠: "Content", 기능: "Feature", 세부기능: "SubFeature", 마스터데이터: "MasterData", 작업: "Task" }
const KEY_TYPE = Object.fromEntries(Object.entries(TYPE_KEY).map(([t, k]) => [k.toLowerCase(), t]))
const UR_PREFIXES = new Set(["requirement", "ur", "req"])
const UR_GROUP_PREFIXES = new Set(["requirementgroup", "urgroup", "group"])
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// 목록 기본 컬럼: 긴 마크다운(body/description)은 빼서 토큰을 아낀다. --full 또는 --select 로 변경.
const NODE_BRIEF = "id,parent_id,type,ticket_number,title,status_id,st:status_id(name,category),domain,assignee_id,asg:assignee_id(display_name),sort_order,fields,time_spent_minutes,updated_at"
const NODE_FULL = "*,st:status_id(name,category),asg:assignee_id(display_name)"
const UR_BRIEF = "id,feature_id,ur_group_id,ticket_number,text,status,misimpl_reason,sort_order"

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
    else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith("--")) options[key] = argv[++i]
    else options[key] = true
  }
  return { positional, options }
}

const { positional, options } = parse(process.argv.slice(2))
const [group, action] = positional
const base = String(options.url || process.env.CANOPY_URL || DEFAULT_URL).replace(/\/$/, "")
const key = String(options.key || process.env.CANOPY_KEY || DEFAULT_KEY)

// ── 옵션 파싱 ────────────────────────────────────────────────
function value(name, required = false) {
  const v = options[name]
  if (required && (v === undefined || v === true || v === "")) fail(`--${name} is required`)
  return v
}
function has(name) { return options[name] !== undefined }
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
function isNull(v) { return v === null || v === "null" || v === "none" }
function nullable(v) { return isNull(v) ? null : v }
function csv(v) { return v === undefined || v === true ? [] : String(v).split(",").map((x) => x.trim()).filter(Boolean) }
// JSON 옵션: 인라인 문자열, '@파일경로', '-'(stdin) 를 받는다.
// Windows PowerShell 5.1 은 네이티브 프로그램 인자의 큰따옴표를 지워 인라인 JSON 이 깨지므로 @파일/stdin 을 쓰게 한다.
let stdinCache
function jsonOption(name = "json", required = false) {
  const raw = value(name, required)
  if (raw === undefined) return undefined
  let text = String(raw)
  try {
    if (text === "-") text = stdinCache ??= readFileSync(0, "utf8")
    else if (text.startsWith("@")) text = readFileSync(text.slice(1), "utf8")
  } catch (e) { fail(`--${name}: cannot read ${text === "-" ? "stdin" : text.slice(1)} (${e.message})`) }
  text = text.replace(/^﻿/, "")
  try { return JSON.parse(text) } catch {
    const stripped = /^[[{]/.test(text.trim()) && !text.includes('"')
    fail(`--${name} must be valid JSON${stripped ? " (double quotes were removed by the shell — Windows PowerShell 5.1 does this; pass --" + name + " @file.json or pipe it with --" + name + " -)" : ""}. Received: ${text.slice(0, 120)}`)
  }
}
function isUuid(v) { return UUID_RE.test(String(v)) }
function parseKey(ref) {
  const m = /^([A-Za-z]+)-(\d+)$/.exec(String(ref).trim())
  return m ? { prefix: m[1].toLowerCase(), n: Number(m[2]) } : null
}
// PostgREST or/and 필터 값 인용 (쉼표·괄호·따옴표가 있어도 안전).
function pgQuote(s) { return `"${String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"` }
function chunks(arr, size = IN_CHUNK) { const out = []; for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size)); return out }

// ── HTTP ────────────────────────────────────────────────────
async function http(path, { method = "GET", query = {}, body, prefer } = {}) {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== "") qs.append(k, String(v))
  }
  const response = await fetch(`${base}/${path}${[...qs].length ? `?${qs}` : ""}`, {
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
    fail(`${method} ${path} failed (${response.status}): ${detail}`)
  }
  return { data, headers: response.headers }
}
async function request(path, opts) { return (await http(path, opts)).data }
async function rpc(fn, args) { return request(`rpc/${fn}`, { method: "POST", body: args }) }

/** 페이지 단위로 끝까지 받는다(서버 max-rows 에 잘리지 않도록). */
async function fetchAll(table, query) {
  const out = []
  for (let offset = 0; ; offset += PAGE) {
    const rows = await request(table, { query: { ...query, limit: PAGE, offset } })
    out.push(...rows)
    if (rows.length < PAGE) return out
  }
}
/** in.(...) 필터를 청크로 나눠 받는다. */
async function fetchIn(table, column, ids, query) {
  const out = []
  for (const c of chunks([...new Set(ids)])) out.push(...await fetchAll(table, { ...query, [column]: `in.(${c.join(",")})` }))
  return out
}

function output(data, extra) {
  if (options.quiet) return
  console.log(JSON.stringify({ ok: true, data, ...(extra || {}) }, null, options.compact ? 0 : 2))
}

function pageArgs(defaultLimit) {
  const limit = has("limit") ? integer(options.limit, "limit") : defaultLimit
  const offset = has("offset") ? integer(options.offset, "offset") : 0
  return { limit, offset }
}
/** 서버 측 페이지네이션. limit 이 있으면 total 을 함께 돌려준다. */
async function listRows(table, query, defaultLimit) {
  const { limit, offset } = pageArgs(defaultLimit)
  if (limit === undefined) return { rows: await fetchAll(table, query) }
  const { data, headers } = await http(table, { query: { ...query, limit, offset }, prefer: "count=exact" })
  const total = Number(String(headers.get("content-range") || "").split("/")[1])
  return { rows: data, page: { limit, offset, total: Number.isFinite(total) ? total : null } }
}
/** 클라이언트 측 페이지네이션(서브트리 필터처럼 메모리에서 거른 경우). */
function pageLocal(rows, defaultLimit) {
  const { limit, offset } = pageArgs(defaultLimit)
  if (limit === undefined && !offset) return { rows }
  return { rows: rows.slice(offset, limit === undefined ? undefined : offset + limit), page: { limit: limit ?? null, offset, total: rows.length } }
}
function selectCols(def) {
  if (options.full) return def.includes("st:") ? NODE_FULL : "*"
  return has("select") ? String(options.select) : def
}

// ── 출력 정리 ───────────────────────────────────────────────
function nodeKey(n) { return n?.type && n.ticket_number != null ? `${TYPE_KEY[n.type]}-${n.ticket_number}` : undefined }
function nodeOut(n) {
  if (!n || typeof n !== "object") return n
  const out = { key: nodeKey(n), ...n }
  if (out.key === undefined) delete out.key
  if ("st" in n) { out.status = n.st?.name ?? null; out.status_category = n.st?.category ?? null; delete out.st }
  if ("asg" in n) { out.assignee = n.asg?.display_name ?? null; delete out.asg }
  return out
}
function urOut(u) {
  if (!u || typeof u !== "object") return u
  const out = { ...(u.ticket_number != null ? { key: `Requirement-${u.ticket_number}` } : {}), ...u }
  delete out.node
  delete out.ur_work_link
  return out
}
function groupOut(g) {
  if (!g || typeof g !== "object") return g
  const out = { ...(g.ticket_number != null ? { key: `RequirementGroup-${g.ticket_number}` } : {}), ...g }
  delete out.node
  return out
}
function briefNode(n) { return n ? { key: nodeKey(n), id: n.id, title: n.title } : null }

// ── 참조 해석 (UUID | 티켓키 | 이름) ────────────────────────
async function one(table, query, label = table) {
  const rows = await request(table, { query: { ...query, limit: 2 } })
  if (!rows?.length) fail(`${label} not found`)
  if (rows.length > 1) fail(`${label} is ambiguous; use a UUID`)
  return rows[0]
}

let projectCache
async function project() {
  if (projectCache) return projectCache
  const ref = value("project", true)
  projectCache = await one("project", isUuid(ref) ? { id: `eq.${ref}` } : { name: `eq.${ref}` }, "project")
  return projectCache
}

function nodeRefQuery(ref, p) {
  if (isUuid(ref)) return { id: `eq.${ref}`, project_id: `eq.${p.id}` }
  const k = parseKey(ref); const type = k && KEY_TYPE[k.prefix]
  if (!type) fail(`invalid node reference: ${ref} (use a UUID or a key like Task-12)`)
  return { project_id: `eq.${p.id}`, type: `eq.${type}`, ticket_number: `eq.${k.n}` }
}
async function resolveNode(ref, p, expectedType, select) {
  if (ref === undefined || ref === true || ref === "") fail("node reference is required")
  const n = await one("node", { ...nodeRefQuery(ref, p), ...(select ? { select } : {}) }, `node ${ref}`)
  const allowed = Array.isArray(expectedType) ? expectedType : expectedType ? [expectedType] : null
  if (allowed && !allowed.includes(n.type)) fail(`node ${ref} must be type ${allowed.join("|")} (is ${n.type})`)
  return n
}
/** 여러 노드 참조를 최소 요청으로 해석(UUID 는 in, 키는 타입별 ticket_number in). */
async function resolveNodes(refs, p, expectedType) {
  const uuids = refs.filter(isUuid)
  const byType = {}
  for (const r of refs.filter((x) => !isUuid(x))) {
    const k = parseKey(r); const type = k && KEY_TYPE[k.prefix]
    if (!type) fail(`invalid node reference: ${r}`)
    ;(byType[type] ||= []).push(k.n)
  }
  const rows = uuids.length ? await fetchIn("node", "id", uuids, { project_id: `eq.${p.id}`, select: "id,type,ticket_number,title" }) : []
  for (const [type, nums] of Object.entries(byType)) {
    rows.push(...await fetchIn("node", "ticket_number", nums, { project_id: `eq.${p.id}`, type: `eq.${type}`, select: "id,type,ticket_number,title" }))
  }
  const found = new Map()
  for (const n of rows) { found.set(n.id, n); found.set(nodeKey(n).toLowerCase(), n) }
  return refs.map((r) => {
    const n = found.get(isUuid(r) ? r : String(r).toLowerCase())
    if (!n) fail(`node ${r} not found in project`)
    if (expectedType && n.type !== expectedType) fail(`node ${r} must be type ${expectedType}`)
    return n
  })
}

function urRefQuery(ref) {
  if (isUuid(ref)) return { id: `eq.${ref}` }
  const k = parseKey(ref)
  if (!k || !UR_PREFIXES.has(k.prefix)) fail(`invalid UR reference: ${ref} (use a UUID or a key like Requirement-5)`)
  return { ticket_number: `eq.${k.n}` }
}
async function resolveUr(ref, p, select = "*") {
  if (ref === undefined || ref === true || ref === "") fail("UR reference is required")
  return one("ur", { ...urRefQuery(ref), select: `${select},node:feature_id!inner(project_id)`, "node.project_id": `eq.${p.id}` }, `UR ${ref}`)
}
async function resolveUrs(refs, p) {
  const uuids = refs.filter(isUuid)
  const nums = refs.filter((r) => !isUuid(r)).map((r) => {
    const k = parseKey(r); if (!k || !UR_PREFIXES.has(k.prefix)) fail(`invalid UR reference: ${r}`); return k.n
  })
  const q = { select: "id,ticket_number,feature_id,node:feature_id!inner(project_id)", "node.project_id": `eq.${p.id}` }
  const rows = [
    ...(uuids.length ? await fetchIn("ur", "id", uuids, q) : []),
    ...(nums.length ? await fetchIn("ur", "ticket_number", nums, q) : []),
  ]
  const found = new Map()
  for (const u of rows) { found.set(u.id, u); found.set(`n${u.ticket_number}`, u) }
  return refs.map((r) => {
    const u = found.get(isUuid(r) ? r : `n${parseKey(r).n}`)
    if (!u) fail(`UR ${r} not found in project`)
    return u
  })
}

const statusCache = new Map()
async function resolveStatus(ref, p) {
  if (ref === undefined) return undefined
  if (isNull(ref)) return null
  if (statusCache.has(ref)) return statusCache.get(ref)
  const s = await one("status", isUuid(ref) ? { id: `eq.${ref}`, project_id: `eq.${p.id}` } : { name: `eq.${ref}`, project_id: `eq.${p.id}` }, `status ${ref}`)
  statusCache.set(ref, s)
  return s
}
const memberCache = new Map()
async function resolveMember(ref) {
  if (ref === undefined) return undefined
  if (isNull(ref)) return null
  if (memberCache.has(ref)) return memberCache.get(ref)
  const m = await one("member", isUuid(ref) ? { id: `eq.${ref}` } : { display_name: `eq.${ref}` }, `member ${ref}`)
  memberCache.set(ref, m)
  return m
}
async function resolveUrGroup(ref, p, featureId) {
  if (ref === undefined) return undefined
  if (isNull(ref)) return null
  const k = parseKey(ref)
  const byKey = k && UR_GROUP_PREFIXES.has(k.prefix)
  const q = isUuid(ref) ? { id: `eq.${ref}` } : byKey ? { ticket_number: `eq.${k.n}` } : { name: `eq.${ref}` }
  if (featureId && !byKey) q.feature_id = `eq.${featureId}`
  else if (!isUuid(ref) && !byKey) fail("UR group name requires --feature; otherwise use a UUID or RequirementGroup-N")
  return one("ur_group", { ...q, select: "*,node:feature_id!inner(project_id)", "node.project_id": `eq.${p.id}` }, `UR group ${ref}`)
}

let skeletonCache
async function projectSkeleton(p) {
  skeletonCache ||= await fetchAll("node", { project_id: `eq.${p.id}`, select: "id,parent_id,type", order: "id.asc" })
  return skeletonCache
}
/** root 서브트리(자신 포함) id 집합. */
async function subtreeIds(p, rootId) {
  const rows = await projectSkeleton(p)
  const kids = new Map()
  for (const n of rows) { const a = kids.get(n.parent_id); if (a) a.push(n); else kids.set(n.parent_id, [n]) }
  const set = new Set([rootId]); const stack = [rootId]
  while (stack.length) for (const c of kids.get(stack.pop()) || []) { set.add(c.id); stack.push(c.id) }
  return { set, rows }
}

async function nextSortOrder(table, filter) {
  const rows = await request(table, { query: { ...filter, select: "sort_order", order: "sort_order.desc", limit: 1 } })
  return rows.length ? rows[0].sort_order + 1 : 0
}

async function fieldDef(p, ref) {
  return one("field_def", isUuid(ref)
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
  else if (def.type === "multiselect") v = csv(raw)
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
function items() {
  const arr = jsonOption("items")
  if (arr === undefined) return undefined
  if (!Array.isArray(arr) || !arr.length) fail("--items must be a non-empty JSON array")
  return arr
}

// ── project / member / status ───────────────────────────────
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
  const m = await resolveMember(value("id", true))
  if (action === "get") return output(m)
  if (action === "update") return output(await request("member", { method: "PATCH", query: { id: `eq.${m.id}` }, body: patchFrom(["display_name", "color"]), prefer: "return=representation" }))
  if (action === "delete") { requireYes("member delete"); await request("member", { method: "DELETE", query: { id: `eq.${m.id}` } }); return output({ deleted: m.id }) }
  fail("member action: list|get|create|update|delete")
}

async function statuses() {
  const p = await project()
  if (action === "list") return output(await request("status", { query: { project_id: `eq.${p.id}`, order: "sort_order.asc" } }))
  if (action === "create") {
    const body = { project_id: p.id, name: value("name", true), category: value("category", true), color: nullable(value("color")), sort_order: integer(value("sort-order") || 0, "sort-order") }
    return output(await request("status", { method: "POST", body, prefer: "return=representation" }))
  }
  const s = await resolveStatus(value("id", true), p)
  if (action === "get") return output(s)
  if (action === "update") return output(await request("status", { method: "PATCH", query: { id: `eq.${s.id}`, project_id: `eq.${p.id}` }, body: patchFrom(["name", "category", "color", "sort_order"]), prefer: "return=representation" }))
  if (action === "reassign") {
    const to = await resolveStatus(value("to", true), p)
    await request("node", { method: "PATCH", query: { project_id: `eq.${p.id}`, status_id: `eq.${s.id}` }, body: { status_id: to?.id ?? null } })
    return output({ from: s.id, to: to?.id ?? null })
  }
  if (action === "delete") { requireYes("status delete"); await request("status", { method: "DELETE", query: { id: `eq.${s.id}`, project_id: `eq.${p.id}` } }); return output({ deleted: s.id }) }
  fail("status action: list|get|create|update|reassign|delete")
}

// ── node ────────────────────────────────────────────────────
async function nodeFilters(p) {
  const q = { project_id: `eq.${p.id}` }
  const types = csv(options.type)
  if (types.length) q.type = types.length === 1 ? `eq.${types[0]}` : `in.(${types.join(",")})`
  if (has("parent")) q.parent_id = isNull(options.parent) ? "is.null" : `eq.${(await resolveNode(options.parent, p)).id}`
  if (has("status")) {
    const ids = []
    for (const s of csv(options.status)) ids.push(isNull(s) ? null : (await resolveStatus(s, p)).id)
    if (ids.includes(null)) q.status_id = ids.length === 1 ? "is.null" : fail("--status null cannot be combined with other statuses")
    else q.status_id = `in.(${ids.join(",")})`
  }
  if (has("category")) {
    const cats = csv(options.category)
    const st = await request("status", { query: { project_id: `eq.${p.id}`, category: `in.(${cats.join(",")})`, select: "id" } })
    q.status_id = `in.(${st.map((s) => s.id).join(",") || "00000000-0000-0000-0000-000000000000"})`
  }
  if (has("assignee")) q.assignee_id = isNull(options.assignee) ? "is.null" : `eq.${(await resolveMember(options.assignee)).id}`
  if (has("domain")) q.domain = isNull(options.domain) ? "is.null" : `in.(${csv(options.domain).join(",")})`
  if (has("updated-since")) q.updated_at = `gte.${options["updated-since"]}`
  const fieldFilters = [].concat(options["field-filter"] ?? [])
  if (has("priority")) fieldFilters.push(`priority=${options.priority}`)
  for (const f of fieldFilters) {
    const at = String(f).indexOf("="); if (at < 1) fail("--field-filter must be key=value")
    q[`fields->>${String(f).slice(0, at)}`] = `eq.${String(f).slice(at + 1)}`
  }
  if (has("query")) {
    const text = String(value("query", true))
    const parts = [`title.ilike.${pgQuote(`*${text}*`)}`, `body.ilike.${pgQuote(`*${text}*`)}`]
    const k = parseKey(text); const kt = k && KEY_TYPE[k.prefix]
    if (kt) parts.push(`and(type.eq.${kt},ticket_number.eq.${k.n})`)
    q.or = `(${parts.join(",")})`
  }
  return q
}

async function nodeList(p) {
  if (action === "search") value("query", true)
  const q = { ...(await nodeFilters(p)), select: selectCols(NODE_BRIEF), order: options.order || "sort_order.asc,created_at.asc" }
  const defaultLimit = action === "search" ? 50 : undefined
  if (has("under")) {
    const root = await resolveNode(options.under, p)
    const { set } = await subtreeIds(p, root.id)
    const all = (await fetchAll("node", q)).filter((n) => !n.id || set.has(n.id))
    const { rows, page } = pageLocal(all, defaultLimit)
    return output(rows.map(nodeOut), page ? { page } : undefined)
  }
  const { rows, page } = await listRows("node", q, defaultLimit)
  return output(rows.map(nodeOut), page ? { page } : undefined)
}

async function nodeTree(p) {
  const rows = await fetchAll("node", { project_id: `eq.${p.id}`, select: "id,parent_id,type,ticket_number,title,sort_order,created_at,st:status_id(name)", order: "sort_order.asc,created_at.asc" })
  const root = has("root") ? await resolveNode(options.root, p) : null
  const depthLimit = has("depth") ? integer(options.depth, "depth") : Infinity
  const exclude = new Set(csv(options["exclude-type"]))
  const showIds = !!options.ids
  let progress = null
  if (options.progress) {
    const prog = await rpc("subtree_progress", { p_project_id: p.id, p_root: root?.id ?? null })
    progress = new Map(prog.map((r) => [r.node_id, r]))
  }
  const kids = new Map()
  for (const n of rows) { const a = kids.get(n.parent_id); if (a) a.push(n); else kids.set(n.parent_id, [n]) }
  const pct = (n) => {
    const r = progress?.get(n.id)
    return r && r.progress !== null ? `${Math.round(Number(r.progress) * 100)}% (${r.done_urs}/${r.total_urs})` : null
  }
  const starts = root ? [rows.find((n) => n.id === root.id)] : kids.get(null) || []
  if (options.format === "json") {
    const build = (n, d) => {
      const o = { key: nodeKey(n), title: n.title }
      if (showIds) o.id = n.id
      if (n.st?.name) o.status = n.st.name
      const pr = progress?.get(n.id); if (pr && pr.progress !== null) o.progress = Number(pr.progress)
      const ch = d < depthLimit ? (kids.get(n.id) || []).filter((c) => !exclude.has(c.type)) : []
      if (ch.length) o.children = ch.map((c) => build(c, d + 1))
      else if ((kids.get(n.id) || []).length) o.child_count = kids.get(n.id).length
      return o
    }
    return output(starts.map((n) => build(n, 0)))
  }
  const lines = []
  const walk = (n, d) => {
    const ch = (kids.get(n.id) || []).filter((c) => !exclude.has(c.type))
    const extra = [n.st?.name && `[${n.st.name}]`, pct(n), showIds && n.id, d >= depthLimit && ch.length && `(+${ch.length})`].filter(Boolean).join(" ")
    lines.push(`${"  ".repeat(d)}${nodeKey(n)} ${n.title}${extra ? ` ${extra}` : ""}`)
    if (d < depthLimit) for (const c of ch) walk(c, d + 1)
  }
  for (const n of starts) walk(n, 0)
  return output(lines)
}

async function nodeShow(p, ref) {
  const sel = `${NODE_FULL},parent:parent_id(id,type,ticket_number,title,parent:parent_id(id,type,ticket_number,title,parent:parent_id(id,type,ticket_number,title,parent:parent_id(id,type,ticket_number,title))))`
  const n = await resolveNode(ref, p, undefined, sel)
  const path = []
  for (let cur = n.parent; cur; cur = cur.parent) path.unshift(briefNode(cur))
  const node = nodeOut({ ...n }); delete node.parent; delete node.project_id
  const [children, prog] = await Promise.all([
    fetchAll("node", { parent_id: `eq.${n.id}`, select: "id,type,ticket_number,title,st:status_id(name)", order: "sort_order.asc,created_at.asc" }),
    rpc("subtree_progress", { p_project_id: p.id, p_root: n.id }),
  ])
  const pr = prog.find((r) => r.node_id === n.id)
  const out = {
    node,
    path,
    progress: pr ? { total_urs: pr.total_urs, done_urs: pr.done_urs, progress: pr.progress === null ? null : Number(pr.progress) } : null,
    children: children.map((c) => ({ key: nodeKey(c), id: c.id, title: c.title, status: c.st?.name ?? null })),
  }
  if (n.type === "세부기능") {
    const [groups, urs, cov] = await Promise.all([
      fetchAll("ur_group", { feature_id: `eq.${n.id}`, select: "id,ticket_number,name,sort_order", order: "sort_order.asc" }),
      fetchAll("ur", { feature_id: `eq.${n.id}`, select: options.full ? "*" : UR_BRIEF, order: "sort_order.asc" }),
      fetchAll("ur_coverage", { feature_id: `eq.${n.id}`, select: "ur_id,linked_work_count" }),
    ])
    const linked = new Map(cov.map((c) => [c.ur_id, c.linked_work_count]))
    out.ur_groups = groups.map(groupOut)
    out.urs = urs.map((u) => ({ ...urOut(u), linked_work_count: linked.get(u.id) ?? 0 }))
  }
  if (n.type === "작업") {
    const [checklist, links, outLinks, inLinks, logs] = await Promise.all([
      fetchAll("task_checklist", { work_id: `eq.${n.id}`, select: "id,text,done,sort_order", order: "sort_order.asc" }),
      fetchAll("ur_work_link", { work_id: `eq.${n.id}`, select: "ur(id,ticket_number,text,status)" }),
      fetchAll("node_link", { from_node_id: `eq.${n.id}`, select: "id,type,to:to_node_id(id,type,ticket_number,title)" }),
      fetchAll("node_link", { to_node_id: `eq.${n.id}`, select: "id,type,from:from_node_id(id,type,ticket_number,title)" }),
      fetchAll("work_log", { work_id: `eq.${n.id}`, select: "id,member_id,started_at,ended_at,duration_minutes", order: "started_at.asc" }),
    ])
    out.checklist = checklist
    out.urs = links.map((l) => urOut(l.ur))
    out.links = [
      ...outLinks.map((l) => ({ id: l.id, type: l.type, direction: "out", node: briefNode(l.to) })),
      ...inLinks.map((l) => ({ id: l.id, type: l.type, direction: "in", node: briefNode(l.from) })),
    ]
    const logged = logs.reduce((s, l) => s + (l.ended_at ? l.duration_minutes || 0 : 0), 0)
    out.work_log = { count: logs.length, logged_minutes: logged, total_minutes: logged + (n.time_spent_minutes || 0), active: logs.find((l) => !l.ended_at) || null }
  }
  return output(out)
}

async function nodeCreate(p) {
  const list = items() || [{}]
  const parentCache = new Map(); const sortCache = new Map()
  const rows = []
  for (const it of list) {
    const pick = (k, alias) => it[k] !== undefined ? it[k] : it[alias] !== undefined ? it[alias] : options[k] !== undefined ? options[k] : alias ? options[alias.replaceAll("_", "-")] : undefined
    const type = pick("type"); const title = pick("title")
    if (!type || type === true) fail("type is required (--type or items[].type)")
    if (!title || title === true) fail("title is required (--title or items[].title)")
    const parentRef = pick("parent", "parent_id")
    if (parentRef === undefined) fail("parent is required (--parent <ref|null>)")
    let parentId = null
    if (!isNull(parentRef)) {
      if (!parentCache.has(parentRef)) parentCache.set(parentRef, (await resolveNode(parentRef, p)).id)
      parentId = parentCache.get(parentRef)
    }
    let sort = pick("sort_order", "sort-order")
    if (sort === undefined) {
      if (!sortCache.has(parentId)) sortCache.set(parentId, await nextSortOrder("node", { project_id: `eq.${p.id}`, parent_id: parentId ? `eq.${parentId}` : "is.null" }))
      sort = sortCache.get(parentId); sortCache.set(parentId, sort + 1)
    }
    const status = await resolveStatus(pick("status", "status_id"), p)
    const assignee = await resolveMember(pick("assignee", "assignee_id"))
    rows.push({
      project_id: p.id, parent_id: parentId, type, title, sort_order: integer(sort, "sort-order"),
      body: nullable(pick("body")) ?? null, domain: nullable(pick("domain")) ?? null,
      status_id: status?.id ?? null, assignee_id: assignee?.id ?? null,
      fields: it.fields || {},
    })
  }
  const created = await request("node", { method: "POST", body: rows.length === 1 ? rows[0] : rows, prefer: "return=representation" })
  return output(created.map(nodeOut))
}

async function nodeUpdateBody(p) {
  const body = patchFrom(["title", "body", "sort_order", "status_id", "domain", "assignee_id", "time_spent_minutes"])
  if (has("status")) body.status_id = options.status
  if (has("assignee")) body.assignee_id = options.assignee
  if (body.status_id !== undefined) body.status_id = (await resolveStatus(body.status_id ?? "null", p))?.id ?? null
  if (body.assignee_id !== undefined) body.assignee_id = (await resolveMember(body.assignee_id ?? "null"))?.id ?? null
  if ("parent_id" in body || "type" in body || "project_id" in body) fail("use 'node move' to change parent; type/project cannot be changed")
  if (!Object.keys(body).length) fail("nothing to update")
  return body
}

async function nodes() {
  const p = await project()
  if (action === "list" || action === "search") return nodeList(p)
  if (action === "tree") return nodeTree(p)
  if (action === "create") return nodeCreate(p)
  if (action === "update" && has("ids")) {
    const targets = await resolveNodes(csv(options.ids), p)
    const body = await nodeUpdateBody(p)
    const updated = await request("node", { method: "PATCH", query: { project_id: `eq.${p.id}`, id: `in.(${targets.map((n) => n.id).join(",")})`, select: NODE_BRIEF }, body, prefer: "return=representation" })
    return output(updated.map(nodeOut))
  }
  const ref = value("id", true)
  if (action === "show") return nodeShow(p, ref)
  if (action === "get") return output(nodeOut(await resolveNode(ref, p, undefined, has("select") ? String(options.select) : NODE_FULL)))
  const n = await resolveNode(ref, p)
  if (action === "update") {
    const body = await nodeUpdateBody(p)
    const rows = await request("node", { method: "PATCH", query: { id: `eq.${n.id}`, project_id: `eq.${p.id}`, select: NODE_FULL }, body, prefer: "return=representation" })
    return output(rows.map(nodeOut))
  }
  if (action === "move") {
    const parentRef = value("parent", true)
    const parentId = isNull(parentRef) ? null : (await resolveNode(parentRef, p)).id
    if (parentId === n.id) fail("a node cannot be its own parent")
    const sort = has("sort-order") ? integer(options["sort-order"], "sort-order") : await nextSortOrder("node", { project_id: `eq.${p.id}`, parent_id: parentId ? `eq.${parentId}` : "is.null" })
    const rows = await request("node", { method: "PATCH", query: { id: `eq.${n.id}`, project_id: `eq.${p.id}`, select: NODE_BRIEF }, body: { parent_id: parentId, sort_order: sort }, prefer: "return=representation" })
    return output(rows.map(nodeOut))
  }
  if (action === "delete") { requireYes("node delete (descendants cascade)"); await request("node", { method: "DELETE", query: { id: `eq.${n.id}`, project_id: `eq.${p.id}` } }); return output({ deleted: n.id, key: nodeKey(n) }) }
  fail("node action: list|search|tree|get|show|create|update|move|delete")
}

// ── UR group / UR ───────────────────────────────────────────
async function urGroups() {
  const p = await project()
  const feature = has("feature") ? await resolveNode(options.feature, p, "세부기능") : null
  if (action === "list") { if (!feature) value("feature", true); return output((await request("ur_group", { query: { feature_id: `eq.${feature.id}`, order: "sort_order.asc" } })).map(groupOut)) }
  if (action === "create") {
    if (!feature) value("feature", true)
    const sort = has("sort-order") ? integer(options["sort-order"], "sort-order") : await nextSortOrder("ur_group", { feature_id: `eq.${feature.id}` })
    return output((await request("ur_group", { method: "POST", body: { feature_id: feature.id, name: value("name", true), sort_order: sort }, prefer: "return=representation" })).map(groupOut))
  }
  const g = await resolveUrGroup(value("id", true), p, feature?.id)
  if (action === "get") return output(groupOut(g))
  if (action === "update") return output((await request("ur_group", { method: "PATCH", query: { id: `eq.${g.id}` }, body: patchFrom(["name", "sort_order"]), prefer: "return=representation" })).map(groupOut))
  if (action === "delete") { requireYes("UR group delete"); await request("ur_group", { method: "DELETE", query: { id: `eq.${g.id}` } }); return output({ deleted: g.id }) }
  fail("ur-group action: list|get|create|update|delete")
}

async function urList(p) {
  const select = `${options.full ? "*" : has("select") ? options.select : UR_BRIEF},node:feature_id!inner(project_id)${options.uncovered ? ",ur_work_link(id)" : ""}`
  const q = { select, "node.project_id": `eq.${p.id}` }
  let featureIds = null
  if (has("feature")) featureIds = [(await resolveNode(options.feature, p, "세부기능")).id]
  if (has("under")) {
    const root = await resolveNode(options.under, p)
    const { set, rows } = await subtreeIds(p, root.id)
    const subs = rows.filter((n) => set.has(n.id) && n.type === "세부기능").map((n) => n.id)
    featureIds = featureIds ? featureIds.filter((f) => subs.includes(f)) : subs
    if (!featureIds.length) return output([], { page: { limit: null, offset: 0, total: 0 } })
  }
  if (has("status")) q.status = `in.(${csv(options.status).join(",")})`
  if (has("group")) {
    if (isNull(options.group)) q.ur_group_id = "is.null"
    else q.ur_group_id = `eq.${(await resolveUrGroup(options.group, p, featureIds?.length === 1 ? featureIds[0] : undefined)).id}`
  }
  if (has("query")) {
    const t = pgQuote(`*${value("query", true)}*`)
    q.or = `(text.ilike.${t},description.ilike.${t})`
  }
  if (options.uncovered) { q.ur_work_link = "is.null"; if (!q.status) q.status = "neq.완료" }
  q.order = options.order || (featureIds?.length === 1 ? "sort_order.asc" : "ticket_number.asc")
  if (featureIds && featureIds.length > IN_CHUNK) {
    const all = await fetchIn("ur", "feature_id", featureIds, q)
    all.sort((a, b) => a.ticket_number - b.ticket_number)
    const { rows, page } = pageLocal(all)
    return output(rows.map(urOut), page ? { page } : undefined)
  }
  if (featureIds) q.feature_id = `in.(${featureIds.join(",")})`
  const { rows, page } = await listRows("ur", q, featureIds?.length === 1 ? undefined : (has("query") ? 50 : undefined))
  return output(rows.map(urOut), page ? { page } : undefined)
}

async function urCreate(p) {
  const list = items() || [{}]
  const featureCache = new Map(); const groupCache = new Map(); const sortCache = new Map()
  const rows = []
  for (const it of list) {
    const featureRef = it.feature ?? it.feature_id ?? options.feature
    if (!featureRef || featureRef === true) fail("feature is required (--feature or items[].feature)")
    if (!featureCache.has(featureRef)) featureCache.set(featureRef, (await resolveNode(featureRef, p, "세부기능")).id)
    const featureId = featureCache.get(featureRef)
    const text = it.text ?? options.text
    if (!text || text === true) fail("text is required (--text or items[].text)")
    const groupRef = it.group ?? it.ur_group_id ?? options.group
    let groupId = null
    if (groupRef !== undefined && !isNull(groupRef)) {
      const gk = `${featureId}:${groupRef}`
      if (!groupCache.has(gk)) groupCache.set(gk, (await resolveUrGroup(groupRef, p, featureId)).id)
      groupId = groupCache.get(gk)
    }
    let sort = it.sort_order ?? options["sort-order"]
    if (sort === undefined) {
      const sk = `${featureId}:${groupId}`
      if (!sortCache.has(sk)) sortCache.set(sk, await nextSortOrder("ur", { feature_id: `eq.${featureId}`, ur_group_id: groupId ? `eq.${groupId}` : "is.null" }))
      sort = sortCache.get(sk); sortCache.set(sk, sort + 1)
    }
    rows.push({ feature_id: featureId, ur_group_id: groupId, text, description: nullable(it.description ?? options.description) ?? null, sort_order: integer(sort, "sort-order") })
  }
  // description 은 값이 있을 때만 보낸다(컬럼 미배포 서버 호환). 일괄 insert 는 키가 같아야 하므로 전부 함께 제거.
  if (rows.every((r) => r.description === null)) for (const r of rows) delete r.description
  const created = await request("ur", { method: "POST", body: rows.length === 1 ? rows[0] : rows, prefer: "return=representation" })
  return output(created.map(urOut))
}

async function urUpdateBody(p, current) {
  const body = patchFrom(["text", "description", "ur_group_id", "sort_order", "status", "misimpl_reason", "feature_id"])
  if (has("group")) body.ur_group_id = options.group
  let featureId = current?.feature_id
  if (body.feature_id !== undefined) {
    featureId = (await resolveNode(body.feature_id, p, "세부기능")).id
    body.feature_id = featureId
    if (body.ur_group_id === undefined) body.ur_group_id = null // 그룹은 세부기능 소속이므로 이동 시 해제
  }
  if (body.ur_group_id !== undefined && body.ur_group_id !== null) body.ur_group_id = (await resolveUrGroup(body.ur_group_id, p, featureId)).id
  if (body.status && body.status !== "오구현" && body.misimpl_reason === undefined) body.misimpl_reason = null
  if (!Object.keys(body).length) fail("nothing to update")
  return body
}

async function urs() {
  const p = await project()
  if (action === "list" || action === "search") { if (action === "search") value("query", true); return urList(p) }
  if (action === "create") return urCreate(p)
  if ((action === "update" || action === "delete") && has("ids")) {
    const targets = await resolveUrs(csv(options.ids), p)
    const idq = `in.(${targets.map((u) => u.id).join(",")})`
    if (action === "delete") { requireYes("UR delete"); await request("ur", { method: "DELETE", query: { id: idq } }); return output({ deleted: targets.map((u) => u.id) }) }
    const body = await urUpdateBody(p, targets.length && targets.every((u) => u.feature_id === targets[0].feature_id) ? targets[0] : null)
    const updated = await request("ur", { method: "PATCH", query: { id: idq, select: UR_BRIEF }, body, prefer: "return=representation" })
    return output(updated.map(urOut))
  }
  const ref = value("id", true)
  if (action === "get") {
    const u = await resolveUr(ref, p, "*,ur_work_link(work:work_id(id,type,ticket_number,title,st:status_id(name)))")
    const out = urOut(u)
    out.works = (u.ur_work_link || []).map((l) => ({ ...briefNode(l.work), status: l.work?.st?.name ?? null }))
    return output(out)
  }
  const u = await resolveUr(ref, p)
  if (action === "update") return output((await request("ur", { method: "PATCH", query: { id: `eq.${u.id}` }, body: await urUpdateBody(p, u), prefer: "return=representation" })).map(urOut))
  if (action === "delete") { requireYes("UR delete"); await request("ur", { method: "DELETE", query: { id: `eq.${u.id}` } }); return output({ deleted: u.id }) }
  fail("ur action: list|search|get|create|update|delete")
}

// ── UR↔작업 링크 ────────────────────────────────────────────
async function linkPairs(p) {
  const list = items()
  if (list) {
    const urs = await resolveUrs(list.map((x) => x.ur), p)
    const works = await resolveNodes(list.map((x) => x.work), p, "작업")
    return list.map((_, i) => ({ ur_id: urs[i].id, work_id: works[i].id }))
  }
  const urs = await resolveUrs(csv(value("ur", true)), p)
  const works = await resolveNodes(csv(value("work", true)), p, "작업")
  return urs.flatMap((u) => works.map((w) => ({ ur_id: u.id, work_id: w.id })))
}

async function urLinks() {
  const p = await project()
  if (action === "list") {
    if (has("ur")) {
      const u = await resolveUr(options.ur, p, "id")
      const rows = await fetchAll("ur_work_link", { ur_id: `eq.${u.id}`, select: "id,ur_id,work_id,work:work_id(type,ticket_number,title,st:status_id(name))" })
      return output(rows.map((l) => ({ id: l.id, ur_id: l.ur_id, work_id: l.work_id, work_key: nodeKey(l.work), work_title: l.work?.title, work_status: l.work?.st?.name ?? null })))
    }
    if (has("work")) {
      const w = await resolveNode(options.work, p, "작업")
      const rows = await fetchAll("ur_work_link", { work_id: `eq.${w.id}`, select: "id,ur_id,work_id,ur(ticket_number,text,status)" })
      return output(rows.map((l) => ({ id: l.id, ur_id: l.ur_id, work_id: l.work_id, ur_key: `Requirement-${l.ur?.ticket_number}`, ur_text: l.ur?.text, ur_status: l.ur?.status })))
    }
    if (has("feature")) {
      const f = await resolveNode(options.feature, p, "세부기능")
      const rows = await fetchAll("ur_work_link", { select: "id,ur_id,work_id,ur!inner(feature_id,ticket_number),work:work_id(type,ticket_number)", "ur.feature_id": `eq.${f.id}` })
      return output(rows.map((l) => ({ id: l.id, ur_id: l.ur_id, work_id: l.work_id, ur_key: `Requirement-${l.ur?.ticket_number}`, work_key: nodeKey(l.work) })))
    }
    fail("ur-link list requires --ur, --work or --feature")
  }
  if (action === "create") {
    const pairs = await linkPairs(p)
    const rows = await request("ur_work_link", { method: "POST", query: { on_conflict: "ur_id,work_id" }, body: pairs, prefer: "resolution=ignore-duplicates,return=representation" })
    return output({ requested: pairs.length, created: rows.length, links: rows })
  }
  if (action === "delete") {
    const pairs = await linkPairs(p)
    let removed = 0
    for (const pr of pairs) {
      const rows = await request("ur_work_link", { method: "DELETE", query: { ur_id: `eq.${pr.ur_id}`, work_id: `eq.${pr.work_id}` }, prefer: "return=representation" })
      removed += rows.length
    }
    return output({ unlinked: removed > 0, removed })
  }
  fail("ur-link action: list|create|delete")
}

// ── 체크리스트 ──────────────────────────────────────────────
async function checklist() {
  const p = await project()
  const work = has("work") ? await resolveNode(options.work, p, "작업") : null
  if (action === "list") { if (!work) value("work", true); return output(await request("task_checklist", { query: { work_id: `eq.${work.id}`, order: "sort_order.asc" } })) }
  if (action === "create") {
    if (!work) value("work", true)
    const list = items() || [{ text: value("text", true), ...(has("sort-order") ? { sort_order: integer(options["sort-order"], "sort-order") } : {}) }]
    let next = await nextSortOrder("task_checklist", { work_id: `eq.${work.id}` })
    const rows = list.map((it) => {
      const o = typeof it === "string" ? { text: it } : it
      if (!o.text) fail("each checklist item needs text")
      return { work_id: work.id, text: o.text, done: o.done === undefined ? false : bool(o.done), sort_order: o.sort_order ?? next++ }
    })
    return output(await request("task_checklist", { method: "POST", body: rows.length === 1 ? rows[0] : rows, prefer: "return=representation" }))
  }
  const id = value("id", true)
  const item = await one("task_checklist", { id: `eq.${id}`, select: "*,node:work_id!inner(project_id)", "node.project_id": `eq.${p.id}` }, "checklist item")
  delete item.node
  if (action === "get") return output(item)
  if (action === "update") { const body = patchFrom(["text", "sort_order"]); if (has("done")) body.done = bool(options.done); return output(await request("task_checklist", { method: "PATCH", query: { id: `eq.${id}` }, body, prefer: "return=representation" })) }
  if (action === "delete") { requireYes("checklist delete"); await request("task_checklist", { method: "DELETE", query: { id: `eq.${id}` } }); return output({ deleted: id }) }
  fail("checklist action: list|get|create|update|delete")
}

// ── 노드 링크 ───────────────────────────────────────────────
async function nodeLinks() {
  const p = await project()
  const SEL = "id,type,from_node_id,to_node_id,from:from_node_id(type,ticket_number,title),to:to_node_id(type,ticket_number,title)"
  const shape = (l) => ({ id: l.id, type: l.type, from_node_id: l.from_node_id, to_node_id: l.to_node_id, from_key: nodeKey(l.from), from_title: l.from?.title, to_key: nodeKey(l.to), to_title: l.to?.title })
  if (action === "list") {
    const tq = has("type") ? { type: `eq.${options.type}` } : {}
    if (has("node")) {
      const n = await resolveNode(options.node, p)
      const [a, b] = await Promise.all([fetchAll("node_link", { ...tq, from_node_id: `eq.${n.id}`, select: SEL }), fetchAll("node_link", { ...tq, to_node_id: `eq.${n.id}`, select: SEL })])
      return output([...a, ...b].map(shape))
    }
    const q = { ...tq, select: SEL }
    if (has("from")) q.from_node_id = `eq.${(await resolveNode(options.from, p)).id}`
    if (has("to")) q.to_node_id = `eq.${(await resolveNode(options.to, p)).id}`
    if (!q.from_node_id && !q.to_node_id) fail("node-link list requires --from, --to or --node")
    return output((await fetchAll("node_link", q)).map(shape))
  }
  if (action === "create") {
    const from = await resolveNode(value("from", true), p); const to = await resolveNode(value("to", true), p)
    return output(await request("node_link", { method: "POST", body: { from_node_id: from.id, to_node_id: to.id, type: value("type", true) }, prefer: "return=representation" }))
  }
  if (action === "delete") {
    requireYes("node link delete")
    let id = options.id
    if (!id) {
      const from = await resolveNode(value("from", true), p); const to = await resolveNode(value("to", true), p)
      id = (await one("node_link", { from_node_id: `eq.${from.id}`, to_node_id: `eq.${to.id}`, type: `eq.${value("type", true)}` }, "node link")).id
    } else await one("node_link", { id: `eq.${id}`, select: "id,node:from_node_id!inner(project_id)", "node.project_id": `eq.${p.id}` }, "node link")
    await request("node_link", { method: "DELETE", query: { id: `eq.${id}` } })
    return output({ deleted: id })
  }
  fail("node-link action: list|create|delete")
}

// ── 작업 로그 ───────────────────────────────────────────────
async function workLogs() {
  const p = await project()
  const work = has("work") ? await resolveNode(options.work, p, "작업") : null
  if (action === "list") {
    const q = { select: `${options.full || !has("select") ? "*" : options.select},node:work_id!inner(project_id,type,ticket_number,title)`, "node.project_id": `eq.${p.id}`, order: options.order || "started_at.asc" }
    if (work) q.work_id = `eq.${work.id}`
    if (has("member")) q.member_id = isNull(options.member) ? "is.null" : `eq.${(await resolveMember(options.member)).id}`
    const range = []
    if (has("since")) range.push(`started_at.gte.${options.since}`)
    if (has("until")) range.push(`started_at.lt.${options.until}`)
    if (range.length) q.and = `(${range.join(",")})`
    if (options.active) q.ended_at = "is.null"
    const { rows, page } = await listRows("work_log", q, work ? undefined : 100)
    return output(rows.map((l) => { const o = { ...l, work_key: nodeKey(l.node), work_title: l.node?.title }; delete o.node; if (work) { delete o.work_key; delete o.work_title } return o }), page ? { page } : undefined)
  }
  if (action === "start") {
    if (!work) value("work", true)
    const member = await resolveMember(value("member"))
    return output(await request("work_log", { method: "POST", body: { work_id: work.id, member_id: member?.id ?? null, ...(options.note ? { note: options.note } : {}) }, prefer: "return=representation" }))
  }
  if (action === "create") {
    // 완결형 생성(백필): 시작/종료/시간을 명시해 한 번에 넣는다. duration 미지정 시 종료가 있으면 자동 계산.
    if (!work) value("work", true)
    const startedAt = options.started || new Date().toISOString()
    const endedAt = options.ended || null
    let minutes = has("minutes") ? integer(options.minutes, "minutes") : null
    if (minutes === null && endedAt) minutes = Math.max(0, Math.round((new Date(endedAt) - new Date(startedAt)) / 60000))
    const member = await resolveMember(value("member"))
    const body = { work_id: work.id, started_at: startedAt, ended_at: endedAt, member_id: member?.id ?? null, ...(options.note ? { note: options.note } : {}), ...(minutes !== null ? { duration_minutes: minutes } : {}) }
    return output(await request("work_log", { method: "POST", body, prefer: "return=representation" }))
  }
  let log
  if (!has("id") && action === "stop" && work) {
    const rows = await request("work_log", { query: { work_id: `eq.${work.id}`, ended_at: "is.null", limit: 1 } })
    if (!rows.length) fail(`no active work log on ${nodeKey(work)}`)
    log = rows[0]
  } else {
    log = await one("work_log", { id: `eq.${value("id", true)}`, select: "*,node:work_id!inner(project_id)", "node.project_id": `eq.${p.id}` }, "work log")
    delete log.node
  }
  if (action === "get") return output(log)
  if (action === "stop") {
    const ended = options.ended || new Date().toISOString()
    const minutes = Math.max(0, Math.round((new Date(ended) - new Date(log.started_at)) / 60000))
    return output(await request("work_log", { method: "PATCH", query: { id: `eq.${log.id}` }, body: { ended_at: ended, duration_minutes: minutes, ...(options.note ? { note: options.note } : {}) }, prefer: "return=representation" }))
  }
  if (action === "update") {
    const body = patchFrom(["member_id", "started_at", "ended_at", "duration_minutes", "note"])
    if (has("member")) body.member_id = (await resolveMember(options.member))?.id ?? null
    else if (body.member_id) body.member_id = (await resolveMember(body.member_id)).id
    return output(await request("work_log", { method: "PATCH", query: { id: `eq.${log.id}` }, body, prefer: "return=representation" }))
  }
  if (action === "delete") { requireYes("work log delete"); await request("work_log", { method: "DELETE", query: { id: `eq.${log.id}` } }); return output({ deleted: log.id }) }
  fail("work-log action: list|get|start|create|stop|update|delete")
}

// ── 리포트 ──────────────────────────────────────────────────
async function reports() {
  const p = await project()
  if (action === "summary") return output(await rpc("project_summary", { p_project_id: p.id }))
  if (action === "progress") {
    if (has("node")) {
      const n = await resolveNode(options.node, p)
      const rows = await rpc("subtree_progress", { p_project_id: p.id, p_root: n.id })
      return output(rows.filter((r) => r.node_id === n.id).map((r) => ({ ...r, key: nodeKey(n) })))
    }
    const root = has("under") ? await resolveNode(options.under, p) : null
    const [prog, meta] = await Promise.all([
      rpc("subtree_progress", { p_project_id: p.id, p_root: root?.id ?? null }),
      fetchAll("node", { project_id: `eq.${p.id}`, select: "id,type,ticket_number,title,sort_order,created_at", order: "sort_order.asc,created_at.asc" }),
    ])
    const types = csv(options.type).length ? new Set(csv(options.type)) : new Set(["컨텐츠", "기능", "세부기능"])
    const byId = new Map(prog.map((r) => [r.node_id, r]))
    return output(meta.filter((n) => byId.has(n.id) && types.has(n.type)).map((n) => {
      const r = byId.get(n.id)
      return { key: nodeKey(n), id: n.id, title: n.title, total_urs: r.total_urs, done_urs: r.done_urs, progress: r.progress === null ? null : Number(r.progress) }
    }))
  }
  if (action === "coverage") {
    const f = await resolveNode(value("feature", true), p, "세부기능")
    return output(await request("ur_coverage", { query: { feature_id: `eq.${f.id}` } }))
  }
  if (action === "time") {
    const q = { select: "work_id,member_id,duration_minutes,node:work_id!inner(project_id,type,ticket_number,title)", "node.project_id": `eq.${p.id}`, ended_at: "not.is.null" }
    if (has("member")) q.member_id = `eq.${(await resolveMember(options.member)).id}`
    const range = []
    if (has("since")) range.push(`started_at.gte.${options.since}`)
    if (has("until")) range.push(`started_at.lt.${options.until}`)
    if (range.length) q.and = `(${range.join(",")})`
    let logs = await fetchAll("work_log", q)
    if (has("under")) { const { set } = await subtreeIds(p, (await resolveNode(options.under, p)).id); logs = logs.filter((l) => set.has(l.work_id)) }
    const members = new Map((await request("member", { query: { select: "id,display_name" } })).map((m) => [m.id, m.display_name]))
    const byWork = new Map(); const byMember = new Map(); let total = 0
    for (const l of logs) {
      const m = l.duration_minutes || 0; total += m
      const w = byWork.get(l.work_id) || { key: nodeKey(l.node), title: l.node?.title, minutes: 0 }; w.minutes += m; byWork.set(l.work_id, w)
      const mk = l.member_id ? members.get(l.member_id) ?? l.member_id : "(none)"; byMember.set(mk, (byMember.get(mk) || 0) + m)
    }
    return output({ total_minutes: total, log_count: logs.length, by_member: Object.fromEntries(byMember), by_work: [...byWork.values()].sort((a, b) => b.minutes - a.minutes) })
  }
  fail("report action: summary|progress|coverage|time")
}

// ── 통합 검색 ───────────────────────────────────────────────
async function search() {
  const p = await project()
  const text = String(options.query ?? action ?? "")
  if (!text) fail("--query is required")
  const limit = has("limit") ? integer(options.limit, "limit") : 20
  const t = pgQuote(`*${text}*`)
  const k = parseKey(text)
  const nodeOr = [`title.ilike.${t}`, `body.ilike.${t}`]
  if (k && KEY_TYPE[k.prefix]) nodeOr.push(`and(type.eq.${KEY_TYPE[k.prefix]},ticket_number.eq.${k.n})`)
  const urOr = [`text.ilike.${t}`, `description.ilike.${t}`]
  if (k && UR_PREFIXES.has(k.prefix)) urOr.push(`ticket_number.eq.${k.n}`)
  const [n, u] = await Promise.all([
    http("node", { query: { project_id: `eq.${p.id}`, or: `(${nodeOr.join(",")})`, select: "id,type,ticket_number,title,parent_id,st:status_id(name)", order: "type.asc,ticket_number.asc", limit }, prefer: "count=exact" }),
    http("ur", { query: { "node.project_id": `eq.${p.id}`, or: `(${urOr.join(",")})`, select: "id,ticket_number,text,status,feature_id,node:feature_id!inner(project_id,ticket_number)", order: "ticket_number.asc", limit }, prefer: "count=exact" }),
  ])
  const total = (h) => Number(String(h.get("content-range") || "").split("/")[1]) || 0
  return output({
    nodes: { total: total(n.headers), items: n.data.map((x) => ({ key: nodeKey(x), id: x.id, title: x.title, status: x.st?.name ?? null, parent_id: x.parent_id })) },
    urs: { total: total(u.headers), items: u.data.map((x) => ({ key: `Requirement-${x.ticket_number}`, id: x.id, text: x.text, status: x.status, feature_key: `SubFeature-${x.node?.ticket_number}` })) },
  })
}

// ── 커스텀 필드 ─────────────────────────────────────────────
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
  const def = await fieldDef(p, value("field", true))
  if (action === "get") return output(def)
  if (action === "update") return output(await request("field_def", { method: "PATCH", query: { id: `eq.${def.id}`, project_id: `eq.${p.id}` }, body: patchFrom(["key", "label", "type", "options", "applies_to", "default_value", "required", "sort_order"]), prefer: "return=representation" }))
  if (action === "delete") { requireYes("field definition delete (stored node values are not removed)"); await request("field_def", { method: "DELETE", query: { id: `eq.${def.id}`, project_id: `eq.${p.id}` } }); return output({ deleted: def.id }) }
  fail("field action: list|get|create|update|delete")
}

async function fieldValues() {
  const p = await project()
  const n = await resolveNode(value("node", true), p)
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
  const rows = await request("node", { method: "PATCH", query: { id: `eq.${n.id}`, project_id: `eq.${p.id}` }, body: { fields: next }, prefer: "return=representation" })
  return output({ node_id: n.id, fields: rows[0]?.fields ?? next })
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

const REF = "<UUID|key>"
const HELP = {
  name: "canopy",
  version: "1.1.0",
  description: "Canopy project-management CLI. JSON output and multi-project ownership checks.",
  usage: "canopy <group> <action> [options]",
  references: {
    node: "UUID or ticket key: Content-N, Feature-N, SubFeature-N, MasterData-N, Task-N.",
    ur: "UUID or Requirement-N.",
    status: "UUID or exact status name (e.g. 진행중).",
    member: "UUID or exact display_name.",
    "ur-group": "UUID, RequirementGroup-N, or exact name together with --feature.",
    "null": "Pass null (or none) to clear a reference or to filter for empty values.",
  },
  globalOptions: {
    "--project <UUID|exact-name>": "Required for project-scoped resources; UUID is recommended.",
    "--url <PostgREST-base>": "Override CANOPY_URL (default: live Canopy).",
    "--key <publishable-key>": "Override CANOPY_KEY.",
    "--json <object|@file|->": "Patch/create payload where supported. Any JSON option also accepts @path (file) or - (stdin).",
    "--items <JSON array>": "Bulk create (node, ur, checklist, ur-link) in one request.",
    "--limit N --offset N": "Paginate list/search; response then includes page {limit, offset, total}.",
    "--select <cols>": "PostgREST column list for list/get (default omits long markdown).",
    "--full": "Return all columns, including node.body / ur.description.",
    "--compact": "Emit compact JSON.",
    "--quiet": "Suppress successful output.",
    "--yes": "Confirm destructive deletes.",
    "--help": "Show help for a group or action.",
  },
  tokenTips: [
    "Start with 'node tree' (lines, no UUIDs) or 'report summary'; keys work everywhere UUIDs do.",
    "List commands omit node.body and ur.description; use 'node get/show' or --full when the text is needed.",
    "Use filters (--type --status --under --uncovered --query) and --limit instead of listing everything.",
    "Use --items / --ids for bulk work instead of one command per row.",
  ],
  shellNotes: [
    "Windows PowerShell 5.1 strips double quotes from native-command arguments, so inline JSON breaks. Write the JSON to a file and pass --items @items.json (or --json @patch.json), or pipe it: Get-Content items.json | canopy ... --items -",
    "Prefer named options (--title --status --text ...) over --json when you only set a few fields.",
  ],
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
      list: "List members.", get: "Get --id <UUID|name>.", create: "Create --name [--color].",
      update: "Update --id with --display-name/--color/--json.", delete: "Delete --id; requires --yes.",
    } },
    status: { description: "Project-specific workflow statuses.", actions: {
      list: "List for --project.", get: "Get --id <UUID|name>.",
      create: "Create with --project --name --category <할일|진행중|완료|취소됨> [--color] [--sort-order].",
      update: "Update --project --id using named options or --json.", reassign: "Move nodes from --id to --to <status|null> within --project.",
      delete: "Delete --project --id; requires --yes.",
    } },
    node: { description: "Tree nodes: 컨텐츠 > 기능 > (세부기능|마스터데이터) > 작업.", actions: {
      list: `List --project (body omitted). Filters: --type CSV --parent ${REF}|null --under ${REF} (subtree) --status CSV --category CSV --assignee --domain CSV --priority --field-filter key=value --updated-since ISO --query; --limit/--offset --order.`,
      search: "Search --project --query in title/body (also matches keys like Task-12); accepts list filters; default --limit 50.",
      tree: `Compact hierarchy: one line per node "Key title [status]". Options: --root ${REF} --depth N --exclude-type 작업 --progress --ids --format lines|json.`,
      get: `Get --project --id ${REF} with body, status and assignee names.`,
      show: `One-call detail for --id ${REF}: node, breadcrumb path, progress, children; plus URs/groups (세부기능) or checklist/URs/links/work-log summary (작업).`,
      create: `Create --project --parent ${REF}|null --type --title [--body --status --domain --assignee --sort-order]. Bulk: --items '[{"parent":"SubFeature-3","type":"작업","title":"..","domain":"구현"}]' (--parent is the default). sort_order defaults to end of siblings.`,
      update: `Update --project --id ${REF} (or --ids CSV for bulk) with --title --body --status --assignee --domain --sort-order --time-spent-minutes or --json.`,
      move: `Re-parent --project --id ${REF} --parent ${REF}|null [--sort-order]; hierarchy rules are enforced by the DB.`,
      delete: "Delete --project --id and descendants; requires --yes.",
    } },
    "ur-group": { description: "Requirement groups owned by a 세부기능.", actions: {
      list: `List --project --feature ${REF}.`, get: "Get --project --id <UUID|RequirementGroup-N>.",
      create: "Create --project --feature --name [--sort-order]; ticket number is auto-issued (key RequirementGroup-N).", update: "Update --project --id with --name/--sort-order/--json.",
      delete: "Delete --project --id; URs become ungrouped; requires --yes.",
    } },
    ur: { description: "User requirements owned by a 세부기능.", actions: {
      list: `List --project (description omitted). Scope: --feature ${REF} or --under ${REF} or whole project. Filters: --status CSV --group <ref|null> --query --uncovered (no linked 작업 and not 완료); --limit/--offset.`,
      search: "Search --project --query in text/description; accepts list filters; default --limit 50.",
      get: "Get --project --id <UUID|Requirement-N> with description and linked works.",
      create: `Create --project --feature ${REF} --text [--description --group --sort-order]. Bulk: --items '[{"text":"..","description":"..","group":"전투"}]' (each item may set feature).`,
      update: "Update --project --id (or --ids CSV) with --text --description --group --status <완료|미구현|오구현> --misimpl-reason --sort-order --feature-id (move) or --json. Non-오구현 status clears misimpl_reason.",
      delete: "Delete --project --id (or --ids CSV); requires --yes.",
    } },
    "ur-link": { description: "Many-to-many UR and 작업 links.", actions: {
      list: "List --project with --ur, --work or --feature (includes keys/titles).",
      create: "Link --project --ur CSV --work CSV (every pair; duplicates ignored) or --items '[{\"ur\":\"Requirement-1\",\"work\":\"Task-2\"}]'.",
      delete: "Unlink the same pair forms as create.",
    } },
    checklist: { description: "Task checklist items.", actions: {
      list: `List --project --work ${REF}.`, get: "Get --project --id.",
      create: "Create --project --work --text [--sort-order], or bulk --items '[\"a\",\"b\"]' / '[{\"text\":\"a\",\"done\":true}]'.",
      update: "Update --project --id [--text --done --sort-order].",
      delete: "Delete --project --id; requires --yes.",
    } },
    "node-link": { description: "Node relations: blocks or relates.", actions: {
      list: "List --project with --node (both directions), --from and/or --to [--type].",
      create: "Create --project --from --to --type <blocks|relates>.",
      delete: "Delete --project --id, or --from --to --type; requires --yes.",
    } },
    "work-log": { description: "Task work sessions and Markdown notes.", actions: {
      list: "List --project [--work] [--member --since ISO --until ISO --active]; project-wide default --limit 100.",
      get: "Get --project --id.",
      start: "Start --project --work [--member --note].",
      stop: "Stop --project --id, or --work to stop its active log [--ended ISO --note].",
      create: "Create a completed/backfilled log --project --work [--started ISO --ended ISO --minutes N --member --note]; duration auto-computed from started/ended when --minutes omitted.",
      update: "Update --project --id; fields include member, started_at, ended_at, duration_minutes, note.",
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
    report: { description: "Read-only computed views (server-side aggregation).", actions: {
      summary: "Dashboard summary for --project: node counts, UR status counts, uncovered URs, task status categories, content progress.",
      progress: `Roll-up progress. --node ${REF} for one node, else list for --type CSV (default 컨텐츠,기능,세부기능) [--under ${REF}].`,
      coverage: "Per-UR coverage for --project --feature.",
      time: `Logged minutes by member and 작업 [--member --since --until --under ${REF}].`,
    } },
    search: { description: "Search nodes and URs at once: canopy search --project P --query <text|key> [--limit 20].", actions: {} },
    raw: { description: "Low-level deployed PostgREST escape hatch; prefer normal commands.", actions: {
      get: "GET --table [--query JSON].", post: "POST --table --json; requires --unsafe.",
      patch: "PATCH --table --id --json; requires --unsafe.", delete: "DELETE --table --id; requires --unsafe --yes.",
    } },
  },
  examples: [
    "canopy project list",
    "canopy node tree --project <PID> --exclude-type 작업 --progress",
    "canopy node show --project <PID> --id SubFeature-3",
    "canopy ur list --project <PID> --under Feature-2 --uncovered",
    "canopy node create --project <PID> --parent SubFeature-3 --items '[{\"type\":\"작업\",\"title\":\"합성 UI\",\"domain\":\"구현\"}]'",
    "canopy ur-link create --project <PID> --ur Requirement-4,Requirement-5 --work Task-12",
    "canopy node update --project <PID> --ids Task-1,Task-2 --status 완료",
    "canopy work-log stop --project <PID> --work Task-12",
    "canopy search --project <PID> --query 합성",
    "canopy help --json",
  ],
}

function help(targetGroup, targetAction, asJson = false) {
  if (asJson) {
    if (targetGroup && !HELP.groups[targetGroup]) fail(`Unknown help group: ${targetGroup}`)
    if (targetAction && !HELP.groups[targetGroup]?.actions[targetAction]) fail(`Unknown action: ${targetGroup} ${targetAction}`)
    const data = targetGroup ? { ...HELP, groups: { [targetGroup]: HELP.groups[targetGroup] } } : HELP
    return output(targetAction ? { group: targetGroup, action: targetAction, description: HELP.groups[targetGroup].actions[targetAction], references: HELP.references, globalOptions: HELP.globalOptions, safety: HELP.safety } : data)
  }
  if (!targetGroup) {
    const groups = Object.entries(HELP.groups).map(([name, spec]) => `  ${name.padEnd(12)} ${Object.keys(spec.actions).join("|") || spec.description}`).join("\n")
    console.log(`Canopy CLI v${HELP.version}\n${HELP.description}\n\nUsage: ${HELP.usage}\n\nGroups:\n${groups}\n\nReferences: nodes accept Task-12 style keys, URs Requirement-N, statuses/members names.\nRun 'canopy <group> --help' or 'canopy <group> <action> --help'.\nFor machine-readable documentation: canopy help --json`)
    return
  }
  const spec = HELP.groups[targetGroup]
  if (!spec) fail(`Unknown help group: ${targetGroup}`)
  if (targetAction) {
    const description = spec.actions[targetAction]
    if (!description) fail(`Unknown action: ${targetGroup} ${targetAction}`)
    console.log(`Usage: canopy ${targetGroup} ${targetAction} [options]\n\n${description}\n\nGlobal: --project --limit --offset --select --full --items --url --key --compact --quiet --help\nSafety: ${HELP.safety.join(" ")}`)
    return
  }
  const actions = Object.entries(spec.actions).map(([name, description]) => `  ${name.padEnd(10)} ${description}`).join("\n")
  console.log(`${targetGroup}: ${spec.description}\n\nUsage: canopy ${targetGroup} <action> [options]\n\nActions:\n${actions}\n\nRun 'canopy ${targetGroup} <action> --help' for action help.`)
}

const handlers = { project: projects, member: members, status: statuses, node: nodes, "ur-group": urGroups, ur: urs, "ur-link": urLinks, checklist, "node-link": nodeLinks, "work-log": workLogs, field: fields, "field-value": fieldValues, priority: priorities, report: reports, search, raw }
if (!group) help()
else if (group === "help") help(action, undefined, options.json === true)
else if (options.help) help(group, group === "search" ? undefined : action, options.json === true)
else if (!handlers[group]) fail(`Unknown group: ${group}`)
else handlers[group]().catch((error) => fail(error?.message || String(error)))
