'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useShop } from '@/components/shared/ShopContext'
import { CheckCircle2, QrCode, RefreshCw, Smartphone, LogOut } from 'lucide-react'
import { toast } from 'sonner'
import Image from 'next/image'

const WHATSAPP_SERVICE_URL = process.env.NEXT_PUBLIC_WHATSAPP_SERVICE_URL || 'http://localhost:3001'

export default function WhatsAppSettingsPage() {
  const { shopId } = useShop()
  const [status, setStatus] = useState<'NOT_INITIALIZED' | 'INITIALIZING' | 'QR_READY' | 'AUTHENTICATED' | 'READY' | 'DISCONNECTED'>('NOT_INITIALIZED')
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const checkStatus = async () => {
    if (!shopId) return
    try {
      setLoading(true)
      const res = await fetch(`${WHATSAPP_SERVICE_URL}/api/whatsapp/${shopId}/status`)
      const data = await res.json()
      setStatus(data.status)
      setQrCodeUrl(data.qrCode)
    } catch (error) {
      console.error("Failed to fetch WhatsApp status", error)
      toast.error("Could not connect to WhatsApp Microservice.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    checkStatus()
    
    // Poll for status updates if we are initializing or waiting for scan
    const interval = setInterval(() => {
      if (['INITIALIZING', 'QR_READY', 'AUTHENTICATED'].includes(status)) {
        checkStatus()
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [shopId, status])

  const initializeWhatsApp = async () => {
    if (!shopId) return
    try {
      setStatus('INITIALIZING')
      await fetch(`${WHATSAPP_SERVICE_URL}/api/whatsapp/${shopId}/init`, { method: 'POST' })
      toast.success("Initializing WhatsApp session. Please wait for QR code...")
      checkStatus()
    } catch (error) {
      toast.error("Failed to initialize session.")
      setStatus('NOT_INITIALIZED')
    }
  }

  const logoutWhatsApp = async () => {
    if (!shopId) return
    try {
      await fetch(`${WHATSAPP_SERVICE_URL}/api/whatsapp/${shopId}/logout`, { method: 'POST' })
      toast.success("Logged out successfully.")
      checkStatus()
    } catch (error) {
      toast.error("Failed to logout.")
    }
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
          <Smartphone className="w-6 h-6 text-green-600" />
          WhatsApp Integration
        </h1>
        <p className="text-gray-500 mt-1">Connect your shop's WhatsApp to send automated invoices directly from BillDost.</p>
      </div>

      <Card className="p-8 border-gray-100 bg-white shadow-sm overflow-hidden relative">
        <div className="absolute top-0 right-0 p-4">
          <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest ${
            status === 'READY' ? 'bg-green-100 text-green-700' :
            status === 'DISCONNECTED' || status === 'NOT_INITIALIZED' ? 'bg-gray-100 text-gray-600' :
            'bg-yellow-100 text-yellow-700 animate-pulse'
          }`}>
            {status.replace('_', ' ')}
          </div>
        </div>

        {loading && status === 'NOT_INITIALIZED' ? (
          <div className="py-20 flex justify-center items-center">
            <RefreshCw className="w-8 h-8 text-gray-300 animate-spin" />
          </div>
        ) : status === 'READY' ? (
          <div className="py-12 flex flex-col items-center text-center">
            <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-6">
              <CheckCircle2 className="w-10 h-10 text-green-500" />
            </div>
            <h2 className="text-2xl font-black text-gray-900 mb-2">WhatsApp Connected!</h2>
            <p className="text-gray-500 max-w-sm mb-8">Your account is successfully linked. Invoices will now be sent automatically in the background when you click "Send WhatsApp".</p>
            <Button onClick={logoutWhatsApp} variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700">
              <LogOut className="w-4 h-4 mr-2" /> Disconnect WhatsApp
            </Button>
          </div>
        ) : status === 'INITIALIZING' ? (
          <div className="py-20 flex flex-col items-center text-center">
            <RefreshCw className="w-10 h-10 text-green-500 animate-spin mb-6" />
            <h2 className="text-xl font-bold text-gray-900">Starting Secure Session...</h2>
            <p className="text-gray-500 mt-2">Please wait while we generate your unique QR Code.</p>
          </div>
        ) : status === 'QR_READY' && qrCodeUrl ? (
          <div className="py-8 flex flex-col md:flex-row items-center gap-12">
            <div className="flex-1 space-y-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Link your WhatsApp</h2>
                <ol className="list-decimal list-inside space-y-3 text-gray-600 text-sm">
                  <li>Open <strong>WhatsApp</strong> on your phone</li>
                  <li>Tap <strong>Menu</strong> or <strong>Settings</strong> and select <strong>Linked Devices</strong></li>
                  <li>Tap on <strong>Link a Device</strong></li>
                  <li>Point your phone to this screen to capture the code</li>
                </ol>
              </div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xl">
              <Image src={qrCodeUrl} alt="WhatsApp QR Code" width={256} height={256} className="rounded-lg" />
            </div>
          </div>
        ) : (
          <div className="py-12 flex flex-col items-center text-center">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-6">
              <QrCode className="w-10 h-10 text-gray-400" />
            </div>
            <h2 className="text-2xl font-black text-gray-900 mb-2">Automate Your Billing</h2>
            <p className="text-gray-500 max-w-sm mb-8">Link your WhatsApp Business or Personal account to instantly send PDF bills to your customers in one click.</p>
            <Button onClick={initializeWhatsApp} className="bg-green-600 hover:bg-green-700 text-white font-bold px-8 py-6 rounded-xl">
              Link WhatsApp Device
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}
