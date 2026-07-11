import { describe, it, expect } from "vitest"
import { spawnSync } from "node:child_process"

function run(...args) {
  return spawnSync(process.execPath, ["cli/canopy.mjs", ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
  })
}

describe("Canopy CLI", () => {
  it("prints the complete command surface", () => {
    const result = run("help")
    expect(result.status).toBe(0)
    for (const group of [
      "project", "member", "status", "node", "ur-group", "ur", "ur-link",
      "checklist", "node-link", "work-log", "field", "field-value", "priority", "report", "raw",
    ]) expect(result.stdout).toContain(group)
  })

  it("prints group and action-specific help", () => {
    const group = run("node", "--help")
    expect(group.status).toBe(0)
    expect(group.stdout).toContain("create     Create --project")
    const action = run("priority", "set", "--help")
    expect(action.status).toBe(0)
    expect(action.stdout).toContain("--value")
  })

  it("exposes machine-readable help for agents", () => {
    const result = run("help", "--json", "--compact")
    expect(result.status).toBe(0)
    const help = JSON.parse(result.stdout).data
    expect(help.groups.node.actions.create).toContain("--project")
    expect(help.groups.priority.actions.set).toContain("--value")
    expect(help.safety).toContain("Read the target before a live write.")
  })

  it("requires an explicit project for scoped resources", () => {
    const result = run("node", "list")
    expect(result.status).toBe(1)
    expect(JSON.parse(result.stderr).error).toContain("--project is required")
  })

  it("requires a project for field commands", () => {
    const result = run("field", "list")
    expect(result.status).toBe(1)
    expect(JSON.parse(result.stderr).error).toContain("--project")
  })

  it("requires an explicit unsafe flag for raw writes", () => {
    const result = run("raw", "post", "--table", "node", "--json", "{}")
    expect(result.status).toBe(1)
    expect(JSON.parse(result.stderr).error).toContain("--unsafe")
  })

  it("requires confirmation for destructive operations", () => {
    const result = run("raw", "delete", "--table", "node", "--id", "x", "--unsafe")
    expect(result.status).toBe(1)
    expect(JSON.parse(result.stderr).error).toContain("--yes")
  })
})
