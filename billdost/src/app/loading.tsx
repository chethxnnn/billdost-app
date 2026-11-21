import React from 'react'

export default function Loading() {
  return (
    <div className="fixed inset-0 z-[9999] bg-[#F5F5F7]/80 dark:bg-[#000000]/80 backdrop-blur-xl flex flex-col items-center justify-center transition-all duration-500">
      <div className="relative flex flex-col items-center">
        {/* Pulse rings behind the logo */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 bg-[#1B7A4A]/10 dark:bg-[#25D366]/10 rounded-full animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-[#1B7A4A]/20 dark:bg-[#25D366]/20 rounded-full animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite_0.5s]"></div>
        
        {/* Animated Logo Text */}
        <div 
          className="relative z-10 font-extrabold text-4xl tracking-tight flex items-center justify-center animate-[bounce_2s_infinite]"
          style={{ fontFamily: 'var(--font-display, "Syne", sans-serif)' }}
        >
          <span className="text-[#1D1D1F] dark:text-[#F5F5F7]">Bill</span>
          <span className="text-[#1B7A4A] dark:text-[#25D366] relative overflow-hidden group">
            Dost
            {/* Shimmer effect over the green part */}
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent skew-x-[-20deg]" />
          </span>
        </div>
        
        {/* Subtle loading text */}
        <div className="mt-4 flex items-center gap-1.5 opacity-80">
          <div className="w-1.5 h-1.5 bg-[#1B7A4A] dark:bg-[#25D366] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-1.5 h-1.5 bg-[#1B7A4A] dark:bg-[#25D366] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-1.5 h-1.5 bg-[#1B7A4A] dark:bg-[#25D366] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
      `}} />
    </div>
  )
}
