import { defineConfig, devices } from "@playwright/test"

const PORT = 5174
// Vite dev 서버는 localhost(IPv6 ::1)에 바인딩되므로 127.0.0.1 대신 localhost 사용.
const BASE_URL = `http://localhost:${PORT}`

/**
 * 프론트 E2E. dev 서버를 `--mode e2e` 로 띄워 .env.e2e(로컬 Supabase) 를 주입한다.
 * → 실(.env) 프로젝트가 아닌 로컬 Supabase 를 대상으로 인증/데이터가 돈다.
 * 전제: `npx supabase start` 로 로컬 스택이 떠 있어야 한다.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  // 공유 로컬 Supabase 를 대상으로 하고 일부 스펙이 전역 데이터를 wipe 하므로
  // 단일 워커로 직렬 실행해 스펙 간 간섭을 막는다.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: `npm run dev -- --mode e2e --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
})
