'use client'

import { useState } from 'react'
import Sidebar from '@/components/dashboard/Sidebar'
import Topbar from '@/components/dashboard/Topbar'
import BottomNav from '@/components/dashboard/BottomNav'
import { TRPCProvider } from '@/components/shared/TRPCProvider'
import { ShopProvider } from '@/components/shared/ShopContext'

interface Props {
  shopId: string
  shopName: string
  shopCategory: string
  userEmail: string
  userName: string
  role: string
  children: React.ReactNode
}

export default function DashboardShell({ shopId, shopName, shopCategory, userEmail, userName, role, children }: Props) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <TRPCProvider>
      <ShopProvider shopId={shopId} shopName={shopName} shopCategory={shopCategory}>
        <div className="min-h-screen bg-gray-50 dark:bg-[#0F0E0C] flex">
        {/* Sidebar (desktop only) */}
        <Sidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed((c) => !c)}
          shopName={shopName}
          shopCategory={shopCategory}
          userName={userName}
          role={role}
        />

        {/* Main area */}
        <div className="flex-1 flex flex-col min-w-0">
          <Topbar
            shopName={shopName}
            userEmail={userEmail}
            userName={userName}
          />

          {/* Page content */}
          <main className="flex-1 p-4 lg:p-6 pb-24 lg:pb-6 overflow-y-auto">
            {children}
          </main>
        </div>

        {/* Bottom nav (mobile only) */}
        <BottomNav />
      </div>
      </ShopProvider>
    </TRPCProvider>
  )
}