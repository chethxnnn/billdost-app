import { createClient as createServiceClient } from '@supabase/supabase-js'
import SignOutButton from './sign-out-button'

/**
 * The calm landing page for a signed-in account that cannot enter a
 * shop right now (Admin Portal plan, Sections 3 and 8). Two cases:
 * the account has no live shop yet (activation pending, or an account
 * with no shop at all), or the shop is suspended. No raw errors, no
 * dead ends: what happened, and the one thing to do next.
 */
export const dynamic = 'force-dynamic'

async function supportPhone(): Promise<string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return ''
  try {
    const supabase = createServiceClient(url, key)
    const { data } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'support_phone')
      .single()
    return (data?.value as string) ?? ''
  } catch {
    return ''
  }
}

export default async function NoShopPage({
  searchParams,
}: {
  searchParams: Promise<{ suspended?: string }>
}) {
  const params = await searchParams
  const suspended = params.suspended === '1'
  const phone = await supportPhone()

  return (
    <div className="min-h-screen bg-[#F5F5F7] dark:bg-black flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[440px] bg-white dark:bg-[#1C1C1E] border border-black/5 dark:border-white/10 rounded-[32px] p-8 md:p-10 shadow-2xl shadow-black/5 text-center">
        <div className="w-20 h-20 bg-[#1B7A4A]/10 dark:bg-[#25D366]/10 rounded-[24px] flex items-center justify-center mx-auto mb-6 text-4xl">
          {suspended ? '⏸️' : '🏪'}
        </div>
        <h1 className="text-[26px] font-extrabold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight mb-3">
          {suspended ? 'Your shop is paused' : 'Your shop is not active yet'}
        </h1>
        <p className="text-[15px] text-[#6E6E73] dark:text-[#98989D] font-medium leading-relaxed mb-8">
          {suspended
            ? 'Your data is completely safe. Your shop has been paused by the BillDost team. Please call us and we will sort it out together.'
            : 'This account does not have a live shop yet. If you received an activation link from us, please open that link to set your password and enter your shop. If your shop was already active, please call us.'}
        </p>
        <div className="flex flex-col gap-3">
          {phone ? (
            <a
              href={`tel:${phone.replace(/\s/g, '')}`}
              className="w-full py-4 bg-[#1B7A4A] dark:bg-[#25D366] hover:bg-[#155F3A] dark:hover:bg-[#1DA951] active:scale-[0.98] text-white dark:text-[#1D1D1F] font-bold text-[15px] rounded-2xl transition-all duration-300"
            >
              Call us: {phone}
            </a>
          ) : null}
          <SignOutButton />
        </div>
      </div>
    </div>
  )
}
