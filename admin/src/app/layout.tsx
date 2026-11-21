import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'BillDost Admin',
  description: 'The BillDost control centre: shops, requests, activation, issues and broadcasts.',
}

const themeScript = `
try {
  var t = localStorage.getItem('billdost-admin-theme');
  if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
  }
} catch (e) {}
`

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="bg-[#F5F5F7] dark:bg-black text-[#1D1D1F] dark:text-[#F5F5F7] min-h-screen">
        {children}
      </body>
    </html>
  )
}
