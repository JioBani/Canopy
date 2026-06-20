import { describe, expect, it } from "vitest"
import { validateProjectName } from "../../src/lib/validation"
import { ticketKey, urKey, TICKET_PREFIX } from "../../src/nodes/nodeGrammar"

describe("validateProjectName", () => {
  it("정상값은 null", () => {
    expect(validateProjectName("타티카 디펜스")).toBeNull()
  })
  it("빈/공백만은 거부", () => {
    expect(validateProjectName("")).not.toBeNull()
    expect(validateProjectName("   ")).not.toBeNull()
  })
})

describe("ticketKey (타입 기반)", () => {
  it("{Type}-{번호} 로 조합한다", () => {
    expect(ticketKey("작업", 42)).toBe("Task-42")
    expect(ticketKey("컨텐츠", 1)).toBe("Content-1")
    expect(ticketKey("기능", 3)).toBe("Feature-3")
    expect(ticketKey("세부기능", 7)).toBe("SubFeature-7")
    expect(ticketKey("마스터데이터", 2)).toBe("MasterData-2")
  })
  it("모든 노드 타입에 프리픽스가 있다", () => {
    expect(Object.values(TICKET_PREFIX)).toEqual([
      "Content",
      "Feature",
      "SubFeature",
      "MasterData",
      "Task",
    ])
  })
})

describe("urKey (요구사항)", () => {
  it("Requirement-{번호} 로 조합한다", () => {
    expect(urKey(3)).toBe("Requirement-3")
  })
})
