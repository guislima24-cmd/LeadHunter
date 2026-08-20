import type { Metadata } from 'next'
import { Plus_Jakarta_Sans, Inter } from 'next/font/google'
import './globals.css'

const fonteTitulo = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--fonte-titulo',
  display: 'swap',
})

const fonteCorpo = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--fonte-corpo',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Núcleo Comercial — UFABC Júnior',
    template: '%s · Núcleo Comercial',
  },
  description:
    'Plataforma comercial da UFABC Júnior: prospecção, enriquecimento com IA, pipeline e monitoramento em um só lugar.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${fonteTitulo.variable} ${fonteCorpo.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  )
}
