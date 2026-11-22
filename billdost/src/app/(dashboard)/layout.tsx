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
    // No shop access at all. BillDost is invite-only: shops are created
    // by the BillDost team from the admin portal, so there is no
    // self-serve onboarding to send anyone to. The no-shop page
    // explains the state calmly.
    redirect('/no-shop')
  }

  // Double check onboarding done
  if (!shop || !shop.onboarding_done) {
    redirect('/no-shop')
  }

  // A suspended shop keeps its data but cannot be used until the
  // BillDost team reactivates it (Admin Portal plan, Section 3).
  if (shop.status === 'suspended') {
    redirect('/no-shop?suspended=1')
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
      <ChatbotLazy shopName={shop.name} />
    </>
  )
}