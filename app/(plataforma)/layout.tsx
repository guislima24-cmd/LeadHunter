import { cookies } from 'next/headers'
import { CascaPlataforma } from '@/components/layout/CascaPlataforma'
import { AvisoSemAba } from '@/components/layout/AvisoSemAba'
import { exigirMembro } from '@/lib/sessao'
import { COOKIE_BARRA } from '@/lib/barra'

export default async function LayoutPlataforma({
  children,
}: {
  children: React.ReactNode
}) {
  const [membro, biscoitos] = await Promise.all([exigirMembro(), cookies()])

  return (
    <CascaPlataforma
      membro={membro}
      recolhidaInicial={biscoitos.get(COOKIE_BARRA)?.value === 'recolhida'}
    >
      {!membro.abaPlanilha && <AvisoSemAba />}
      {children}
    </CascaPlataforma>
  )
}
