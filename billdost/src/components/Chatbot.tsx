'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { Bot, Mic, MicOff, Send, X, Loader2, Sparkles, TrendingUp } from 'lucide-react'
import { toast } from 'sonner'
import { SUGGESTION_CHIPS } from '@/lib/assistant/intents'

/** Structural view of a tool UI part in AI SDK v6 message parts. */
interface ToolPartLike {
  type: string
  toolCallId?: string
  toolName?: string
  state?: string
  output?: unknown
}

interface CardPartLike {
  type: string
  data?: {
    intent?: string
    headline?: string
    lines?: string[]
    note?: string
    destination?: string
    label?: string
  }
}

function toolNameOf(part: ToolPartLike): string | null {
  if (part.type === 'dynamic-tool') return part.toolName ?? null
  if (part.type.startsWith('tool-')) return part.type.slice('tool-'.length)
  return null
}

/**
 * The BillDost Assistant panel (Stage 7, KPMG AI Billing pattern).
 * A calm right-side panel on desktop, a full sheet on mobile. Known
 * daily questions are answered by the deterministic intent engine
 * as structured cards from the shop's own data; everything else
 * streams from the general AI flow behind the same panel.
 */
export function Chatbot({ shopName }: { shopName?: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const router = useRouter()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const handledToolCallsRef = useRef<Set<string>>(new Set())
  const handledNavRef = useRef<Set<string>>(new Set())

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
    onError: (err) => {
      toast.error('AI Error: ' + err.message)
    }
  })

  // Navigation, two sources, one behaviour: the Gemini navigateApp
  // tool output, and the intent engine's data-navigate part. Each
  // fires exactly once.
  useEffect(() => {
    for (const m of messages) {
      for (const rawPart of m.parts ?? []) {
        const part = rawPart as ToolPartLike & CardPartLike
        if (part.type === 'data-navigate' && part.data?.destination) {
          const key = `${m.id}:${part.data.destination}`
          if (handledNavRef.current.has(key)) continue
          handledNavRef.current.add(key)
          router.push(part.data.destination)
          toast.success(`${part.data.label ?? 'Page'} khul raha hai...`)
          continue
        }
        if (toolNameOf(part) !== 'navigateApp') continue
        if (part.state !== 'output-available' || !part.toolCallId) continue
        if (handledToolCallsRef.current.has(part.toolCallId)) continue
        const output = part.output as { destination?: string } | undefined
        if (!output?.destination) continue
        handledToolCallsRef.current.add(part.toolCallId)
        router.push(output.destination)
        toast.success(`Navigating to ${output.destination}...`)
      }
    }
  }, [messages, router])

  const isLoading = status === 'submitted' || status === 'streaming'

  // Speech Recognition setup
  useEffect(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      return
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0])
        .map((result: any) => result.transcript)
        .join('')
      setInputValue(transcript)
    }

    recognition.onerror = (event: any) => {
      if (event.error === 'network') {
        toast.error('Voice recognition failed (network error). This usually happens if you are not using Chrome/Edge or your connection to the speech server failed.')
      } else if (event.error === 'not-allowed') {
        toast.error('Microphone access denied. Please allow microphone permissions.')
      } else if (event.error !== 'aborted') {
        toast.error('Speech recognition error: ' + event.error)
      }
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    if (isListening) {
      try { recognition.start() } catch { /* already running */ }
    } else {
      try { recognition.stop() } catch { /* not running */ }
    }

    return () => {
      try { recognition.stop() } catch { /* not running */ }
    }
  }, [isListening])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isOpen])

  const ask = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || isLoading) return
    sendMessage({ text: trimmed })
    setInputValue('')
  }

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    ask(inputValue)
  }

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? 'Assistant band karo' : 'Assistant se poochho'}
        aria-expanded={isOpen}
        className="fixed bottom-24 lg:bottom-6 right-4 lg:right-6 p-4 rounded-full bg-[#1B7A4A] dark:bg-[#25D366] text-white dark:text-[#1D1D1F] shadow-2xl shadow-[#1B7A4A]/25 hover:scale-105 active:scale-95 transition-transform z-50 flex items-center justify-center"
      >
        {isOpen ? <X className="w-6 h-6" /> : <Bot className="w-6 h-6" />}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: 48 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 48 }}
            transition={{ type: 'spring', stiffness: 380, damping: 36, mass: 0.9 }}
            className="fixed inset-0 sm:inset-auto sm:top-0 sm:right-0 sm:h-full sm:w-[400px] sm:max-w-[94vw] bg-[#F5F5F7] dark:bg-[#111111] sm:border-l border-black/[0.06] dark:border-white/[0.08] shadow-2xl flex flex-col z-50 overflow-hidden"
            role="dialog"
            aria-label="BillDost Assistant"
          >
            {/* Header */}
            <div className="px-5 py-4 pt-[max(1rem,env(safe-area-inset-top))] sm:pt-4 border-b border-black/[0.06] dark:border-white/[0.08] bg-white/80 dark:bg-[#1C1C1E]/80 backdrop-blur-xl flex items-center gap-3 shrink-0">
              <div className="w-10 h-10 rounded-2xl bg-[#1B7A4A]/10 dark:bg-[#25D366]/12 flex items-center justify-center shrink-0">
                <Bot className="w-5 h-5 text-[#1B7A4A] dark:text-[#25D366]" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-[15px] tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7] truncate">
                  BillDost Assistant
                </h3>
                <p className="text-[12px] font-medium text-[#6E6E73] dark:text-[#98989D] truncate">
                  {shopName ? `${shopName} · ` : ''}Aapke shop data se jawab
                </p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                aria-label="Assistant band karo"
                className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition shrink-0"
              >
                <X className="w-5 h-5 text-[#6E6E73] dark:text-[#98989D]" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {messages.length === 0 && (
                <div className="pt-2">
                  <div className="bg-white dark:bg-[#1C1C1E] border border-black/[0.05] dark:border-white/[0.07] rounded-[20px] p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-4 h-4 text-[#1B7A4A] dark:text-[#25D366]" />
                      <p className="text-[15px] font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">Namaste!</p>
                    </div>
                    <p className="text-[13.5px] leading-relaxed text-[#6E6E73] dark:text-[#98989D] font-medium">
                      Sales, stock, udhaar ya GST, jo poochna hai poochho. Jawab seedha aapke shop ke data se aayega.
                    </p>
                  </div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#86868B] mt-5 mb-2 px-1">
                    Ye poochh kar dekho
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTION_CHIPS.map((chip) => (
                      <button
                        key={chip}
                        onClick={() => ask(chip)}
                        className="px-3.5 py-2 rounded-full bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.09] text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] hover:border-[#1B7A4A]/40 dark:hover:border-[#25D366]/40 hover:text-[#1B7A4A] dark:hover:text-[#25D366] active:scale-[0.97] transition"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m) => {
                if (m.role === 'user') {
                  return (
                    <div key={m.id} className="flex justify-end">
                      <div className="max-w-[85%] rounded-[20px] rounded-br-md px-4 py-2.5 text-[14px] leading-relaxed bg-[#1B7A4A] dark:bg-[#25D366] text-white dark:text-[#1D1D1F] font-medium">
                        {m.parts?.map((part, i) => part.type === 'text' ? <span key={i}>{part.text}</span> : null)}
                      </div>
                    </div>
                  )
                }

                const cardPart = (m.parts ?? []).find(
                  (p) => p.type === 'data-assistant-card'
                ) as CardPartLike | undefined
                const card = cardPart?.data

                if (card?.headline) {
                  return (
                    <div key={m.id} className="flex justify-start">
                      <div className="w-full max-w-[92%] bg-white dark:bg-[#1C1C1E] border border-black/[0.05] dark:border-white/[0.07] rounded-[20px] rounded-bl-md p-4 shadow-sm">
                        <div className="flex items-start gap-2.5">
                          <span className="w-7 h-7 rounded-full bg-[#1B7A4A]/10 dark:bg-[#25D366]/12 flex items-center justify-center shrink-0 mt-0.5">
                            <TrendingUp className="w-3.5 h-3.5 text-[#1B7A4A] dark:text-[#25D366]" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-[19px] font-extrabold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums leading-tight">
                              {card.headline}
                            </p>
                            {card.lines?.map((line, i) => (
                              <p key={i} className="text-[13.5px] leading-relaxed text-[#3A3A3C] dark:text-[#D1D1D6] font-medium mt-1 tabular-nums">
                                {line}
                              </p>
                            ))}
                            {card.note ? (
                              <p className="text-[11px] font-medium text-[#86868B] mt-2.5">
                                {card.note}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                }

                return (
                  <div key={m.id} className="flex justify-start">
                    <div className="max-w-[88%] bg-white dark:bg-[#1C1C1E] border border-black/[0.05] dark:border-white/[0.07] rounded-[20px] rounded-bl-md px-4 py-3 text-[14px] leading-relaxed text-[#1D1D1F] dark:text-[#F5F5F7] shadow-sm">
                      {m.parts?.map((part, i) => part.type === 'text' ? <span key={i}>{part.text}</span> : null)}
                      {m.parts?.map((rawPart, i) => {
                        const part = rawPart as ToolPartLike
                        const toolName = toolNameOf(part)
                        if (!toolName) return null
                        return (
                          <div key={i} className="mt-2 text-xs opacity-70 flex items-center gap-1.5 bg-black/[0.04] dark:bg-white/[0.06] px-2 py-1.5 rounded-lg font-medium">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            {toolName === 'getInvoices' && 'Searching bills...'}
                            {toolName === 'getCustomers' && 'Looking up customers...'}
                            {toolName === 'getShopStats' && 'Analyzing shop data...'}
                            {toolName === 'getProducts' && 'Checking inventory...'}
                            {toolName === 'navigateApp' && 'Navigating...'}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}

              {isLoading && messages[messages.length - 1]?.role === 'user' && (
                <div className="flex justify-start">
                  <div className="bg-white dark:bg-[#1C1C1E] border border-black/[0.05] dark:border-white/[0.07] rounded-[20px] rounded-bl-md px-4 py-3">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 rounded-full bg-[#86868B] animate-bounce" />
                      <span className="w-2 h-2 rounded-full bg-[#86868B] animate-bounce" style={{ animationDelay: '0.2s' }} />
                      <span className="w-2 h-2 rounded-full bg-[#86868B] animate-bounce" style={{ animationDelay: '0.4s' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-white/80 dark:bg-[#1C1C1E]/80 backdrop-blur-xl border-t border-black/[0.06] dark:border-white/[0.08] shrink-0">
              <form onSubmit={handleFormSubmit} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsListening(!isListening)}
                  aria-label={isListening ? 'Voice band karo' : 'Voice se poochho'}
                  className={`p-3 rounded-xl transition-colors shrink-0 ${
                    isListening
                      ? 'bg-red-50 dark:bg-red-500/10 text-red-500'
                      : 'bg-black/[0.04] dark:bg-white/[0.07] text-[#6E6E73] dark:text-[#98989D] hover:bg-black/[0.07] dark:hover:bg-white/[0.1]'
                  }`}
                >
                  {isListening ? <Mic className="w-5 h-5 animate-pulse" /> : <MicOff className="w-5 h-5" />}
                </button>

                <input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Apne shop ke baare mein poochho..."
                  aria-label="Assistant ko sawal likho"
                  className="flex-1 min-w-0 bg-black/[0.04] dark:bg-white/[0.07] text-[#1D1D1F] dark:text-[#F5F5F7] rounded-xl px-4 py-3 text-[14px] font-medium focus:outline-none focus:ring-2 focus:ring-[#1B7A4A]/25 dark:focus:ring-[#25D366]/25 transition"
                />

                <button
                  type="submit"
                  disabled={!inputValue.trim() || isLoading}
                  aria-label="Sawal bhejo"
                  className="p-3 bg-[#1B7A4A] dark:bg-[#25D366] text-white dark:text-[#1D1D1F] rounded-xl hover:opacity-90 active:scale-95 transition disabled:opacity-40 shrink-0"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
