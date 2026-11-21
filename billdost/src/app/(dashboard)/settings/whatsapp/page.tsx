'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { trpc } from '@/lib/trpc/client'
import { CheckCircle2, RefreshCw, Smartphone, LogOut, Send } from 'lucide-react'
import { toast } from 'sonner'

/**
 * WhatsApp Cloud API connection screen (blueprint C1). This replaces
 * the old QR polling screen for the whatsapp-web.js microservice.
 * States are honest: until Meta credentials exist (the Meta account
 * and template setup happens with the BillDost team after delivery),
 * the screen says Not Connected and sends fail with a clear message
 * instead of pretending to work.
 */
export default function WhatsAppSettingsPage() {
  const utils = trpc.useUtils()
  const { data: status, isLoading } = trpc.whatsapp.status.useQuery()
  const { data: sends } = trpc.whatsapp.listSends.useQuery({ limit: 10 })

  const [phoneNumberId, setPhoneNumberId] = useState('')
  const [wabaId, setWabaId] = useState('')
  const [displayPhone, setDisplayPhone] = useState('')
  const [testPhone, setTestPhone] = useState('')

  const saveMutation = trpc.whatsapp.saveConnection.useMutation({
    onSuccess: () => {
      toast.success('WhatsApp number save ho gaya!')
      utils.whatsapp.status.invalidate()
    },
    onError: (err) => toast.error(err.message),
  })

  const disconnectMutation = trpc.whatsapp.disconnect.useMutation({
    onSuccess: () => {
      toast.success('WhatsApp disconnect ho gaya.')
      utils.whatsapp.status.invalidate()
    },
    onError: (err) => toast.error(err.message),
  })

  const testMutation = trpc.whatsapp.sendTestMessage.useMutation({
    onSuccess: () => {
      toast.success('Test message bhej diya! Apna WhatsApp check karo.')
      utils.whatsapp.listSends.invalidate()
    },
    onError: (err) => {
      toast.error(err.message)
      utils.whatsapp.listSends.invalidate()
    },
  })

  const connected = status?.state === 'connected'

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
          <Smartphone className="w-6 h-6 text-green-600" />
          WhatsApp Integration
        </h1>
        <p className="text-gray-500 mt-1">
          Official WhatsApp Cloud API se bills seedha customer ke WhatsApp par bhejo. Koi QR scan nahi, koi ban risk nahi.
        </p>
      </div>

      <Card className="p-8 border-gray-100 bg-white shadow-sm overflow-hidden relative mb-6">
        <div className="absolute top-0 right-0 p-4">
          <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest ${
            connected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
          }`}>
            {isLoading ? 'Checking' : connected ? 'Connected' : 'Not Connected'}
          </div>
        </div>

        {isLoading ? (
          <div className="py-20 flex justify-center items-center">
            <RefreshCw className="w-8 h-8 text-gray-300 animate-spin" />
          </div>
        ) : connected ? (
          <div className="py-10 flex flex-col items-center text-center">
            <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-6">
              <CheckCircle2 className="w-10 h-10 text-green-500" />
            </div>
            <h2 className="text-2xl font-black text-gray-900 mb-2">WhatsApp Connected!</h2>
            <p className="text-gray-500 max-w-md mb-2">
              {status.source === 'shop'
                ? `Aapki shop ka number ${status.displayPhone || ''} connected hai. Bills ab isi number se bheje jayenge.`
                : 'BillDost ke shared number se bills bheje jayenge. Apna number jodne ke liye neeche details bharo.'}
            </p>
            {status.lastError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2 mb-4 max-w-md">
                Last error: {status.lastError}
              </p>
            )}
            <div className="w-full max-w-md mt-4">
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 text-left">
                Test message bhejo (apna number)
              </label>
              <div className="flex gap-2">
                <input
                  type="tel"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="98765 43210"
                  className="flex-1 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#1B7A4A]/20"
                />
                <Button
                  onClick={() => testPhone.trim() && testMutation.mutate({ phone: testPhone.trim() })}
                  disabled={testMutation.isPending || !testPhone.trim()}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl"
                >
                  <Send className="w-4 h-4 mr-2" /> Test
                </Button>
              </div>
            </div>
            {status.source === 'shop' && (
              <Button
                onClick={() => disconnectMutation.mutate()}
                disabled={disconnectMutation.isPending}
                variant="outline"
                className="mt-8 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
              >
                <LogOut className="w-4 h-4 mr-2" /> Disconnect WhatsApp
              </Button>
            )}
          </div>
        ) : (
          <div className="py-10">
            <div className="flex flex-col items-center text-center mb-8">
              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-6">
                <Smartphone className="w-10 h-10 text-gray-400" />
              </div>
              <h2 className="text-2xl font-black text-gray-900 mb-2">WhatsApp abhi connected nahi hai</h2>
              <p className="text-gray-500 max-w-md">
                Meta WhatsApp setup BillDost team ke saath complete hoga. Setup ke baad mile Phone Number ID
                aur WhatsApp Business Account ID yahan bharo, phir bills seedha WhatsApp par bheje jayenge.
                Tab tak bill bhejne par share aur WhatsApp Web options milenge.
              </p>
            </div>

            <div className="max-w-md mx-auto space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                  Phone Number ID (Meta)
                </label>
                <input
                  type="text"
                  value={phoneNumberId}
                  onChange={(e) => setPhoneNumberId(e.target.value)}
                  placeholder="e.g. 123456789012345"
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#1B7A4A]/20"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                  WhatsApp Business Account ID
                </label>
                <input
                  type="text"
                  value={wabaId}
                  onChange={(e) => setWabaId(e.target.value)}
                  placeholder="e.g. 123456789012345"
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#1B7A4A]/20"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                  Display Number (optional)
                </label>
                <input
                  type="tel"
                  value={displayPhone}
                  onChange={(e) => setDisplayPhone(e.target.value)}
                  placeholder="e.g. 98765 43210"
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#1B7A4A]/20"
                />
              </div>
              <Button
                onClick={() => saveMutation.mutate({
                  phone_number_id: phoneNumberId.trim(),
                  waba_id: wabaId.trim(),
                  display_phone: displayPhone.trim() || null,
                })}
                disabled={saveMutation.isPending || !phoneNumberId.trim() || !wabaId.trim()}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-6 rounded-xl"
              >
                Save WhatsApp Connection
              </Button>
            </div>
          </div>
        )}
      </Card>

      {sends && sends.length > 0 && (
        <Card className="p-6 border-gray-100 bg-white shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Recent WhatsApp Sends</h3>
          <div className="divide-y divide-gray-100">
            {sends.map((send) => (
              <div key={send.id} className="py-3 flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-gray-900">{send.to_phone}</div>
                  <div className="text-xs text-gray-400">
                    {new Date(send.created_at).toLocaleString('en-IN')}
                    {send.error ? ` · ${send.error}` : ''}
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                  send.status === 'read' || send.status === 'delivered'
                    ? 'bg-green-100 text-green-700'
                    : send.status === 'sent'
                      ? 'bg-blue-100 text-blue-700'
                      : send.status === 'failed'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-gray-100 text-gray-600'
                }`}>
                  {send.status}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
