import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import App from "./App.tsx"
import { AuthProvider } from "@/auth/AuthProvider"
import { ThemeProvider } from "next-themes"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* 테마: 라이트/다크/시스템(기본). 첫 페인트는 index.html 인라인 스크립트가 처리. */}
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey="canopy.theme"
      disableTransitionOnChange
    >
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>
)
