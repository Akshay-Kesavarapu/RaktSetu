import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'RaktSetu',
  description: 'Real-time blood inventory. Every unit counts.',
  manifest: '/manifest.json',
  icons: {
    icon: '/icon-192.png',
    apple: '/icon-192.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className="font-sans">
        {children}
      </body>
    </html>
  )
}

