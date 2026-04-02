import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'LeadHunter — UFABC Júnior',
  description: 'Geração de leads gratuita com dados da Receita Federal',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
