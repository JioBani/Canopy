import { useAuth } from "@/auth/AuthProvider"
import { RequireAuth } from "@/auth/RequireAuth"
import { Button } from "@/components/ui/button"

function Dashboard() {
  const { user, signOut } = useAuth()

  return (
    <div className="min-h-svh">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <h1 className="text-lg font-semibold">Canopy</h1>
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground text-sm">{user?.email}</span>
          <Button variant="outline" size="sm" onClick={signOut}>
            로그아웃
          </Button>
        </div>
      </header>
      <main className="p-6">
        <p className="text-muted-foreground text-sm">
          인프라 골격이 준비되었습니다. 기획서.md 확정 후 기능 구현을 시작합니다.
        </p>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <RequireAuth>
      <Dashboard />
    </RequireAuth>
  )
}
