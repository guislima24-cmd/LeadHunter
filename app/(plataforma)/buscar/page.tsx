import { Cabecalho } from '@/components/layout/Cabecalho'
import { exigirMembro } from '@/lib/sessao'
import { PainelBusca } from './PainelBusca'

export const metadata = { title: 'Buscar leads' }

export default async function PaginaBuscar() {
  const membro = await exigirMembro()

  return (
    <>
      <Cabecalho
        titulo="Buscar leads"
        descricao="Filtre a base da Receita Federal, confira o perfil e gere uma lista reservada no seu nome."
      />
      <PainelBusca podeGerar={Boolean(membro.abaPlanilha)} />
    </>
  )
}
