import { createClient } from "@supabase/supabase-js"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // 개발 초기에 .env 누락을 빨리 알아채기 위한 가드.
  // 실제 Supabase 프로젝트 생성 후 .env 에 키를 채우면 사라진다.
  console.warn(
    "[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 가 설정되지 않았습니다. .env 를 확인하세요 (.env.example 참고)."
  )
}

export const supabase = createClient(supabaseUrl ?? "", supabaseAnonKey ?? "")
