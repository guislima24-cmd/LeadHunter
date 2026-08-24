import { Cabecalho } from '@/components/layout/Cabecalho'
import { AbasInsights } from '@/components/crm/AbasInsights'
import { GerenciadorMetas } from '@/components/crm/GerenciadorMetas'
import { exigirMembro } from '@/lib/sessao'
import { listarMetasComProgresso } from '@/lib/insights'

export const metadata = { title: 'Insights · Metas' }

/**
 * Metas e OKRs do comercial.
 *
 * Todo mundo vê; só admin cria e edita — é configuração de quanto a empresa
 * se cobra, não anotação pessoal. A restrição real está na rota da API; aqui
 * ela só decide se os botões aparecem.
 */
export default async function PaginaMetas() {
  const membro = await exigirMembro()
  const metas = await listarMetasComProgresso({ incluirInativas: true })

  return (
    <>
      <Cabecalho
        titulo="Insights"
        descricao="As metas do período e onde cada uma está. O progresso das que se ligam a uma fonte do CRM é calculado sozinho."
      />

      <AbasInsights />

      <GerenciadorMetas metas={metas} podeEditar={membro.papel === 'admin'} />
    </>
  )
}
