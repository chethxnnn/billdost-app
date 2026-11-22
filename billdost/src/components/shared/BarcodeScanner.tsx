'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, Keyboard, X } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'

interface Props {
  onDetected: (code: string) => void
  onClose: () => void
}

/**
 * Barcode entry (blueprint D2), layered honestly:
 * 1. Camera scanning through the browser BarcodeDetector API where
 *    the platform provides it (Chrome/Android). No WASM fallback is
 *    bundled: on browsers without it (notably iOS Safari) the manual
 *    path below is the scanner, and the UI says so plainly.
 * 2. Manual code entry, always visible and autofocused. USB HID
 *    scanners present as keyboards: they type the code and press
 *    Enter, which submits here, so wedge scanners work with no
 *    pairing or extra code.
 * Camera denial is not an error wall: the manual path stays usable.
 */
export function BarcodeScanner({ onDetected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number>(0)
  const doneRef = useRef(false)
  const [manual, setManual] = useState('')
  const [cameraState, setCameraState] = useState<'starting' | 'on' | 'unavailable'>('starting')

  useEffect(() => {
    doneRef.current = false
    const Detector = (window as any).BarcodeDetector

    if (!Detector || !navigator.mediaDevices?.getUserMedia) {
      setCameraState('unavailable')
      return
    }

    let detector: any
    try {
      detector = new Detector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'] })
    } catch {
      setCameraState('unavailable')
      return
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then(async (stream) => {
        if (doneRef.current) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => {})
        }
        setCameraState('on')

        const tick = async () => {
          if (doneRef.current || !videoRef.current) return
          try {
            const codes = await detector.detect(videoRef.current)
            const value = codes?.[0]?.rawValue
            if (value) {
              doneRef.current = true
              onDetected(String(value))
              return
            }
          } catch {
            // A failed frame is not fatal; keep scanning.
          }
          rafRef.current = requestAnimationFrame(() => {
            setTimeout(tick, 120)
          })
        }
        void tick()
      })
      .catch(() => setCameraState('unavailable'))

    return () => {
      doneRef.current = true
      cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    // onDetected is a stable parent callback for the life of the modal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submitManual = () => {
    const code = manual.trim()
    if (!code) return
    doneRef.current = true
    onDetected(code)
  }

  return (
    <Modal
      open
      onClose={onClose}
      ariaLabel="Barcode scan karo"
      panelClassName="max-w-[min(92vw,28rem)] bg-white dark:bg-[#1C1C1E] rounded-3xl overflow-hidden shadow-2xl"
    >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-[#38383A]">
          <h2 className="font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
            <Camera className="w-5 h-5 text-[#1B7A4A] dark:text-[#25D366]" aria-hidden="true" />
            Barcode Scan Karo
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Scanner band karo"
            className="tap w-11 h-11 rounded-full bg-gray-100 dark:bg-[#2C2C2E] flex items-center justify-center"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {cameraState === 'on' ? (
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-[4/3]">
              <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
              <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-24 border-2 border-[#25D366] rounded-xl pointer-events-none" />
            </div>
          ) : (
            <div className="rounded-2xl bg-gray-50 dark:bg-[#2C2C2E] px-4 py-5 text-center">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                {cameraState === 'starting'
                  ? 'Camera khul raha hai...'
                  : 'Is browser mein camera scanning available nahi hai. Neeche code type karke add karo, ya scanner gun se scan karo, code apne aap aa jayega.'}
              </p>
              {/* Keep the video element mounted for the detector loop. */}
              <video ref={videoRef} className="hidden" muted playsInline />
            </div>
          )}

          <div>
            <label htmlFor="barcode-manual" className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1.5 mb-1.5">
              <Keyboard className="w-3.5 h-3.5" aria-hidden="true" /> Barcode type karo ya scanner gun
            </label>
            <div className="flex gap-2">
              <input
                id="barcode-manual"
                type="text"
                inputMode="numeric"
                autoFocus={cameraState !== 'on'}
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    submitManual()
                  }
                }}
                placeholder="e.g. 8901234567890"
                className="flex-1 px-4 py-3 bg-gray-50 dark:bg-[#2C2C2E] border border-gray-200 dark:border-[#38383A] rounded-xl text-sm outline-none focus:border-[#1B7A4A]"
              />
              <button
                type="button"
                onClick={submitManual}
                className="tap px-5 rounded-xl bg-[#1B7A4A] hover:bg-[#155F3A] text-white font-bold text-sm transition-colors"
              >
                Add Karo
              </button>
            </div>
          </div>
        </div>
    </Modal>
  )
}
