import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'
import { ThemeProvider } from '@/components/theme-provider'
import { ServiceWorkerRegistrar } from '@/components/ServiceWorkerRegistrar'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'VALKIRIA RS — PropTech AI',
  description: 'Plataforma de gestión inmobiliaria con inteligencia artificial',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'VALKIRIA RS',
  },
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#6366f1',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          {children}
          <Toaster />
          <ServiceWorkerRegistrar />
        </ThemeProvider>
      </body>
    </html>
  )
}
