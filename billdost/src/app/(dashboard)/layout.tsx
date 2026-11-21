import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolveShopAndRole } from '@/server/utils/auth'
import DashboardShell from '@/components/dashboard/DashboardShell'

import { ChatbotLazy } from '@/components/ChatbotLazy'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Fetch shop and role using our auth util
  let shop = null
  let role = 'owner'

  try {
    const res = await resolveShopAndRole(supabase, user.id)
    shop = res.shop
    role = res.role
  } catch (err) {
    // If they have no shop access at all, send to onboarding
    redirect('/onboarding')
  }

  // Double check onboarding done
  if (!shop || !shop.onboarding_done) {
    redirect('/onboarding')
  }

  return (
    <>
      <DashboardShell
        shopId={shop.id}
        shopName={shop.name}
        shopCategory={shop.category}
        shopLanguage={shop.language}
        userEmail={user.email || ''}
        userName={user.user_metadata?.full_name || shop.name}
        role={role}
      >
        {children}
      </DashboardShell>
      <ChatbotLazy />
    </>
  )
}