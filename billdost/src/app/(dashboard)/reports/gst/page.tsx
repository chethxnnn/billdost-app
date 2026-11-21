'use client'

import { useState } from 'react'
import { trpc } from '@/lib/trpc/client'
import * as XLSX from 'xlsx'
import { Download, FileSpreadsheet } from 'lucide-react'

const formatINR = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n)

export default function GstReportPage() {
  const today = new Date()
  const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
  const currentMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0]

  const [startDate, setStartDate] = useState(currentMonthStart)
  const [endDate, setEndDate] = useState(currentMonthEnd)

  const { data, isLoading } = trpc.reports.getGstSummary.useQuery({
    startDate,
    endDate,
  })

  const exportData = data?.invoices.map(inv => ({
    'Invoice Date': inv.invoice_date,
    'Invoice Number': inv.invoice_number,
    'Customer Name': inv.customer_name,
    'Taxable Value': inv.taxable_amt || 0,
    'CGST Amount': inv.cgst_amt || 0,
    'SGST Amount': inv.sgst_amt || 0,
    'IGST Amount': inv.igst_amt || 0,
    'Total Invoice Value': inv.total || 0,
    'Status': inv.payment_status?.toUpperCase() || 'UNPAID'
  })) || []

  const handleExportExcel = () => {
    if (!exportData.length) return
    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Sales Report")
    XLSX.writeFile(wb, `GST_Report_${startDate}_to_${endDate}.xlsx`)
  }

  const handleExportCSV = () => {
    if (!exportData.length) return
    const ws = XLSX.utils.json_to_sheet(exportData)
    const csv = XLSX.utils.sheet_to_csv(ws)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `GST_Report_${startDate}_to_${endDate}.csv`
    link.click()
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Tax & CA Report
          </h1>
          <p className="text-sm text-gray-400 dark:text-[#98989D] mt-0.5">
            CA-ready format for your GST filings
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
          <div className="flex gap-2">
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-4 py-2 bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] rounded-xl text-sm"
            />
            <span className="self-center text-gray-400">to</span>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-4 py-2 bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] rounded-xl text-sm"
            />
          </div>
          
          {data && data.invoices.length > 0 && (
            <div className="flex gap-2">
              <button 
                onClick={handleExportCSV}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] hover:bg-gray-50 dark:hover:bg-[#2C2C2E] text-gray-700 dark:text-gray-300 rounded-xl text-sm font-bold transition-colors"
              >
                <Download className="w-4 h-4" /> CSV
              </button>
              <button 
                onClick={handleExportExcel}
                className="flex items-center gap-2 px-4 py-2 bg-[#1B7A4A] hover:bg-[#155F3A] text-white rounded-xl text-sm font-bold shadow-md transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4" /> Excel
              </button>
            </div>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-gray-50 dark:bg-[#1C1C1E] rounded-2xl" />
          <div className="h-64 bg-gray-50 dark:bg-[#1C1C1E] rounded-2xl" />
        </div>
      ) : !data ? (
        <div className="text-center py-20 text-gray-400">Data fetch nahi ho paya.</div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-white dark:bg-[#1C1C1E] border border-gray-100 dark:border-[#38383A] p-4 rounded-2xl ios-shadow">
              <div className="text-[10px] font-bold text-gray-400 dark:text-[#98989D] uppercase tracking-wider mb-1">Total Bills Value</div>
              <div className="text-lg font-black text-gray-900 dark:text-white">{formatINR(data.summary.totalRevenue)}</div>
            </div>
            <div className="bg-white dark:bg-[#1C1C1E] border border-gray-100 dark:border-[#38383A] p-4 rounded-2xl ios-shadow">
              <div className="text-[10px] font-bold text-gray-400 dark:text-[#98989D] uppercase tracking-wider mb-1">Taxable Amount</div>
              <div className="text-lg font-black text-blue-600 dark:text-blue-400">{formatINR(data.summary.totalTaxable)}</div>
            </div>
            <div className="bg-white dark:bg-[#1C1C1E] border border-gray-100 dark:border-[#38383A] p-4 rounded-2xl ios-shadow">
              <div className="text-[10px] font-bold text-gray-400 dark:text-[#98989D] uppercase tracking-wider mb-1">CGST Total</div>
              <div className="text-lg font-black text-orange-600 dark:text-orange-400">{formatINR(data.summary.totalCgst)}</div>
            </div>
            <div className="bg-white dark:bg-[#1C1C1E] border border-gray-100 dark:border-[#38383A] p-4 rounded-2xl ios-shadow">
              <div className="text-[10px] font-bold text-gray-400 dark:text-[#98989D] uppercase tracking-wider mb-1">SGST Total</div>
              <div className="text-lg font-black text-[#1B7A4A] dark:text-[#25D366]">{formatINR(data.summary.totalSgst)}</div>
            </div>
            <div className="bg-white dark:bg-[#1C1C1E] border border-gray-100 dark:border-[#38383A] p-4 rounded-2xl ios-shadow">
              <div className="text-[10px] font-bold text-gray-400 dark:text-[#98989D] uppercase tracking-wider mb-1">IGST Total</div>
              <div className="text-lg font-black text-purple-600 dark:text-purple-400">{formatINR(data.summary.totalIgst)}</div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-[#1C1C1E] border border-gray-100 dark:border-[#38383A] rounded-2xl overflow-hidden ios-shadow">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 dark:bg-[#2C2C2E] text-xs font-bold text-gray-500 dark:text-[#98989D] uppercase tracking-wider">
                  <tr>
                    <th className="p-4">Date</th>
                    <th className="p-4">Invoice #</th>
                    <th className="p-4">Customer</th>
                    <th className="p-4 text-right">Taxable</th>
                    <th className="p-4 text-right">CGST</th>
                    <th className="p-4 text-right">SGST</th>
                    <th className="p-4 text-right">IGST</th>
                    <th className="p-4 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#38383A]">
                  {data.invoices.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-gray-400">Is date range mein koi bills nahi hain.</td>
                    </tr>
                  ) : (
                    data.invoices.map(inv => (
                      <tr key={inv.invoice_number} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                        <td className="p-4 text-gray-500">{inv.invoice_date}</td>
                        <td className="p-4 font-bold text-gray-900 dark:text-white">{inv.invoice_number}</td>
                        <td className="p-4 text-gray-700 dark:text-gray-300">{inv.customer_name}</td>
                        <td className="p-4 text-right text-gray-500">{formatINR(inv.taxable_amt || 0)}</td>
                        <td className="p-4 text-right text-gray-500">{formatINR(inv.cgst_amt || 0)}</td>
                        <td className="p-4 text-right text-gray-500">{formatINR(inv.sgst_amt || 0)}</td>
                        <td className="p-4 text-right text-gray-500">{formatINR(inv.igst_amt || 0)}</td>
                        <td className="p-4 text-right font-bold text-gray-900 dark:text-white">{formatINR(inv.total || 0)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
