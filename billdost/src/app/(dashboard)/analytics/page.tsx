'use client'

import { trpc } from '@/lib/trpc/client'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts'
import { ArrowUpRight, ArrowDownRight, Users } from 'lucide-react'

/* ─── Helpers ─── */
const formatINR = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

/* ─── AI/ML Forecast Widget ─── */
function MLForecastWidget({
  data,
  loading,
}: {
  data?: Array<{ productName: string; predictedQuantity: number; trend: string; reason: string; recentSales: number }>
  loading: boolean
}) {
  return (
    <div className="bg-white/80 dark:bg-[#1C1C1E]/80 backdrop-blur-xl border border-black/5 dark:border-white/5 rounded-[24px] p-6 ios-shadow h-full flex flex-col">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        </div>
        <div>
          <h3 className="text-[17px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight">
            Sales Forecast (Next 7 Days)
          </h3>
          <p className="text-[12px] font-medium text-[#86868B] dark:text-[#98989D]">
            Powered by Local Math Model
          </p>
        </div>
      </div>
      
      {loading ? (
        <div className="space-y-4 flex-1">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse h-16 w-full rounded-[14px] bg-black/5 dark:bg-white/5" />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <p className="text-[13px] text-[#86868B] dark:text-[#98989D]">Not enough sales history to forecast.</p>
        </div>
      ) : (
        <div className="space-y-3 flex-1 overflow-y-auto pr-2 scrollbar-none">
          {data.map((item, idx) => (
            <div key={idx} className="bg-black/5 dark:bg-white/5 rounded-[16px] p-3 flex items-start gap-3 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-2 opacity-10">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
              </div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${item.trend === 'up' ? 'bg-green-500/10 text-green-500' : item.trend === 'down' ? 'bg-red-500/10 text-red-500' : 'bg-gray-500/10 text-gray-500'}`}>
                {item.trend === 'up' ? <ArrowUpRight className="w-5 h-5" /> : item.trend === 'down' ? <ArrowDownRight className="w-5 h-5" /> : <span className="text-sm font-bold">-</span>}
              </div>
              <div className="flex-1 min-w-0 z-10">
                <div className="flex justify-between items-center mb-1">
                  <div className="text-[14px] font-bold text-[#1D1D1F] dark:text-[#F5F5F7] truncate pr-2">{item.productName}</div>
                  <div className="text-[16px] font-black text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight">{item.predictedQuantity} <span className="text-[10px] text-[#86868B] dark:text-[#98989D] font-medium">units</span></div>
                </div>
                <p className="text-[11px] text-[#86868B] dark:text-[#98989D] leading-snug">{item.reason}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── Top Customers Widget ─── */
function TopCustomersWidget({
  data,
  loading,
}: {
  data?: Array<{ name: string; total_billed: number }>
  loading: boolean
}) {
  const max = data && data.length > 0 ? Math.max(...data.map(d => Number(d.total_billed || 0))) : 1

  return (
    <div className="bg-white/80 dark:bg-[#1C1C1E]/80 backdrop-blur-xl border border-black/5 dark:border-white/5 rounded-[24px] p-6 ios-shadow h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-[17px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight">
            Top Customers
          </h3>
          <p className="text-[13px] font-medium text-[#86868B] dark:text-[#98989D]">
            By total billed amount
          </p>
        </div>
        <Users className="w-6 h-6 text-[#1B7A4A] dark:text-[#25D366] opacity-50" />
      </div>

      <div className="flex-1 flex flex-col justify-center gap-4">
        {loading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="w-full space-y-1">
              <div className="animate-pulse h-4 w-32 bg-black/5 dark:bg-white/5" />
              <div className="animate-pulse h-2 w-full rounded-full bg-black/5 dark:bg-white/5" />
            </div>
          ))
        ) : !data || data.length === 0 ? (
          <div className="text-center text-[13px] text-[#86868B] dark:text-[#98989D]">No customers found.</div>
        ) : (
          data.map((c, i) => {
            const val = Number(c.total_billed || 0)
            const pct = (val / max) * 100
            return (
              <div key={i} className="w-full relative group">
                <div className="flex justify-between items-end mb-1.5">
                  <span className="text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] truncate pr-4">{c.name}</span>
                  <span className="text-[12px] font-bold text-[#86868B] dark:text-[#98989D]">{formatINR(val)}</span>
                </div>
                <div className="h-2 w-full bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-[#1B7A4A] to-[#25D366] rounded-full transition-all duration-1000 ease-out" 
                    style={{ width: `${Math.max(pct, 2)}%` }}
                  />
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

export default function AnalyticsPage() {
  const { data: overview, isLoading: ovLoading } = trpc.analytics.overview.useQuery()
  const { data: trends, isLoading: trLoading } = trpc.analytics.revenueTrends.useQuery()
  const { data: topProducts, isLoading: tpLoading } = trpc.analytics.topProducts.useQuery()
  const { data: topCustomersData, isLoading: topCustLoading } = trpc.analytics.topCustomers.useQuery()
  const { data: forecastData, isLoading: forecastLoading } = trpc.analytics.predictProductSales.useQuery()

  return (
    <div className="w-full max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
          Business Insights 📊
        </h1>
        <p className="text-sm text-gray-400 dark:text-[#5C5A56] mt-0.5">
          Apne business ki progress yahan dekhiye
        </p>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#161513] border border-gray-100 dark:border-[#2E2C28] p-5 rounded-2xl ios-shadow">
          <div className="text-xs font-bold text-gray-400 dark:text-[#5C5A56] uppercase tracking-wider mb-1">Today's Revenue</div>
          <div className="text-2xl font-black text-[#1B7A4A] dark:text-[#25D366]">
            {ovLoading ? '...' : formatINR(overview?.todayRevenue || 0)}
          </div>
        </div>
        <div className="bg-white dark:bg-[#161513] border border-gray-100 dark:border-[#2E2C28] p-5 rounded-2xl ios-shadow">
          <div className="text-xs font-bold text-gray-400 dark:text-[#5C5A56] uppercase tracking-wider mb-1">Pending Amount</div>
          <div className="text-2xl font-black text-red-500">
            {ovLoading ? '...' : formatINR(overview?.pendingAmount || 0)}
          </div>
        </div>
        <div className="bg-white dark:bg-[#161513] border border-gray-100 dark:border-[#2E2C28] p-5 rounded-2xl ios-shadow">
          <div className="text-xs font-bold text-gray-400 dark:text-[#5C5A56] uppercase tracking-wider mb-1">Bills Today</div>
          <div className="text-2xl font-black text-gray-900 dark:text-white">
            {ovLoading ? '...' : overview?.billsSentToday || 0}
          </div>
        </div>
        <div className="bg-white dark:bg-[#161513] border border-gray-100 dark:border-[#2E2C28] p-5 rounded-2xl ios-shadow">
          <div className="text-xs font-bold text-gray-400 dark:text-[#5C5A56] uppercase tracking-wider mb-1">New Customers</div>
          <div className="text-2xl font-black text-blue-500">
            {ovLoading ? '...' : overview?.newCustomersThisWeek || 0}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Trends Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-[#161513] border border-gray-100 dark:border-[#2E2C28] p-6 rounded-3xl ios-shadow">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">Revenue Trends</h3>
            <p className="text-sm text-gray-400 dark:text-[#5C5A56]">Last 6 months</p>
          </div>
          
          <div className="h-[300px] w-full">
            {trLoading ? (
              <div className="w-full h-full flex items-center justify-center animate-pulse bg-gray-50 dark:bg-[#1C1C1E] rounded-xl" />
            ) : !trends || trends.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-gray-400">Not enough data</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trends} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2E2C28" opacity={0.2} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#86868B' }} dy={10} />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fill: '#86868B' }}
                    tickFormatter={(val) => `₹${val >= 1000 ? (val/1000).toFixed(1)+'k' : val}`}
                    dx={-10}
                  />
                  <Tooltip 
                    cursor={{ fill: 'transparent' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
                    formatter={(val: any) => [formatINR(val || 0), 'Revenue']}
                  />
                  <Bar dataKey="revenue" fill="#1B7A4A" radius={[6, 6, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Top Products */}
        <div className="bg-white dark:bg-[#161513] border border-gray-100 dark:border-[#2E2C28] p-6 rounded-3xl ios-shadow flex flex-col">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">Top Items</h3>
            <p className="text-sm text-gray-400 dark:text-[#5C5A56]">Highest revenue generators</p>
          </div>

          <div className="flex-1 flex flex-col justify-center">
            {tpLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="animate-pulse h-12 bg-gray-50 dark:bg-[#1C1C1E] rounded-xl" />
                ))}
              </div>
            ) : !topProducts || topProducts.length === 0 ? (
              <div className="text-center text-gray-400 py-10">Koi items nahi bike abhi tak</div>
            ) : (
              <div className="space-y-4">
                {topProducts.map((p, idx) => (
                  <div key={p.name} className="flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-50 dark:bg-[#1E1C1A] flex items-center justify-center text-xs font-bold text-gray-500 dark:text-[#9A9690] border border-gray-100 dark:border-[#2E2C28] group-hover:scale-110 transition-transform">
                        #{idx + 1}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-gray-900 dark:text-white truncate max-w-[120px]">{p.name}</div>
                        <div className="text-xs font-medium text-gray-400 dark:text-[#5C5A56]">{p.qty} sold</div>
                      </div>
                    </div>
                    <div className="text-sm font-black text-[#1B7A4A] dark:text-[#25D366]">
                      {formatINR(p.revenue)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Predictive Models Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-10">
        <MLForecastWidget data={forecastData ?? undefined} loading={forecastLoading} />
        <TopCustomersWidget data={topCustomersData ?? undefined} loading={topCustLoading} />
      </div>
    </div>
  )
}
