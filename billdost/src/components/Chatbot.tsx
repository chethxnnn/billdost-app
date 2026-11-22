'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { Bot, Mic, MicOff, Send, X, Loader2, Sparkles, TrendingUp, CircleHelp } from 'lucide-react'
import { toast } from 'sonner'
import { SUGGESTION_CHIPS } from '@/lib/assistant/intents'
import { QUICK_CHIPS, COMMAND_GROUPS, followUpsFor, type CommandExample } from '@/lib/assistant/followups'
import {
  splitResults,
  combineTranscript,
  mapVoiceError,
  isSpeechRecognitionSupported,
  getSpeechRecognitionCtor,
  VOICE_UNSUPPORTED_MESSAGE,
  VOICE_LANG_PRIMARY,
  VOICE_LANG_FALLBACK,
  type SpeechResultLike,
  type SpeechRecognitionLike,
  type SpeechRecognitionWindowLike,
} from '@/lib/voice/dictation'

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
  // Support is only ever read inside click handlers (the mic button
  // renders only after the panel opens), so a lazy initialiser is
  // hydration-safe here.
  const [voiceSupported] = useState<boolean>(
    () =>
      typeof window !== 'undefined' &&
      isSpeechRecognitionSupported(window as unknown as SpeechRecognitionWindowLike)
  )
  const [voiceNote, setVoiceNote] = useState<{ message: string; canRetry: boolean } | null>(null)
  const [showHelp, setShowHelp] = useState(false)
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

  // ─── Voice dictation (fix round 2, Stage 3) ───
  // Continuous dictation on the Web Speech API: interim words
  // stream into the composer live, appended to whatever was typed
  // before the mic started. Errors never surface as raw browser
  // strings or red toasts: the pure mapping in lib/voice/dictation
  // turns them into a silent retry, a language fallback, a quiet
  // stop, or one calm in-panel note.
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const wantListeningRef = useRef(false)
  const restartRef = useRef(false)
  const baseTextRef = useRef('')
  const langRef = useRef<string>(VOICE_LANG_PRIMARY)
  const networkRetriedRef = useRef(false)
  const langFellBackRef = useRef(false)

  useEffect(() => {
    return () => {
      wantListeningRef.current = false
      try { recognitionRef.current?.abort() } catch { /* not running */ }
    }
  }, [])

  const startRecognition = () => {
    const Ctor = getSpeechRecognitionCtor(window as unknown as SpeechRecognitionWindowLike)
    if (!Ctor) return
    const recognition = new Ctor()
    recognitionRef.current = recognition
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = langRef.current

    recognition.onresult = (event) => {
      const results: SpeechResultLike[] = Array.from(event.results).map((r) => ({
        isFinal: Boolean(r.isFinal),
        transcript: r[0]?.transcript ?? '',
      }))
      const { finalText, interimText } = splitResults(results)
      setInputValue(combineTranscript(baseTextRef.current, finalText, interimText))
    }

    recognition.onerror = (event) => {
      const plan = mapVoiceError(String(event?.error ?? ''))
      if (plan.action === 'retry-once' && !networkRetriedRef.current) {
        networkRetriedRef.current = true
        restartRef.current = true
        return
      }
      if (plan.action === 'fallback-language' && !langFellBackRef.current) {
        langFellBackRef.current = true
        langRef.current = VOICE_LANG_FALLBACK
        restartRef.current = true
        return
      }
      // Retries exhausted, or a note/silent error: dictation stops.
      wantListeningRef.current = false
      restartRef.current = false
      if (plan.action !== 'silent' && plan.message) {
        setVoiceNote({ message: plan.message, canRetry: Boolean(plan.canRetry) })
      }
      setIsListening(false)
    }

    recognition.onend = () => {
      if (wantListeningRef.current && restartRef.current) {
        restartRef.current = false
        startRecognition()
        return
      }
      if (wantListeningRef.current) {
        // The browser ended the session by itself (long pause).
        wantListeningRef.current = false
        setIsListening(false)
      }
    }

    try { recognition.start() } catch { /* already running */ }
  }

  const beginDictation = () => {
    if (!voiceSupported) {
      setVoiceNote({ message: VOICE_UNSUPPORTED_MESSAGE, canRetry: false })
      return
    }
    setVoiceNote(null)
    baseTextRef.current = inputValue
    langRef.current = VOICE_LANG_PRIMARY
    networkRetriedRef.current = false
    langFellBackRef.current = false
    restartRef.current = false
    wantListeningRef.current = true
    setIsListening(true)
    startRecognition()
  }

  const stopListening = () => {
    wantListeningRef.current = false
    restartRef.current = false
    try { recognitionRef.current?.stop() } catch { /* not running */ }
    setIsListening(false)
  }

  const toggleMic = () => {
    if (isListening) stopListening()
    else beginDictation()
  }

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isOpen])

  const ask = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || isLoading) return
    if (isListening) stopListening()
    sendMessage({ text: trimmed })
    setInputValue('')
  }

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    ask(inputValue)
  }

  // Discoverability (Stage 4): examples from the help list either
  // send at once, or (customer questions with an example name) land
  // in the composer for the shopkeeper to put their own name in.
  const handleExample = (ex: CommandExample) => {
    setShowHelp(false)
    if (ex.action === 'fill') {
      setInputValue(ex.text)
    } else {
      ask(ex.text)
    }
  }

  // The persistent chip row shows contextual follow-ups after a
  // deterministic answer, and the everyday quick chips otherwise.
  const lastCardIntent = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const part = (messages[i].parts ?? []).find(
        (p) => p.type === 'data-assistant-card'
      ) as CardPartLike | undefined
      if (part?.data?.intent) return part.data.intent
    }
    return undefined
  })()
  const followUps = followUpsFor(lastCardIntent)
  const chipsToShow = followUps.length > 0 ? followUps : QUICK_CHIPS

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
                onClick={() => setShowHelp((v) => !v)}
                aria-label="Kya poochh sakte ho"
                aria-pressed={showHelp}
                title="Kya poochh sakte ho?"
                className={`p-2 rounded-full active:scale-95 transition shrink-0 ${
                  showHelp
                    ? 'bg-[#1B7A4A]/10 dark:bg-[#25D366]/12 text-[#1B7A4A] dark:text-[#25D366]'
                    : 'hover:bg-black/5 dark:hover:bg-white/10 text-[#6E6E73] dark:text-[#98989D]'
                }`}
              >
                <CircleHelp className="w-5 h-5" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                aria-label="Assistant band karo"
                className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition shrink-0"
              >
                <X className="w-5 h-5 text-[#6E6E73] dark:text-[#98989D]" />
              </button>
            </div>

            {/* Messages (or the "Kya poochh sakte ho?" list) */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {showHelp ? (
                <HelpView onExample={handleExample} />
              ) : (
              <>
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
              </>
              )}
            </div>

            {/* Input Area */}
            <div className="px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-white/80 dark:bg-[#1C1C1E]/80 backdrop-blur-xl border-t border-black/[0.06] dark:border-white/[0.08] shrink-0">
              {!showHelp && (
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2.5" aria-label="Jaldi sawal">
                  {chipsToShow.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => ask(chip)}
                      disabled={isLoading}
                      className="shrink-0 whitespace-nowrap px-3 py-1.5 rounded-full bg-black/[0.04] dark:bg-white/[0.07] text-[12.5px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-[#1B7A4A]/10 dark:hover:bg-[#25D366]/12 hover:text-[#1B7A4A] dark:hover:text-[#25D366] active:scale-[0.97] transition disabled:opacity-40"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              )}
              {isListening && (
                <div className="flex items-center gap-2 pb-2.5 text-[12.5px] font-medium text-[#6E6E73] dark:text-[#98989D]" role="status">
                  <span className="relative flex w-2 h-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF3B30] opacity-60" />
                    <span className="relative inline-flex rounded-full w-2 h-2 bg-[#FF3B30]" />
                  </span>
                  Sun raha hoon, boliye. Rukne ke liye mic phir dabao.
                </div>
              )}
              {voiceNote && !isListening && (
                <div className="flex items-start gap-2 mb-2.5 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] px-3 py-2.5 text-[12.5px] font-medium leading-relaxed text-[#3A3A3C] dark:text-[#D1D1D6]">
                  <MicOff className="w-4 h-4 mt-0.5 shrink-0 text-[#86868B]" aria-hidden="true" />
                  <p className="flex-1">{voiceNote.message}</p>
                  {voiceNote.canRetry && (
                    <button
                      type="button"
                      onClick={beginDictation}
                      className="shrink-0 font-bold text-[#1B7A4A] dark:text-[#25D366] hover:underline"
                    >
                      Phir try karo
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setVoiceNote(null)}
                    aria-label="Note band karo"
                    className="shrink-0 p-0.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10"
                  >
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
              )}
              <form onSubmit={handleFormSubmit} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleMic}
                  aria-label={isListening ? 'Voice band karo' : 'Voice se poochho'}
                  aria-pressed={isListening}
                  className={`relative p-3 rounded-xl transition-colors shrink-0 ${
                    isListening
                      ? 'bg-red-50 dark:bg-red-500/10 text-red-500'
                      : 'bg-black/[0.04] dark:bg-white/[0.07] text-[#6E6E73] dark:text-[#98989D] hover:bg-black/[0.07] dark:hover:bg-white/[0.1]'
                  }`}
                >
                  {isListening && (
                    <span className="animate-ping absolute inset-0 rounded-xl bg-red-500/15" aria-hidden="true" />
                  )}
                  {isListening ? <Mic className="relative w-5 h-5" /> : <MicOff className="w-5 h-5" />}
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

/**
 * "Kya poochh sakte ho?" (Stage 4): the grouped catalogue of
 * questions the assistant actually understands, rendered inside the
 * panel in place of the conversation. Tapping a question sends it
 * (or fills the composer, for customer questions with an example
 * name). The catalogue lives in lib/assistant/followups and is
 * test-locked to the intent engine.
 */
function HelpView({ onExample }: { onExample: (ex: CommandExample) => void }) {
  return (
    <div className="pt-1">
      <h4 className="text-[15px] font-bold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
        Kya poochh sakte ho?
      </h4>
      <p className="text-[13px] leading-relaxed text-[#6E6E73] dark:text-[#98989D] font-medium mt-1">
        Ye sawal seedha aapke shop ke data se jawab hote hain. Kisi par bhi tap karo.
      </p>
      {COMMAND_GROUPS.map((group) => (
        <div key={group.title} className="mt-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#86868B]">
            {group.title}
          </p>
          {group.hint && (
            <p className="text-[12px] leading-relaxed text-[#86868B] font-medium mt-1">
              {group.hint}
            </p>
          )}
          <div className="flex flex-wrap gap-2 mt-2">
            {group.examples.map((ex) => (
              <button
                key={ex.text}
                type="button"
                onClick={() => onExample(ex)}
                className="px-3.5 py-2 rounded-full bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.09] text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] hover:border-[#1B7A4A]/40 dark:hover:border-[#25D366]/40 hover:text-[#1B7A4A] dark:hover:text-[#25D366] active:scale-[0.97] transition"
              >
                {ex.text}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
