import { describe, expect, it } from "vitest"
import {
  sanitizeKeyPrefix,
  validateKeyPrefix,
  validateProjectName,
  ticketKey,
} from "../../src/lib/validation"

describe("sanitizeKeyPrefix", () => {
  it("소문자를 대문자로 바꾼다", () => {
    expect(sanitizeKeyPrefix("td")).toBe("TD")
  })
  it("공백/기호를 제거한다", () => {
    expect(sanitizeKeyPrefix("t d-1!")).toBe("TD1")
  })
  it("한글 등 비영숫자를 제거한다", () => {
    expect(sanitizeKeyPrefix("타티카TD")).toBe("TD")
  })
  it("최대 10자로 자른다", () => {
    expect(sanitizeKeyPrefix("ABCDEFGHIJKLMNOP")).toBe("ABCDEFGHIJ")
  })
})

describe("validateKeyPrefix", () => {
  it("정상값은 null", () => {
    expect(validateKeyPrefix("TD")).toBeNull()
    expect(validateKeyPrefix("ABC123")).toBeNull()
  })
  it("2자 미만은 거부", () => {
    expect(validateKeyPrefix("T")).not.toBeNull()
    expect(validateKeyPrefix("")).not.toBeNull()
  })
  it("10자 초과는 거부", () => {
    expect(validateKeyPrefix("ABCDEFGHIJK")).not.toBeNull()
  })
  it("비영숫자 포함은 거부", () => {
    expect(validateKeyPrefix("T D")).not.toBeNull()
    expect(validateKeyPrefix("td")).not.toBeNull() // 소문자(정규화 전 가정)
  })
})

describe("validateProjectName", () => {
  it("정상값은 null", () => {
    expect(validateProjectName("타티카 디펜스")).toBeNull()
  })
  it("빈/공백만은 거부", () => {
    expect(validateProjectName("")).not.toBeNull()
    expect(validateProjectName("   ")).not.toBeNull()
  })
})

describe("ticketKey", () => {
  it("프리픽스-번호로 조합한다", () => {
    expect(ticketKey("TD", 42)).toBe("TD-42")
  })
})
