import Link from 'next/link'
import { LANDING_URL } from '@/lib/site'

/**
 * Public signup is closed (Admin Portal plan, Sections 1 and 8).
 * BillDost is invite-only: the BillDost team reviews a request, calls
 * the shop, sets the shop up in the admin portal, and sends a one-time
 * activation link. This route stays alive so old links and bookmarks
 * land somewhere honest, and it creates nothing.
 */
export default function SignupClosedPage() {
  return (
    <div className="w-full">
      <div className="text-center mb-10">
        <h1
          className="text-[32px] md:text-[40px] font-extrabold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight leading-tight mb-3"
          style={{ fontFamily: 'var(--font-display, "Syne", sans-serif)' }}
        >
          BillDost is invite-only
        </h1>
        <p className="text-[15px] text-[#6E6E73] dark:text-[#98989D] font-medium max-w-sm mx-auto leading-relaxed">
          We set up every shop personally. Tell us about your shop, we
          will call you, set everything up, and send you your link.
        </p>
      </div>

      <div className="bg-white/70 dark:bg-[#1C1C1E]/70 backdrop-blur-2xl border border-black/5 dark:border-white/5 rounded-[32px] p-6 md:p-8 shadow-2xl shadow-black/5 dark:shadow-black/20">
        <div className="space-y-4 mb-8">
          {[
            'Fill the short Request Access form on our website',
            'We call you on your WhatsApp number and confirm your shop',
            'We set up your shop and send your personal activation link',
            'You set your password and start billing, everything ready',
          ].map((step, i) => (
            <div key={step} className="flex items-start gap-3">
              <span className="w-6 h-6 shrink-0 rounded-full bg-[#1B7A4A]/10 dark:bg-[#25D366]/10 text-[#1B7A4A] dark:text-[#25D366] text-[13px] font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <p className="text-[15px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] leading-relaxed">
                {step}
              </p>
            </div>
          ))}
        </div>

        <a
          href={LANDING_URL}
          className="block w-full py-4 bg-[#1B7A4A] dark:bg-[#25D366] hover:bg-[#155F3A] dark:hover:bg-[#1DA951] active:scale-[0.98] text-white dark:text-[#1D1D1F] font-bold text-[15px] rounded-2xl text-center transition-all duration-300 shadow-sm shadow-[#1B7A4A]/20"
        >
          Request Access
        </a>

        <p className="text-center text-[14px] font-medium text-[#6E6E73] dark:text-[#98989D] mt-6">
          Already activated?{' '}
          <Link
            href="/login"
            className="text-[#1B7A4A] dark:text-[#25D366] font-bold hover:underline underline-offset-4"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
