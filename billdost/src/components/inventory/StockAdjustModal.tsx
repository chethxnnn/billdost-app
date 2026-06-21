'use client'

import React, { useState } from 'react'
import { X, Plus, Minus, Equal, CheckCircle2 } from 'lucide-react'
import { trpc } from '@/lib/trpc/client'
import { toast } from 'sonner'

interface Props {
  product: any
  onClose: () => void
  onSuccess: () => void
}

export function StockAdjustModal({ product, onClose, onSuccess }: Props) {
  const [mode, setMode] = useState<'add' | 'subtract' | 'set'>('add')
  const [qtyInput, setQtyInput] = useState<number | ''>('')
  const [notes, setNotes] = useState('')
  
  const updateMut = trpc.products.updateStock.useMutation()

  const handleSave = async () => {
    if (qtyInput === '' || Number(qtyInput) < 0) {
      toast.error('Please enter a valid positive quantity')
      return
    }

    const val = Number(qtyInput)
    let finalQty = Number(product.stock_qty || 0)

    let type: 'STOCK_IN' | 'STOCK_OUT' | 'AUDIT' = 'AUDIT'
    if (mode === 'add') {
      finalQty += val
      type = 'STOCK_IN'
    } else if (mode === 'subtract') {
      if (val > finalQty) {
        toast.error('Cannot subtract more than current stock')
        return
      }
      finalQty -= val
      type = 'STOCK_OUT'
    } else {
      finalQty = val
      type = 'AUDIT'
    }

    try {
      await updateMut.mutateAsync({
        id: product.id,
        qty: finalQty,
        notes: notes.trim() || undefined,
        type,
      })
      toast.success('Stock updated successfully')
      onSuccess()
      onClose()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div 
        className="bg-white dark:bg-[#161513] rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-black/5 dark:border-white/5 bg-gray-50/50 dark:bg-[#1C1C1E]/50">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Adjust Stock</h2>
            <p className="text-sm text-gray-500 mt-1 truncate max-w-[280px]">{product.name}</p>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-black/5 dark:bg-white/5 text-gray-500 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between bg-gray-50 dark:bg-[#1C1C1E] p-4 rounded-2xl border border-black/5 dark:border-white/5">
            <span className="text-sm font-semibold text-gray-500">Current Stock</span>
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {product.stock_qty || 0} <span className="text-sm font-medium text-gray-500 ml-1">{product.unit}</span>
            </span>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Adjustment Type</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setMode('add')}
                className={`flex flex-col items-center justify-center py-3 rounded-xl border-2 transition-all ${
                  mode === 'add' 
                    ? 'border-[#1B7A4A] bg-[#1B7A4A]/10 text-[#1B7A4A] dark:border-[#25D366] dark:bg-[#25D366]/10 dark:text-[#25D366]' 
                    : 'border-transparent bg-gray-50 dark:bg-[#1C1C1E] text-gray-500 hover:bg-gray-100 dark:hover:bg-[#2C2C2E]'
                }`}
              >
                <Plus className="w-5 h-5 mb-1" />
                <span className="text-xs font-bold">Stock In</span>
              </button>
              <button
                type="button"
                onClick={() => setMode('subtract')}
                className={`flex flex-col items-center justify-center py-3 rounded-xl border-2 transition-all ${
                  mode === 'subtract' 
                    ? 'border-red-500 bg-red-500/10 text-red-600 dark:border-red-400 dark:bg-red-500/20 dark:text-red-400' 
                    : 'border-transparent bg-gray-50 dark:bg-[#1C1C1E] text-gray-500 hover:bg-gray-100 dark:hover:bg-[#2C2C2E]'
                }`}
              >
                <Minus className="w-5 h-5 mb-1" />
                <span className="text-xs font-bold">Stock Out</span>
              </button>
              <button
                type="button"
                onClick={() => setMode('set')}
                className={`flex flex-col items-center justify-center py-3 rounded-xl border-2 transition-all ${
                  mode === 'set' 
                    ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:border-blue-400 dark:bg-blue-500/20 dark:text-blue-400' 
                    : 'border-transparent bg-gray-50 dark:bg-[#1C1C1E] text-gray-500 hover:bg-gray-100 dark:hover:bg-[#2C2C2E]'
                }`}
              >
                <Equal className="w-5 h-5 mb-1" />
                <span className="text-xs font-bold">Exact Qty</span>
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-bold text-gray-700 dark:text-gray-300">
              {mode === 'add' ? 'Quantity to Add' : mode === 'subtract' ? 'Quantity to Remove' : 'New Exact Quantity'}
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="0.01"
                value={qtyInput}
                onChange={(e) => setQtyInput(e.target.value ? Number(e.target.value) : '')}
                placeholder="0"
                className="w-full text-center text-3xl font-black py-4 bg-gray-50 dark:bg-[#1C1C1E] border border-black/10 dark:border-white/10 rounded-2xl outline-none focus:border-[#1B7A4A] dark:focus:border-[#25D366] transition-all"
                autoFocus
              />
              <span className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-400 font-bold">
                {product.unit}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Notes (Optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. New stock arrived, Damaged items"
              className="w-full px-4 py-3 bg-gray-50 dark:bg-[#1C1C1E] border border-black/10 dark:border-white/10 rounded-xl outline-none focus:border-[#1B7A4A] dark:focus:border-[#25D366] transition-all text-sm dark:text-white"
            />
          </div>

        </div>

        <div className="p-6 pt-0 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3.5 rounded-2xl border border-black/10 dark:border-white/10 font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#1C1C1E] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={updateMut.isPending || qtyInput === ''}
            className="flex-[2] flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-[#1B7A4A] dark:bg-[#25D366] text-white font-bold hover:bg-[#155F3A] dark:hover:bg-[#1DA851] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-[#1B7A4A]/20"
          >
            {updateMut.isPending ? 'Saving...' : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                Confirm Update
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
