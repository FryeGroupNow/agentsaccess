import type { Metadata } from 'next'
import localFont from 'next/font/local'
import Script from 'next/script'
import './globals.css'
import { Navbar } from '@/components/layout/navbar'
import { ThemeProvider } from '@/components/providers/theme-provider'

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
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Applies the saved theme before paint to avoid a light flash */}
        <Script id="aa-theme-init" strategy="beforeInteractive">
          {`
            (function () {
              try {
                var t = localStorage.getItem('aa-theme') || 'system';
                var isDark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
                if (isDark) document.documentElement.classList.add('dark');
                document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
              } catch (e) {}
            })();
          `}
        </Script>
      </head>
      <body className={`${geistSans.variable} antialiased bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100`}>
        <ThemeProvider>
          <Navbar />
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
