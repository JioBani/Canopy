import { useState, type FormEvent } from "react"
import { useAuth } from "@/auth/AuthProvider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Mode = "login" | "signup"

export function LoginPage() {
  const { signInWithPassword, signUpWithPassword } = useAuth()
  const [mode, setMode] = useState<Mode>("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error } =
      mode === "login"
        ? await signInWithPassword(email, password)
        : await signUpWithPassword(email, password)
    setSubmitting(false)
    if (error) setError(error)
    // 성공 시 onAuthStateChange 가 세션을 채우고 RequireAuth 가 통과시킨다.
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="font-display text-2xl font-bold tracking-tight">Canopy</h1>
        <p className="text-muted-foreground text-sm">
          게임 기획 계층 관리 도구 — 로그인이 필요합니다.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-4"
        data-testid="auth-form"
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">이메일</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            data-testid="email-input"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">비밀번호</Label>
          <Input
            id="password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            data-testid="password-input"
          />
        </div>

        {error && (
          <p className="text-destructive text-sm" data-testid="auth-error">
            {error}
          </p>
        )}

        <Button type="submit" disabled={submitting} data-testid="submit-button">
          {submitting
            ? "처리 중…"
            : mode === "login"
              ? "로그인"
              : "회원가입"}
        </Button>

        <button
          type="button"
          className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
          onClick={() => {
            setMode((m) => (m === "login" ? "signup" : "login"))
            setError(null)
          }}
          data-testid="toggle-mode"
        >
          {mode === "login"
            ? "계정이 없나요? 회원가입"
            : "이미 계정이 있나요? 로그인"}
        </button>
      </form>

      {/*
        배포용 구글 로그인 — 배포 직전 활성화.
        구글 OAuth 클라이언트/리디렉트 설정 후 아래 주석을 해제하면 된다.

        <div className="flex w-full max-w-sm flex-col gap-2">
          <div className="text-muted-foreground text-center text-xs">또는</div>
          <Button variant="outline" onClick={signInWithGoogle}>
            Google 계정으로 로그인
          </Button>
        </div>
      */}
    </div>
  )
}
