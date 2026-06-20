import { useAuth } from "@/auth/AuthProvider"
import { Button } from "@/components/ui/button"

export function LoginPage() {
  const { signInWithGoogle } = useAuth()

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Canopy</h1>
        <p className="text-muted-foreground text-sm">
          게임 기획 계층 관리 도구 — 로그인이 필요합니다.
        </p>
      </div>
      <Button onClick={signInWithGoogle} size="lg">
        Google 계정으로 로그인
      </Button>
    </div>
  )
}
