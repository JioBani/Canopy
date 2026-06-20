import { describe, expect, it } from "vitest"
import {
  allowedChildTypes,
  isLeafType,
  ALLOWED_CHILDREN,
} from "../../src/nodes/nodeGrammar"

describe("allowedChildTypes", () => {
  it("최상위(null)는 컨텐츠만 허용", () => {
    expect(allowedChildTypes(null)).toEqual(["컨텐츠"])
  })
  it("컨텐츠 → 기능", () => {
    expect(allowedChildTypes("컨텐츠")).toEqual(["기능"])
  })
  it("기능 → 세부기능, 마스터데이터", () => {
    expect(allowedChildTypes("기능")).toEqual(["세부기능", "마스터데이터"])
  })
  it("세부기능/마스터데이터 → 작업", () => {
    expect(allowedChildTypes("세부기능")).toEqual(["작업"])
    expect(allowedChildTypes("마스터데이터")).toEqual(["작업"])
  })
  it("작업은 자식 없음(잎)", () => {
    expect(allowedChildTypes("작업")).toEqual([])
  })
})

describe("isLeafType", () => {
  it("작업만 잎", () => {
    expect(isLeafType("작업")).toBe(true)
    expect(isLeafType("컨텐츠")).toBe(false)
    expect(isLeafType("기능")).toBe(false)
  })
})

describe("ALLOWED_CHILDREN 무결성", () => {
  it("기획서 §5 규칙과 일치", () => {
    expect(ALLOWED_CHILDREN).toEqual({
      컨텐츠: ["기능"],
      기능: ["세부기능", "마스터데이터"],
      세부기능: ["작업"],
      마스터데이터: ["작업"],
      작업: [],
    })
  })
})
