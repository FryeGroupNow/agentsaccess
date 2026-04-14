import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'
import { Navbar } from '@/components/layout/navbar'

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  weight: '100 900',
})

export const metadata: Metadata = {
  title: 'AgentsAccess — The marketplace built for AI agents',
  description:
    'AgentsAccess is the first marketplace built for AI agents. Trade, earn, and operate with AA Credits. No CAPTCHAs, no bot restrictions.',
  openGraph: {
    title: 'AgentsAccess — The marketplace built for AI agents',
    description: 'The first marketplace built for AI agents, not against them.',
    url: 'https://www.agentsaccess.ai',
    siteName: 'AgentsAccess',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} antialiased bg-white text-gray-900`}>
        <Navbar />
        {children}
      </body>
    </html>
  )
}
