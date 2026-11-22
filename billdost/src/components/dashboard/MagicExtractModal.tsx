'use client'

import { useState, useRef } from 'react'
import { trpc } from '@/lib/trpc/client'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { Modal } from '@/components/ui/Modal'

interface ExtractedProduct {
  name: string
  price: number
  category?: string | null
  unit: 'piece' | 'kg' | 'g' | 'litre' | 'ml' | 'dozen' | 'pack' | 'service' | 'hour'
}

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
}

export default function MagicExtractModal({ open, onClose, onSaved }: Props) {
  const [tab, setTab] = useState<'image' | 'url'>('image')
  const [url, setUrl] = useState('')
  const [previewItems, setPreviewItems] = useState<ExtractedProduct[]>([])
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const extractUrlMut = trpc.ai.extractFromUrl.useMutation()
  const extractImageMut = trpc.ai.extractFromImage.useMutation()
  const createManyMut = trpc.products.createMany.useMutation()

  const isExtracting = extractUrlMut.isPending || extractImageMut.isPending
  const isSaving = createManyMut.isPending

  // Handle URL Extraction
  const handleExtractUrl = async () => {
    if (!url.trim() || !url.startsWith('http')) {
      toast.error('Please enter a valid full URL (e.g., https://example.com)')
      return
    }
    
    try {
      const items = await extractUrlMut.mutateAsync({ url })
      if (!items || items.length === 0) {
        toast.error('No products found on that page.')
        return
      }
      setPreviewItems(items as ExtractedProduct[])
      toast.success(`Extracted ${items.length} items! Please review them.`)
    } catch (err: any) {
      toast.error(err.message || 'Failed to extract from URL.')
    }
  }

  // Handle Image Extraction
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB')
      return
    }

    const reader = new FileReader()
    reader.onload = async (evt) => {
      try {
        const base64Str = (evt.target?.result as string).split(',')[1]
        
        const items = await extractImageMut.mutateAsync({ 
          base64: base64Str,
          mimeType: file.type 
        })

        if (!items || items.length === 0) {
          toast.error('Could not find any products in this image.')
          return
        }

        setPreviewItems(items as ExtractedProduct[])
        toast.success(`Extracted ${items.length} items! Please review them.`)
      } catch (err: any) {
        toast.error(err.message || 'Failed to extract from image.')
      }
    }
    reader.readAsDataURL(file)
  }

  // Edit preview item
  const updateItem = (index: number, field: keyof ExtractedProduct, value: any) => {
    const newItems = [...previewItems]
    newItems[index] = { ...newItems[index], [field]: value }
    setPreviewItems(newItems)
  }

  const removeItem = (index: number) => {
    setPreviewItems(previewItems.filter((_, i) => i !== index))
  }

  // Save to DB
  const handleSaveAll = async () => {
    if (previewItems.length === 0) return
    
    // basic validation
    if (previewItems.some(p => !p.name.trim())) {
      toast.error('All items must have a name.')
      return
    }

    try {
      const res = await createManyMut.mutateAsync(previewItems.map(p => ({
        ...p,
        tax_rate: 0,
        is_active: true
      })))
      
      toast.success(`Successfully saved ${res.imported} products to your catalog!`)
      setPreviewItems([])
      setUrl('')
      onSaved()
      onClose()
    } catch (err: any) {
      toast.error(err.message || 'Failed to save products.')
    }
  }

  // Shared Modal (portal at body level): the old inline fixed
  // overlay sat inside PageTransition's transformed wrapper, which
  // made it render off-centre, shift the page and widen it. The
  // portal pattern makes that impossible.
  return (
    <Modal
      open={open}
      onClose={onClose}
      ariaLabel="Magic Extract"
      panelClassName="max-w-[min(92vw,56rem)] max-h-[90dvh] bg-white dark:bg-[#1C1C1E] rounded-3xl shadow-2xl flex flex-col overflow-hidden"
    >

        {/* Header */}
        <div className="px-6 py-5 border-b border-black/5 dark:border-white/5 flex items-center justify-between bg-gradient-to-r from-[#1B7A4A]/5 to-[#25D366]/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1B7A4A] to-[#25D366] flex items-center justify-center shadow-lg shadow-[#25D366]/20">
              <span className="text-xl">✨</span>
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight">Magic Extract</h2>
              <p className="text-sm text-[#6E6E73] dark:text-[#98989D] font-medium">Auto-fill your catalog using AI</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-[#6E6E73] hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            {previewItems.length > 0 ? (
              /* PREVIEW SCREEN */
              <motion.div 
                key="preview"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-[16px] text-[#1D1D1F] dark:text-[#F5F5F7]">
                    Review {previewItems.length} Extracted Items
                  </h3>
                  <button 
                    onClick={() => setPreviewItems([])}
                    className="text-sm font-semibold text-red-500 hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                  >
                    Discard All
                  </button>
                </div>

                <div className="border border-black/5 dark:border-white/5 rounded-2xl overflow-hidden">
                  <div className="max-h-[50vh] overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-[#F7F7F5] dark:bg-[#1C1C1E] sticky top-0 z-10">
                        <tr>
                          <th className="px-4 py-3 text-[12px] font-bold text-[#6E6E73] dark:text-[#98989D] uppercase tracking-wider">Item Name</th>
                          <th className="px-4 py-3 text-[12px] font-bold text-[#6E6E73] dark:text-[#98989D] uppercase tracking-wider w-32">Price (₹)</th>
                          <th className="px-4 py-3 text-[12px] font-bold text-[#6E6E73] dark:text-[#98989D] uppercase tracking-wider w-40">Category</th>
                          <th className="px-4 py-3 text-[12px] font-bold text-[#6E6E73] dark:text-[#98989D] uppercase tracking-wider w-16"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/5 dark:divide-white/5">
                        {previewItems.map((item, i) => (
                          <tr key={i} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors group">
                            <td className="px-4 py-2">
                              <input 
                                value={item.name}
                                onChange={(e) => updateItem(i, 'name', e.target.value)}
                                className="w-full bg-transparent border border-transparent focus:border-[#1B7A4A] rounded-md px-2 py-1.5 text-[14px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] outline-none"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <input 
                                type="number"
                                value={item.price}
                                onChange={(e) => updateItem(i, 'price', Number(e.target.value))}
                                className="w-full bg-transparent border border-transparent focus:border-[#1B7A4A] rounded-md px-2 py-1.5 text-[14px] font-bold text-[#1D1D1F] dark:text-[#F5F5F7] outline-none"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <input 
                                value={item.category || ''}
                                onChange={(e) => updateItem(i, 'category', e.target.value)}
                                placeholder="e.g. Starters"
                                className="w-full bg-transparent border border-transparent focus:border-[#1B7A4A] rounded-md px-2 py-1.5 text-[14px] text-[#6E6E73] dark:text-[#98989D] outline-none"
                              />
                            </td>
                            <td className="px-4 py-2 text-right">
                              <button 
                                onClick={() => removeItem(i)}
                                className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md transition-all"
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            ) : (
              /* UPLOAD SCREEN */
              <motion.div
                key="upload"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                {/* Tabs */}
                <div className="flex p-1 bg-black/5 dark:bg-white/5 rounded-xl w-max mb-6 mx-auto">
                  <button 
                    onClick={() => setTab('image')}
                    className={`px-5 py-2 rounded-lg text-[14px] font-semibold transition-all ${tab === 'image' ? 'bg-white dark:bg-[#2C2C2E] shadow-sm text-[#1D1D1F] dark:text-[#F5F5F7]' : 'text-[#6E6E73] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]'}`}
                  >
                    From Image
                  </button>
                  <button 
                    onClick={() => setTab('url')}
                    className={`px-5 py-2 rounded-lg text-[14px] font-semibold transition-all ${tab === 'url' ? 'bg-white dark:bg-[#2C2C2E] shadow-sm text-[#1D1D1F] dark:text-[#F5F5F7]' : 'text-[#6E6E73] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]'}`}
                  >
                    From Website
                  </button>
                </div>

                {tab === 'image' && (
                  <div className="text-center">
                    <input 
                      type="file" 
                      accept="image/png, image/jpeg, image/webp" 
                      ref={fileInputRef}
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <div 
                      onClick={() => !isExtracting && fileInputRef.current?.click()}
                      className={`border-2 border-dashed ${isExtracting ? 'border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800' : 'border-[#1B7A4A]/30 hover:border-[#1B7A4A] hover:bg-[#1B7A4A]/5'} rounded-[24px] p-12 transition-all cursor-pointer flex flex-col items-center justify-center min-h-[300px]`}
                    >
                      {isExtracting ? (
                        <>
                          <Spinner />
                          <p className="mt-4 font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">Reading Image...</p>
                          <p className="text-[13px] text-[#6E6E73] dark:text-[#98989D] mt-1">Our AI is extracting products. This takes a few seconds.</p>
                        </>
                      ) : (
                        <>
                          <div className="w-16 h-16 bg-[#1B7A4A]/10 text-[#1B7A4A] dark:bg-[#25D366]/10 dark:text-[#25D366] rounded-full flex items-center justify-center mb-4">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                          </div>
                          <p className="font-bold text-[16px] text-[#1D1D1F] dark:text-[#F5F5F7]">Click to upload menu or catalog</p>
                          <p className="text-[14px] text-[#6E6E73] dark:text-[#98989D] mt-2">PNG, JPG up to 5MB</p>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {tab === 'url' && (
                  <div className="max-w-md mx-auto text-center py-8">
                    <div className="w-16 h-16 mx-auto bg-[#25D366]/10 text-[#25D366] rounded-full flex items-center justify-center mb-6">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                    </div>
                    <h3 className="font-bold text-[18px] text-[#1D1D1F] dark:text-[#F5F5F7] mb-2">Extract from a Website</h3>
                    <p className="text-[14px] text-[#6E6E73] dark:text-[#98989D] mb-6">Paste a link to your Swiggy/Zomato menu, or your own e-commerce store to auto-extract items.</p>
                    
                    <div className="flex flex-col gap-3">
                      <input 
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://example.com/menu"
                        disabled={isExtracting}
                        className="w-full px-5 py-3.5 bg-white dark:bg-[#1C1C1E] border border-black/10 dark:border-white/10 rounded-xl text-[15px] font-semibold outline-none focus:border-[#1B7A4A] disabled:opacity-50"
                      />
                      <button 
                        onClick={handleExtractUrl}
                        disabled={isExtracting || !url}
                        className="w-full py-3.5 bg-[#1B7A4A] hover:bg-[#155F3A] text-white font-bold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isExtracting ? (
                          <>
                            <Spinner /> Scraping Website...
                          </>
                        ) : (
                          'Extract Products'
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        {previewItems.length > 0 && (
          <div className="px-6 py-4 border-t border-black/5 dark:border-white/5 flex gap-3 flex-shrink-0 bg-white dark:bg-[#1C1C1E]">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="px-6 py-3 rounded-xl border border-black/10 dark:border-white/10 text-sm font-semibold text-[#6E6E73] dark:text-[#98989D] hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveAll}
              disabled={isSaving}
              className="flex-1 py-3 rounded-xl bg-[#1B7A4A] hover:bg-[#155F3A] text-white text-[15px] font-bold transition-all shadow-md shadow-[#1B7A4A]/20 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSaving ? <Spinner /> : null}
              Save All to Catalog
            </button>
          </div>
        )}
    </Modal>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  )
}
