'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import StepBusinessInfo from '@/components/onboarding/StepBusinessInfo'
import StepCategory from '@/components/onboarding/StepCategory'
import StepGST from '@/components/onboarding/StepGST'
import StepCatalog from '@/components/onboarding/StepCatalog'
import StepUPI from '@/components/onboarding/StepUPI'
import StepLanguage from '@/components/onboarding/StepLanguage'
import StepAdmin from '@/components/onboarding/StepAdmin'
import StepComplete from '@/components/onboarding/StepComplete'
import AnimatedOnboardingProcess from '@/components/onboarding/AnimatedOnboardingProcess'

import type { OnboardingData } from '@/components/onboarding/types'
import { TRPCProvider } from '@/components/shared/TRPCProvider'
import { trpc } from '@/lib/trpc/client'

const INITIAL_DATA: OnboardingData = {
  shopName: '',
  logoFile: null,
  logoPreview: '',
  category: '',
  hasGST: false,
  gstin: '',
  products: [],
  upiId: '',
  upiQrFile: null,
  upiQrPreview: '',
  includeUpiQr: true,
  language: 'hinglish',
  staffMembers: [],
}

const STEPS = [
  { id: 'business', label: 'Business', icon: '🏪' },
  { id: 'category', label: 'Category', icon: '📂' },
  { id: 'gst', label: 'GST', icon: '📋' },
  { id: 'catalog', label: 'Catalog', icon: '📦' },
  { id: 'upi', label: 'UPI', icon: '💳' },
  { id: 'language', label: 'Language', icon: '🌐' },
  { id: 'admin', label: 'Admin', icon: '🔐' },
  { id: 'complete', label: 'Done', icon: '🎉' },
]

