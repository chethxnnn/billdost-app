import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function Home() {
  let user = null
  try {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    user = data?.user
  } catch {
    user = null
  }

  if (user) {
    redirect('/dashboard')
  } else {
    redirect('/login')
  }
}
