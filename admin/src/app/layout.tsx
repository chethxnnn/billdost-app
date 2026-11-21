import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'BillDost Admin',
  description: 'The BillDost control centre: shops, requests, activation, issues and broadcasts.',
}

/*
  Theme is a manual choice, never automatic (founder decision,
  Nov 22): light is the default, dark applies only when this admin
  picked it. The pick is stored per admin user (admin_users.ui_theme)
  and mirrored to localStorage so it applies before first paint.
*/
const themeScript = `
try {
  var t = localStorage.getItem('billdost-admin-theme');
  if (t === 'dark') {
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
