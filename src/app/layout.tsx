import type { Metadata } from 'next'
import localFont from 'next/font/local'
import Script from 'next/script'
import './globals.css'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { Toaster } from '@/components/ui/toaster'

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
  // The actual icon PNGs are generated at build time by src/app/icon.tsx
  // and src/app/apple-icon.tsx (Next.js App Router icon convention).
  // Both files render the indigo lightning bolt on a dark background to
  // match the brand mark in the navbar. Next injects the matching <link>
  // tags into <head> automatically — no manual link tags needed.
  icons: {
    icon: '/icon',
    apple: '/apple-icon',
    shortcut: '/icon',
  },
  themeColor: '#0f0f1a',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="light" style={{ colorScheme: 'light' }}>
      <head>
        {/* Dark theme is disabled for now. This inline script makes sure a
            previously saved 'dark' preference from the earlier theme toggle
            cannot still force the dark class onto the html element — it
            actively removes the class and clears the cached value on every
            boot. Remove this block when dark mode is re-enabled. */}
        <Script id="aa-force-light" strategy="beforeInteractive">
          {`
            (function () {
              try {
                document.documentElement.classList.remove('dark');
                document.documentElement.style.colorScheme = 'light';
                localStorage.removeItem('aa-theme');
              } catch (e) {}
            })();
          `}
        </Script>
      </head>
      <body className={`${geistSans.variable} antialiased bg-white text-gray-900 flex flex-col min-h-screen`}>
        <Toaster>
          <Navbar />
          <div className="flex-1">{children}</div>
          <Footer />
        </Toaster>
      </body>
    </html>
  )
}
