import { defineConfig } from "vitest/config"

// 백엔드 E2E (로컬 Supabase 대상). 프론트 단위테스트가 생기면 별도 project 로 분리.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/backend/**/*.test.ts", "tests/unit/**/*.test.ts"],
    testTimeout: 20000,
    hookTimeout: 20000,
    // DB 상태 공유 자원이므로 파일 간 병렬 실행을 피해 격리/안정성 우선.
    fileParallelism: false,
  },
})
