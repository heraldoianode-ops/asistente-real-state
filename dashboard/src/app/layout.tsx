import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'
import { ThemeProvider } from '@/components/theme-provider'
import { ThemeVars } from '@/components/ThemeVars'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'PropTech AI — Asistente Real State',
  description: 'Plataforma de gestión inmobiliaria con IA',
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <ThemeVars />
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
