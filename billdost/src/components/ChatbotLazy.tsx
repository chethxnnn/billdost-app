'use client'

import dynamic from 'next/dynamic'

// The AI chatbot (AI SDK, voice input, chat transport) is heavy and is
// only ever used after a deliberate tap on its button, so it loads as
// a separate client chunk instead of riding in every dashboard route.
const Chatbot = dynamic(
  () => import('@/components/Chatbot').then((mod) => mod.Chatbot),
  { ssr: false },
)

export function ChatbotLazy() {
  return <Chatbot />
}
