'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Store, Receipt, Users, MessageCircle } from 'lucide-react'

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const tabs = [
    { name: 'General', href: '/settings', icon: Store },
    { name: 'Invoices & Quotations', href: '/settings/invoices', icon: Receipt },
    { name: 'Staff & Roles', href: '/settings/staff', icon: Users },
    // WhatsApp must be reachable on a phone too: it was previously only
    // linked from the desktop sidebar, so the product's core promise
    // (WhatsApp billing) had no path on mobile.
    { name: 'WhatsApp', href: '/settings/whatsapp', icon: MessageCircle },
  ]

  return (
    <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-8">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 shrink-0">
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-6 hidden md:block">
          Settings
        </h1>
        <nav className="flex md:flex-col gap-2 overflow-x-auto pb-4 md:pb-0 scrollbar-hide">
          {tabs.map(tab => {
            const Icon = tab.icon
            // Exact match for /settings, prefix match for others
            const isActive = tab.href === '/settings' ? pathname === '/settings' : pathname.startsWith(tab.href)
            
            return (
              <Link 
                key={tab.name}
                href={tab.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${
                  isActive 
                    ? 'bg-[#1B7A4A] text-white shadow-md' 
                    : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-[#2C2C2E] dark:text-[#98989D]'
                }`}
              >
                <Icon className="w-5 h-5" />
                {tab.name}
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0">
        <div className="md:hidden mb-6">
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Settings
          </h1>
        </div>
        {children}
      </main>
    </div>
  )
}