function OnboardingWizard() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(1) // 1 for forwards, -1 for backwards
  const [data, setData] = useState<OnboardingData>(INITIAL_DATA)
  const [saving, setSaving] = useState(false)
  const completeMut = trpc.onboarding.completeOnboarding.useMutation()

  const updateData = useCallback((updates: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...updates }))
  }, [])

  const next = () => {
    setDirection(1)
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }
  
  const back = () => {
    setDirection(-1)
    setStep((s) => Math.max(s - 1, 0))
  }

  const saveToSupabase = async () => {
    setSaving(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // 1. Upload logo if provided
      let logoUrl = ''
      if (data.logoFile) {
        const ext = data.logoFile.name.split('.').pop()
        const path = `${user.id}/logo.${ext}`
        const { error: uploadErr } = await supabase.storage
          .from('logos')
          .upload(path, data.logoFile, { upsert: true })
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from('logos').getPublicUrl(path)
          logoUrl = urlData.publicUrl
        }
      }

      // 2. Upload UPI QR if provided
      let upiQrUrl = ''
      if (data.upiQrFile) {
        const ext = data.upiQrFile.name.split('.').pop()
        const path = `${user.id}/upi-qr.${ext}`
        const { error: uploadErr } = await supabase.storage
          .from('qr-codes')
          .upload(path, data.upiQrFile, { upsert: true })
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from('qr-codes').getPublicUrl(path)
          upiQrUrl = urlData.publicUrl
        }
      }

      // 3. One server mutation does the rest (blueprint C13): shop,
      // owner staff row, invited staff, starter products and the
      // activity log are created by complete_onboarding_tx in a
      // single transaction. The old flow ran four separate browser
      // inserts; a failure halfway left a broken shop, and the
      // invited-staff insert failed silently on every run because
      // staff_members.email was NOT NULL and the wizard collects
      // phone only.
      await completeMut.mutateAsync({
        shop_name: data.shopName,
        category: data.category || 'other',
        gstin: data.hasGST ? data.gstin : null,
        upi_id: data.upiId || null,
        upi_qr_url: upiQrUrl || null,
        logo_url: logoUrl || null,
        include_upi_qr: data.includeUpiQr,
        language: (['hinglish', 'en', 'hi', 'kn'].includes(data.language)
          ? data.language
          : 'hinglish') as 'hinglish' | 'en' | 'hi' | 'kn',
        products: data.products.map((p) => ({
          name: p.name,
          price: p.price,
          unit: p.unit,
          category: p.category || null,
        })),
        staff: data.staffMembers.map((s) => ({
          name: s.name,
          phone: s.phone,
          role: s.role,
        })),
      })

      router.push('/dashboard')
      router.refresh()
    } catch (err: any) {
      console.error('Onboarding save failed:', err)
      toast.error(err?.message || 'Kuch gadbad ho gayi. Dobara try karo.')
    } finally {
      setSaving(false)
    }
  }

  const progress = ((step + 1) / STEPS.length) * 100

  // Framer Motion variants for slide animation
  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 50 : -50,
      opacity: 0,
      scale: 0.98,
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
    },
    exit: (dir: number) => ({
      x: dir < 0 ? 50 : -50,
      opacity: 0,
      scale: 0.98,
      position: 'absolute',
    }),
  }

  return (
    <div className="min-h-screen lg:h-screen bg-[#F5F5F7] dark:bg-[#000000] flex flex-col lg:flex-row w-full overflow-hidden">
      
      {/* LEFT PANEL: Branding (Desktop Only) */}
      <div className="hidden lg:flex lg:w-[30%] bg-gradient-to-br from-[#1B7A4A] to-[#0A4A28] dark:from-[#0B3A20] dark:to-[#041F10] p-12 flex-col justify-between relative overflow-hidden shadow-2xl z-10">
        {/* Decorative elements */}
        <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-white/10 blur-[100px] animate-pulse pointer-events-none" style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-400/20 blur-[100px] animate-pulse pointer-events-none" style={{ animationDuration: '12s' }} />

        {/* Top Logo and Info */}
        <div className="relative z-10 flex flex-col gap-6">
          <div>
            <div className="font-extrabold text-[32px] tracking-tight text-white mb-6" style={{ fontFamily: 'var(--font-display, "Syne", sans-serif)' }}>
              <span className="text-white">Bill</span><span className="text-emerald-400">Dost</span>
            </div>
            <h1 className="text-4xl xl:text-[46px] font-black text-white leading-[1.05] tracking-tight mb-4">
              BillDost is all<br/>yours now.
            </h1>
            <p className="text-emerald-50 text-[16px] max-w-[360px] font-medium leading-relaxed">
              Everything you need to run your shop. Add your items, make bills quickly, and send them directly to your customers on WhatsApp.
            </p>
          </div>

          {/* Learn More Link moved here so it is always visible */}
          <div>
            <a 
              href="https://www.billdost.in" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-white text-[#1B7A4A] hover:bg-emerald-50 px-6 py-2.5 rounded-full transition-all duration-300 font-bold text-sm shadow-xl hover:shadow-2xl hover:-translate-y-0.5 group"
            >
              <span>Learn more about BillDost</span>
              <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </a>
          </div>
        </div>

        {/* Animated Process Sequence */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center py-2 w-full mt-4 transform scale-90 origin-center lg:scale-100 xl:scale-110">
          <AnimatedOnboardingProcess />
        </div>
      </div>

      {/* RIGHT PANEL: Form Area (Responsive) */}
      <div className="flex-1 flex flex-col items-center justify-start p-4 py-6 lg:py-6 lg:px-12 relative overflow-y-auto w-full">
        
        {/* Mobile/Tablet Header Logo (hidden on desktop) */}
        <div className="lg:hidden w-full flex justify-center mb-6 shrink-0">
          <div className="font-extrabold text-[28px] tracking-tight" style={{ fontFamily: 'var(--font-display, "Syne", sans-serif)' }}>
            <span className="text-[#1D1D1F] dark:text-[#F5F5F7]">Bill</span><span className="text-[#1B7A4A] dark:text-[#25D366]">Dost</span>
          </div>
        </div>

        {/* Container for Form */}
        <div className="w-full max-w-[800px] flex flex-col items-center relative z-10 my-auto">
          
          {/* Progress Section */}
          <div className="w-full mb-3 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-[12px] font-bold text-[#6E6E73] dark:text-[#98989D] uppercase tracking-wider">
                Step {step + 1} of {STEPS.length}
              </span>
              <span className="text-[12px] font-bold text-[#1B7A4A] dark:text-[#25D366]">
                {Math.round(progress)}%
              </span>
            </div>
            
            {/* Slim pill progress bar */}
            <div className="h-3 bg-black/5 dark:bg-white/10 rounded-full overflow-hidden backdrop-blur-md shadow-inner border border-black/5 dark:border-white/5">
              <div
                className="h-full bg-gradient-to-r from-[#1B7A4A] to-[#25D366] dark:from-[#25D366] dark:to-[#34E875] rounded-full transition-all duration-700 ease-out shadow-sm"
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Step indicator labels (hidden on small mobile) */}
            <div className="flex justify-between mt-2 px-1 hidden sm:flex">
              {STEPS.map((s, i) => (
                <div key={s.id}>
                  <span className={`text-[9px] font-extrabold uppercase transition-colors duration-300 ${
                    i === step ? 'text-[#1D1D1F] dark:text-[#F5F5F7]' : 'text-black/30 dark:text-white/30'
                  }`}>
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Form Card */}
          <div className="w-full bg-white/80 dark:bg-[#1C1C1E]/80 backdrop-blur-2xl border border-black/5 dark:border-white/5 rounded-[24px] p-5 lg:p-8 shadow-2xl shadow-black/5 dark:shadow-black/20 relative overflow-hidden transition-all duration-300">
            <AnimatePresence initial={false} custom={direction} mode="popLayout">
              <motion.div
                key={step}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{
                  x: { type: 'spring', stiffness: 300, damping: 30 },
                  opacity: { duration: 0.2 },
                  scale: { duration: 0.3 }
                }}
                className="w-full"
              >
                {step === 0 && <StepBusinessInfo data={data} updateData={updateData} onNext={next} />}
                {step === 1 && <StepCategory data={data} updateData={updateData} onNext={next} onBack={back} />}
                {step === 2 && <StepGST data={data} updateData={updateData} onNext={next} onBack={back} />}
                {step === 3 && <StepCatalog data={data} updateData={updateData} onNext={next} onBack={back} />}
                {step === 4 && <StepUPI data={data} updateData={updateData} onNext={next} onBack={back} />}
                {step === 5 && <StepLanguage data={data} updateData={updateData} onNext={next} onBack={back} />}
                {step === 6 && <StepAdmin data={data} updateData={updateData} onNext={next} onBack={back} />}
                {step === 7 && <StepComplete data={data} saving={saving} onSave={saveToSupabase} onBack={back} />}
              </motion.div>
            </AnimatePresence>
          </div>

        </div>
      </div>
    </div>
  )
}

/**
 * The wizard now completes through a tRPC mutation, so the page needs
 * the provider the dashboard shell normally supplies (onboarding lives
 * outside the (dashboard) route group).
 */
export default function OnboardingPage() {
  return (
    <TRPCProvider>
      <OnboardingWizard />
    </TRPCProvider>
  )
}
