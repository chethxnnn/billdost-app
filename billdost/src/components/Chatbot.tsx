'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useRouter } from 'next/navigation'
import { Bot, Mic, MicOff, Send, X, Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

/** Structural view of a tool UI part in AI SDK v6 message parts. */
interface ToolPartLike {
  type: string
  toolCallId?: string
  toolName?: string
  state?: string
  output?: unknown
}

function toolNameOf(part: ToolPartLike): string | null {
  if (part.type === 'dynamic-tool') return part.toolName ?? null
  if (part.type.startsWith('tool-')) return part.type.slice('tool-'.length)
  return null
}

export function Chatbot() {
  const [isOpen, setIsOpen] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const router = useRouter()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const handledToolCallsRef = useRef<Set<string>>(new Set())

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
    onError: (err) => {
      toast.error('AI Error: ' + err.message)
    }
  })

  // Navigation: navigateApp executes on the server and returns
  // { command: 'NAVIGATE', destination } as its tool output. Watch for
  // completed navigateApp parts and perform the navigation once each.
  useEffect(() => {
    for (const m of messages) {
      for (const rawPart of m.parts ?? []) {
        const part = rawPart as ToolPartLike
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
      console.warn('Speech recognition not supported in this browser.')
      return
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-US' // Can be configurable later

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0])
        .map((result: any) => result.transcript)
        .join('')
      
      setInputValue(transcript)
    }

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event.error)
      if (event.error === 'network') {
        toast.error('Voice recognition failed (network error). This usually happens if you are not using Chrome/Edge or your connection to the speech server failed.')
      } else if (event.error === 'not-allowed') {
        toast.error('Microphone access denied. Please allow microphone permissions.')
      } else {
        toast.error('Speech recognition error: ' + event.error)
      }
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    if (isListening) {
      recognition.start()
    } else {
      try {
        recognition.stop()
      } catch (e) {}
    }

    return () => {
      try {
        recognition.stop()
      } catch (e) {}
    }
  }, [isListening, setInputValue])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim() || isLoading) return
    if (sendMessage) {
      sendMessage({ text: inputValue })
    } else {
      console.error('sendMessage is undefined')
    }
    setInputValue('')
  }

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? 'Assistant band karo' : 'Assistant se poochho'}
        aria-expanded={isOpen}
        className="fixed bottom-6 right-6 p-4 rounded-full bg-[#1B7A4A] dark:bg-[#25D366] text-white shadow-2xl hover:scale-105 active:scale-95 transition-all z-50 flex items-center justify-center gap-2 group"
      >
        {isOpen ? (
          <X className="w-6 h-6" />
        ) : (
          <>
            <Bot className="w-6 h-6" />
            <Sparkles className="w-4 h-4 absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity" />
          </>
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-[380px] h-[550px] max-h-[80vh] max-w-[calc(100vw-48px)] bg-white/90 dark:bg-[#1C1C1E]/90 backdrop-blur-2xl border border-black/10 dark:border-white/10 shadow-2xl rounded-3xl flex flex-col z-50 overflow-hidden transform origin-bottom-right transition-all">
          
          {/* Header */}
          <div className="p-5 border-b border-black/5 dark:border-white/5 flex items-center justify-between bg-white dark:bg-[#1C1C1E]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#1B7A4A]/10 dark:bg-[#25D366]/10 flex items-center justify-center">
                <Bot className="w-5 h-5 text-[#1B7A4A] dark:text-[#25D366]" />
              </div>
              <div>
                <h3 className="font-bold text-[15px] font-display flex items-center">
                  <span className="text-[#1D1D1F] dark:text-[#F5F5F7]">Bill</span>
                  <span className="text-[#1B7A4A] dark:text-[#25D366]">Dost</span>
                  <span className="ml-1 text-gray-500 font-normal text-sm">AI</span>
                </h3>
                <p className="text-[12px] text-gray-500 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Online
                </p>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-3 opacity-50">
                <Sparkles className="w-8 h-8 text-gray-400" />
                <p className="text-sm font-medium text-gray-500">Ask me about your sales,<br/>customers, or navigate the app!</p>
              </div>
            )}
            
            {messages.map(m => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-[14px] leading-relaxed shadow-sm ${
                  m.role === 'user' 
                    ? 'bg-[#1B7A4A] dark:bg-[#25D366] text-white rounded-br-none' 
                    : 'bg-white dark:bg-[#38383A] text-gray-800 dark:text-gray-200 border border-black/5 dark:border-white/5 rounded-bl-none'
                }`}>
                  {m.parts?.map((part, i) => part.type === 'text' ? <span key={i}>{part.text}</span> : null)}

                  {/* Tool call indicator */}
                  {m.parts?.map((rawPart, i) => {
                    const part = rawPart as ToolPartLike
                    const toolName = toolNameOf(part)
                    if (!toolName) return null
                    return (
                      <div key={i} className="mt-2 text-xs opacity-70 flex items-center gap-1 bg-black/5 dark:bg-white/5 p-1.5 rounded-lg">
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
            ))}
            {isLoading && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex justify-start">
                <div className="bg-white dark:bg-[#38383A] border border-black/5 dark:border-white/5 rounded-2xl rounded-bl-none px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" />
                    <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0.2s' }} />
                    <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0.4s' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-white dark:bg-[#1C1C1E] border-t border-black/5 dark:border-white/5">
            <form onSubmit={handleFormSubmit} className="flex items-center gap-2 relative">
              <button
                type="button"
                onClick={() => setIsListening(!isListening)}
                className={`p-3 rounded-xl transition-all ${
                  isListening 
                    ? 'bg-red-50 dark:bg-red-500/10 text-red-500' 
                    : 'bg-gray-100 dark:bg-[#38383A] text-gray-500 hover:bg-gray-200 dark:hover:bg-[#48484A]'
                }`}
              >
                {isListening ? <Mic className="w-5 h-5 animate-pulse" /> : <MicOff className="w-5 h-5" />}
              </button>
              
              <input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask BillDost..."
                className="flex-1 bg-gray-100 dark:bg-[#38383A] text-gray-900 dark:text-white rounded-xl px-4 py-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#1B7A4A]/20 transition-all"
              />
              
              <button
                type="submit"
                disabled={!inputValue.trim() || isLoading}
                className="p-3 bg-[#1B7A4A] dark:bg-[#25D366] text-white rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
