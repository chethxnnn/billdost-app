'use client'

import React, { useState, useMemo } from 'react'
import { trpc } from '@/lib/trpc/client'
import { Search, AlertTriangle, Box, ArrowRightLeft, IndianRupee } from 'lucide-react'
import { StockAdjustModal } from '@/components/inventory/StockAdjustModal'
import { BatchExpiryTab } from '@/components/inventory/BatchExpiryTab'

import { format } from 'date-fns'

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState<'stock' | 'history' | 'report' | 'expiry'>('stock')
  const [search, setSearch] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null)

  // Report state
  const [reportMonth, setReportMonth] = useState(new Date().getMonth() + 1)
  const [reportYear, setReportYear] = useState(new Date().getFullYear())

  const { data: products = [], isLoading, refetch } = trpc.products.list.useQuery({ active: true })
  
  // Fetch logs and reports only when their tabs are active
  const { data: logs = [], isLoading: isLoadingLogs } = trpc.products.inventoryLogs.useQuery({}, { enabled: activeTab === 'history' })
  const { data: reportLogs = [], isLoading: isLoadingReport } = trpc.products.monthlyReport.useQuery(
    { year: reportYear, month: reportMonth },
    { enabled: activeTab === 'report' }
  )

  // Filter products locally for speed
  const filteredProducts = useMemo(() => {
    return products.filter(p => 
      p.name.toLowerCase().includes(search.toLowerCase()) || 
      (p.category && p.category.toLowerCase().includes(search.toLowerCase()))
    )
  }, [products, search])

  // Analytics
  const { totalValue, totalItems, lowStockItems } = useMemo(() => {
    let value = 0
    let items = 0
    let lowStock = []

    for (const p of products) {
      if (p.stock_qty) {
        value += Number(p.stock_qty) * Number(p.cost_price || p.price || 0)
        items += Number(p.stock_qty)
      }
      if (p.stock_qty !== null && p.stock_qty <= (p.low_stock_alert || 0)) {
        lowStock.push(p)
      }
    }

    return { totalValue: value, totalItems: items, lowStockItems: lowStock }
  }, [products])

  return (
    <div className="w-full max-w-[1400px] mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">Stock Management</h1>
          <p className="text-gray-500 text-sm mt-1">Track inventory, adjust stock, and manage low stock alerts.</p>
        </div>
      </div>

      {/* Top Dashboards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-[#1C1C1E] border border-black/5 dark:border-white/5 p-5 rounded-3xl shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <Box className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-gray-600 dark:text-gray-400">Total Items in Stock</h3>
          </div>
          <p className="text-3xl font-black text-gray-900 dark:text-white mt-2">{totalItems.toLocaleString()}</p>
        </div>

        <div className="bg-white dark:bg-[#1C1C1E] border border-black/5 dark:border-white/5 p-5 rounded-3xl shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-[#1B7A4A]/10 dark:bg-[#25D366]/10 text-[#1B7A4A] dark:text-[#25D366] flex items-center justify-center">
              <IndianRupee className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-gray-600 dark:text-gray-400">Total Stock Value</h3>
          </div>
          <p className="text-3xl font-black text-gray-900 dark:text-white mt-2">₹{totalValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
        </div>

        <div className={`bg-white dark:bg-[#1C1C1E] border border-black/5 dark:border-white/5 p-5 rounded-3xl shadow-sm relative overflow-hidden ${lowStockItems.length > 0 ? 'ring-2 ring-red-500/50' : ''}`}>
          {lowStockItems.length > 0 && <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/10 rounded-bl-full" />}
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${lowStockItems.length > 0 ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'}`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-gray-600 dark:text-gray-400">Low Stock Alerts</h3>
          </div>
          <p className={`text-3xl font-black mt-2 ${lowStockItems.length > 0 ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>
            {lowStockItems.length}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-black/10 dark:border-white/10 overflow-x-auto hide-scrollbar">
        <button
          onClick={() => setActiveTab('stock')}
          className={`px-4 sm:px-6 py-3 font-bold text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === 'stock' ? 'border-[#1B7A4A] dark:border-[#25D366] text-[#1B7A4A] dark:text-[#25D366]' : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
        >
          Stock Levels
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 sm:px-6 py-3 font-bold text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === 'history' ? 'border-[#1B7A4A] dark:border-[#25D366] text-[#1B7A4A] dark:text-[#25D366]' : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
        >
          Ledger
        </button>
        <button
          onClick={() => setActiveTab('report')}
          className={`px-4 sm:px-6 py-3 font-bold text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === 'report' ? 'border-[#1B7A4A] dark:border-[#25D366] text-[#1B7A4A] dark:text-[#25D366]' : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
        >
          Report
        </button>
        <button
          onClick={() => setActiveTab('expiry')}
          className={`px-4 sm:px-6 py-3 font-bold text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === 'expiry' ? 'border-[#1B7A4A] dark:border-[#25D366] text-[#1B7A4A] dark:text-[#25D366]' : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
        >
          Batch & Expiry
        </button>
      </div>

      {/* Main Grid */}
      <div className="bg-white dark:bg-[#1C1C1E] border border-black/5 dark:border-white/5 rounded-3xl shadow-sm overflow-hidden flex flex-col min-h-[400px] max-h-[calc(100vh-280px)]">
        
        {activeTab === 'stock' && (
          <>
            {/* Toolbar */}
            <div className="p-4 border-b border-black/5 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by product name or category..."
                  className="w-full pl-11 pr-4 py-2.5 bg-gray-50 dark:bg-[#1C1C1E] border border-transparent focus:border-[#1B7A4A] dark:focus:border-[#25D366] rounded-xl text-sm outline-none transition-all dark:text-white"
                />
              </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-gray-50/95 dark:bg-[#1C1C1E]/95 backdrop-blur-sm border-b border-black/5 dark:border-white/5 z-10">
                  <tr>
                    <th className="px-6 py-4 font-bold text-gray-500">Product Name</th>
                    <th className="px-6 py-4 font-bold text-gray-500">Category</th>
                    <th className="px-6 py-4 font-bold text-gray-500">Price / Cost</th>
                    <th className="px-6 py-4 font-bold text-gray-500">Current Stock</th>
                    <th className="px-6 py-4 font-bold text-gray-500 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/5">
                  {isLoading ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                        <div className="animate-pulse flex flex-col items-center">
                          <div className="w-8 h-8 border-4 border-[#1B7A4A] dark:border-[#25D366] border-t-transparent rounded-full animate-spin mb-3"></div>
                          Loading inventory...
                        </div>
                      </td>
                    </tr>
                  ) : filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                        No products found.
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map(product => {
                      const isLowStock = product.stock_qty !== null && product.stock_qty <= (product.low_stock_alert || 0)
                      return (
                        <tr key={product.id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors group">
                          <td className="px-6 py-4">
                            <div className="font-bold text-gray-900 dark:text-white">{product.name}</div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex px-2 py-1 rounded-md bg-gray-100 dark:bg-[#2C2C2E] text-xs font-semibold text-gray-600 dark:text-gray-300">
                              {product.category || 'Uncategorized'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-gray-900 dark:text-white font-semibold">₹{product.price}</div>
                            {product.cost_price && <div className="text-xs text-gray-500">Cost: ₹{product.cost_price}</div>}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className={`text-lg font-black ${isLowStock ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>
                                {product.stock_qty ?? '∞'}
                              </span>
                              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{product.unit}</span>
                              {isLowStock && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse ml-1" title="Low Stock" />}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => setSelectedProduct(product)}
                              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 font-bold transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
                            >
                              <ArrowRightLeft className="w-4 h-4" />
                              Adjust
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-gray-50/95 dark:bg-[#1C1C1E]/95 backdrop-blur-sm border-b border-black/5 dark:border-white/5 z-10">
                <tr>
                  <th className="px-6 py-4 font-bold text-gray-500">Date</th>
                  <th className="px-6 py-4 font-bold text-gray-500">Product</th>
                  <th className="px-6 py-4 font-bold text-gray-500">Type</th>
                  <th className="px-6 py-4 font-bold text-gray-500">Change</th>
                  <th className="px-6 py-4 font-bold text-gray-500">Result</th>
                  <th className="px-6 py-4 font-bold text-gray-500">Notes / Ref</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/5">
                {isLoadingLogs ? (
                  <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-500">Loading ledger...</td></tr>
                ) : logs.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-500">No stock movements found.</td></tr>
                ) : (
                  logs.map((log: any) => (
                    <tr key={log.id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02]">
                      <td className="px-6 py-4 text-gray-500">{format(new Date(log.created_at), 'dd MMM, HH:mm')}</td>
                      <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">{log.products?.name}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          log.type === 'SALE' ? 'bg-blue-100 text-blue-700' :
                          log.type === 'STOCK_IN' ? 'bg-green-100 text-green-700' :
                          log.type === 'STOCK_OUT' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {log.type}
                        </span>
                      </td>
                      <td className={`px-6 py-4 font-black ${log.quantity_change > 0 ? 'text-green-500' : log.quantity_change < 0 ? 'text-red-500' : 'text-gray-500'}`}>
                        {log.quantity_change > 0 ? '+' : ''}{log.quantity_change}
                      </td>
                      <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white">{log.new_stock}</td>
                      <td className="px-6 py-4 text-gray-500 text-xs">
                        {log.reference_number && <div className="font-bold text-blue-500">{log.reference_number}</div>}
                        {log.notes}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Batch & Expiry Tab */}
        {activeTab === 'expiry' && <BatchExpiryTab />}

        {/* Report Tab */}
        {activeTab === 'report' && (
          <div className="flex flex-col h-full">
            <div className="p-4 border-b border-black/5 dark:border-white/5 flex gap-4 bg-gray-50 dark:bg-[#1C1C1E]">
              <select 
                value={reportMonth} 
                onChange={e => setReportMonth(Number(e.target.value))}
                className="px-4 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#1C1C1E] text-sm font-bold dark:text-white outline-none"
              >
                {Array.from({length: 12}).map((_, i) => (
                  <option key={i+1} value={i+1}>{format(new Date(2020, i, 1), 'MMMM')}</option>
                ))}
              </select>
              <select 
                value={reportYear} 
                onChange={e => setReportYear(Number(e.target.value))}
                className="px-4 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#1C1C1E] text-sm font-bold dark:text-white outline-none"
              >
                {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="flex-1 overflow-auto p-6 bg-gray-50 dark:bg-[#1C1C1E]">
              {isLoadingReport ? (
                <div className="text-center text-gray-500 mt-10">Generating report...</div>
              ) : reportLogs.length === 0 ? (
                <div className="text-center text-gray-500 mt-10">No stock movements found in {format(new Date(reportYear, reportMonth - 1, 1), 'MMMM yyyy')}</div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(
                    reportLogs.reduce((acc: any, log: any) => {
                      if (!acc[log.products.name]) acc[log.products.name] = { in: 0, out: 0, sales: 0, logs: [] }
                      if (log.type === 'STOCK_IN') acc[log.products.name].in += Number(log.quantity_change)
                      if (log.type === 'STOCK_OUT') acc[log.products.name].out += Math.abs(Number(log.quantity_change))
                      if (log.type === 'SALE') acc[log.products.name].sales += Math.abs(Number(log.quantity_change))
                      acc[log.products.name].logs.push(log)
                      return acc
                    }, {})
                  ).map(([productName, stats]: any) => (
                    <div key={productName} className="bg-white dark:bg-[#1C1C1E] p-5 rounded-2xl border border-black/5 dark:border-white/5 shadow-sm">
                      <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-4">{productName}</h3>
                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div className="bg-gray-50 dark:bg-[#1C1C1E] p-3 rounded-xl border border-black/5 dark:border-white/5"><span className="text-xs text-gray-500 block">Total Added</span><span className="font-black text-green-500">+{stats.in}</span></div>
                        <div className="bg-gray-50 dark:bg-[#1C1C1E] p-3 rounded-xl border border-black/5 dark:border-white/5"><span className="text-xs text-gray-500 block">Total Sold</span><span className="font-black text-blue-500">-{stats.sales}</span></div>
                        <div className="bg-gray-50 dark:bg-[#1C1C1E] p-3 rounded-xl border border-black/5 dark:border-white/5"><span className="text-xs text-gray-500 block">Lost/Removed</span><span className="font-black text-red-500">-{stats.out}</span></div>
                      </div>
                      <table className="w-full text-xs text-left">
                        <thead><tr className="text-gray-400 border-b border-black/5 dark:border-white/5"><th className="pb-2">Date</th><th className="pb-2">Type</th><th className="pb-2">Change</th><th className="pb-2">Ref</th></tr></thead>
                        <tbody>
                          {stats.logs.map((l: any) => (
                            <tr key={l.id} className="border-b border-black/5 dark:border-white/5 last:border-0">
                              <td className="py-2 text-gray-600 dark:text-gray-400">{format(new Date(l.created_at), 'dd MMM')}</td>
                              <td className="py-2 font-semibold text-gray-900 dark:text-white">{l.type}</td>
                              <td className={`py-2 font-bold ${l.quantity_change > 0 ? 'text-green-500' : 'text-red-500'}`}>{l.quantity_change > 0 ? '+' : ''}{l.quantity_change}</td>
                              <td className="py-2 text-blue-500 truncate max-w-[120px]">{l.reference_number || l.notes}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {selectedProduct && (
        <StockAdjustModal 
          product={selectedProduct} 
          onClose={() => setSelectedProduct(null)} 
          onSuccess={() => refetch()} 
        />
      )}
    </div>
  )
}
