import path from "node:path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    // 데모 URL 을 결정적으로: 5173 점유 시 자동 증가하지 않고 명확히 실패.
    port: 5173,
    strictPort: true,
  },
})
