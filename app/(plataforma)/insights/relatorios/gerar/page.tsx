import { Cabecalho } from '@/components/layout/Cabecalho'
import { AbasInsights } from '@/components/crm/AbasInsights'
import { GeradorRelatorio } from '@/components/crm/GeradorRelatorio'
import { exigirMembro } from '@/lib/sessao'

export const metadata = { title: 'Insights · Gerar relatório' }

export default async function PaginaGerarRelatorio() {
  await exigirMembro()

  return (
    <>
      <Cabecalho
        titulo="Insights"
        descricao="Monte o relatório de um mês fechado — com a IA escrevendo a partir dos números, ou à mão."
      />

      <AbasInsights />

      <GeradorRelatorio />
    </>
  )
}
