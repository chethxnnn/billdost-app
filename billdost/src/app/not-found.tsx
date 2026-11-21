import Link from 'next/link'

/**
 * 404 in the app's voice: calm, human, one clear way home. No raw
 * framework error surface (design brief error-state rule).
 */
export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg text-center">
        <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
          Ye page nahi mila
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[#6E6E73] dark:text-[#98989D]">
          Shayad link purana hai ya page hat gaya hai. Aapka saara data bilkul safe hai,
          dashboard se phir shuru karte hain.
        </p>
        <div className="mt-6 flex justify-center">
          <Link
            href="/dashboard"
            className="tap inline-flex items-center justify-center min-h-[48px] px-6 rounded-full bg-[#1B7A4A] hover:bg-[#155F3A] text-white font-bold text-[15px] transition-colors"
          >
            Dashboard Jao
          </Link>
        </div>
      </div>
    </div>
  )
}
