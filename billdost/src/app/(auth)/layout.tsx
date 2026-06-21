import Link from 'next/link'
import ThemeToggle from '@/components/shared/Themetoggle'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#09090B] flex flex-col relative overflow-hidden transition-colors duration-500">
      {/* Subtle Apple-style mesh background blobs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-[#1B7A4A]/10 dark:bg-[#25D366]/10 blur-[120px] mix-blend-multiply dark:mix-blend-screen opacity-50 dark:opacity-20 animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute top-[20%] -right-[10%] w-[40%] h-[40%] rounded-full bg-blue-500/5 dark:bg-blue-400/10 blur-[100px] mix-blend-multiply dark:mix-blend-screen opacity-50 dark:opacity-20 animate-pulse" style={{ animationDuration: '10s' }} />
        <div className="absolute -bottom-[20%] left-[20%] w-[60%] h-[60%] rounded-full bg-[#1B7A4A]/5 dark:bg-[#25D366]/5 blur-[120px] mix-blend-multiply dark:mix-blend-screen opacity-50 dark:opacity-20 animate-pulse" style={{ animationDuration: '12s' }} />
      </div>

      {/* Top bar */}
      <header className="px-6 py-5 flex justify-between items-center relative z-10">
        <Link
          href="/"
          className="inline-block font-extrabold text-[22px] tracking-tight hover:opacity-80 transition-opacity"
          style={{ fontFamily: 'var(--font-display, "Syne", sans-serif)' }}
        >
          <span className="text-[#1D1D1F] dark:text-[#F5F5F7]">Bill</span>
          <span className="text-[#1B7A4A] dark:text-[#25D366]">Dost</span>
        </Link>
        <ThemeToggle />
      </header>

      {/* Center content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 md:py-12 relative z-10 w-full">
        <div className="w-full max-w-[440px] animate-in fade-in zoom-in-95 duration-500 ease-out">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-6 text-center text-[13px] font-medium text-[#86868B] dark:text-[#98989D] relative z-10">
        © {new Date().getFullYear()} BillDost Technologies Pvt Ltd · Built in Bengaluru 🇮🇳
      </footer>
    </div>
  )
}
