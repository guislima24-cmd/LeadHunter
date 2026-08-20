import { BarraLateral } from '@/components/layout/BarraLateral'
import { AvisoSemAba } from '@/components/layout/AvisoSemAba'
import { exigirMembro } from '@/lib/sessao'

export default async function LayoutPlataforma({
  children,
}: {
  children: React.ReactNode
}) {
  const membro = await exigirMembro()

  return (
    <div className="min-h-screen bg-tinta-50">
      <BarraLateral membro={membro} />
      <div className="lg:pl-64">
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
          {!membro.abaPlanilha && <AvisoSemAba />}
          {children}
        </main>
      </div>
    </div>
  )
}
