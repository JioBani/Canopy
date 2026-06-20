import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import type { Session, User } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"

interface AuthResult {
  error: string | null
}

interface AuthContextValue {
  session: Session | null
  user: User | null
  loading: boolean
  /** 개발용 이메일+비밀번호 로그인 */
  signInWithPassword: (email: string, password: string) => Promise<AuthResult>
  /** 개발용 이메일+비밀번호 회원가입 (Confirm email off 전제 → 가입 즉시 세션) */
  signUpWithPassword: (email: string, password: string) => Promise<AuthResult>
  /** 배포용 구글 로그인 (현재는 보조) */
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 초기 세션 복원
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    // 이후 로그인/로그아웃 등 상태 변화 구독
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signInWithPassword(
    email: string,
    password: string
  ): Promise<AuthResult> {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  async function signUpWithPassword(
    email: string,
    password: string
  ): Promise<AuthResult> {
    const { error } = await supabase.auth.signUp({ email, password })
    return { error: error?.message ?? null }
  }

  // 배포용 구글 로그인 — 지금은 보조. 배포 직전 구글 OAuth 설정 후 LoginPage 에서 노출.
  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    })
    if (error) {
      console.error("[auth] 구글 로그인 실패:", error.message)
    }
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error("[auth] 로그아웃 실패:", error.message)
    }
  }

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    loading,
    signInWithPassword,
    signUpWithPassword,
    signInWithGoogle,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error("useAuth 는 <AuthProvider> 내부에서만 사용할 수 있습니다.")
  }
  return ctx
}
