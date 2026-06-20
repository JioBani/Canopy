import type { ReactNode } from "react"
import { useAuth } from "@/auth/AuthProvider"

/**
 * 진입 가드(완화). 팀 내부용이라 로그인 없이 바로 사용한다 — 세션 검사 없이 통과.
 * 인증 코드(AuthProvider/LoginPage)는 추후 멤버 기능을 위해 남겨두되 게이트는 걸지 않는다.
 * (DB 접근은 anon 역할 — RLS 0002 에서 anon 전체 허용.)
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <p className="text-muted-foreground text-sm">불러오는 중…</p>
      </div>
    )
  }

  return <>{children}</>
}
