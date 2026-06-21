'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const PROCESS_STEPS = [
  {
    id: 1,
    icon: (
      <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
      </svg>
    ),
    title: "Customer picks items",
    description: "Fast checkout experience"
  },
  {
    id: 2,
    icon: (
      <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    title: "Create bill in seconds",
    description: "Smart inventory tracking"
  },
  {
    id: 3,
    icon: (
      <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.82 9.82 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
      </svg>
    ),
    title: "Send WhatsApp Invoice",
    description: "Instant paperless delivery"
  },
  {
    id: 4,
    icon: (
      <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
      </svg>
    ),
    title: "Collect Digital Payment",
    description: "Built-in UPI QR code"
  }
]

export default function AnimatedOnboardingProcess() {
  const [currentStep, setCurrentStep] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % PROCESS_STEPS.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="relative w-full max-w-[340px] aspect-square flex items-center justify-center">
      {/* Background glowing rings */}
      <div className="absolute inset-4 bg-emerald-500/20 rounded-full blur-xl animate-ping" style={{ animationDuration: '4s' }} />
      <div className="absolute inset-8 bg-emerald-400/30 rounded-full blur-lg animate-pulse" style={{ animationDuration: '3s' }} />
      
      {/* Central Card */}
      <div className="relative z-10 w-[280px] h-[280px] bg-white/10 backdrop-blur-xl border border-white/20 rounded-[40px] shadow-2xl flex flex-col items-center justify-center p-8 text-center overflow-hidden">
        
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ y: 20, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -20, opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="flex flex-col items-center"
          >
            {/* Step Icon */}
            <div className="w-24 h-24 bg-gradient-to-tr from-emerald-500 to-emerald-300 rounded-[28px] shadow-lg flex items-center justify-center mb-6 transform rotate-3">
              {PROCESS_STEPS[currentStep].icon}
            </div>

            {/* Step Text */}
            <h3 className="text-white font-bold text-[22px] leading-tight mb-2 tracking-tight">
              {PROCESS_STEPS[currentStep].title}
            </h3>
            <p className="text-emerald-100/80 text-[15px] font-medium">
              {PROCESS_STEPS[currentStep].description}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* Progress indicators */}
        <div className="absolute bottom-6 flex gap-2">
          {PROCESS_STEPS.map((step, idx) => (
            <div 
              key={step.id}
              className={`h-1.5 rounded-full transition-all duration-500 ${
                idx === currentStep ? 'w-6 bg-emerald-400' : 'w-2 bg-white/20'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
