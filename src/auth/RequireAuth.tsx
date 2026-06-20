import type { ReactNode } from "react"
import { useAuth } from "@/auth/AuthProvider"
import { LoginPage } from "@/auth/LoginPage"

/**
 * 세션 가드. 로그인 안 된 사용자는 LoginPage 로 막는다.
 * 내부용이라 권한(role) 구분 없이 "로그인했는가"만 검사한다.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <p className="text-muted-foreground text-sm">불러오는 중…</p>
      </div>
    )
  }

  if (!session) {
    return <LoginPage />
  }

  return <>{children}</>
}
