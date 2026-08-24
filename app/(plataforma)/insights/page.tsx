import { Cabecalho } from '@/components/layout/Cabecalho'
import { Metrica } from '@/components/ui/Metrica'
import { AbasInsights } from '@/components/crm/AbasInsights'
import { FiltroPeriodo } from '@/components/crm/FiltroPeriodo'
import { PainelInsights } from '@/components/crm/PainelInsights'
import { exigirMembro } from '@/lib/sessao'
import { obterDadosDoPainel, periodoDoMesCorrente } from '@/lib/insights'
import type { Periodo } from '@/lib/tipos-insights'
import { formatarData, formatarNumero, formatarReais } from '@/lib/formato'

export const metadata = { title: 'Insights' }

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/

/**
 * Painel de Insights: tudo que a operação produziu num período.
 *
 * Abre no mês corrente. O período vive na URL, então o painel filtrado é
 * compartilhável — e o link continua mostrando o mesmo recorte no mês que vem.
 */
export default async function PaginaInsights({
  searchParams,
}: {
  searchParams: Promise<{ inicio?: string; fim?: string }>
}) {
  await exigirMembro()
  const { inicio, fim } = await searchParams

  // Datas vindas da URL são texto de fora: sem a checagem de formato elas
  // entrariam na consulta e o Postgres devolveria erro de sintaxe em vez de
  // a tela dizer que o período está errado.
  const padrao = periodoDoMesCorrente()
  const periodo: Periodo =
    inicio && fim && DATA_ISO.test(inicio) && DATA_ISO.test(fim) && inicio <= fim
      ? { inicio, fim }
      : padrao

  const dados = await obterDadosDoPainel(periodo)

  return (
    <>
      <Cabecalho
        titulo="Insights"
        descricao={`O que a operação produziu entre ${formatarData(periodo.inicio)} e ${formatarData(periodo.fim)}.`}
      />

      <AbasInsights />
      <FiltroPeriodo />

      <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metrica
          rotulo="Negócios ganhos"
          valor={formatarNumero(dados.resumo.ganhos)}
          apoio="fechados no período"
          destaque={dados.resumo.ganhos > 0}
        />
        <Metrica
          rotulo="Valor fechado"
          valor={formatarReais(dados.resumo.valorGanho)}
          apoio="somando os ganhos com valor preenchido"
          destaque={dados.resumo.valorGanho > 0}
        />
        <Metrica
          rotulo="Ticket médio"
          valor={
            dados.resumo.ticketMedio == null
              ? '—'
              : formatarReais(dados.resumo.ticketMedio)
          }
          apoio={
            dados.resumo.ticketMedio == null
              ? 'nenhum ganho com valor no período'
              : 'média dos ganhos com valor'
          }
        />
        <Metrica
          rotulo="Ganhos entre os fechados"
          valor={
            dados.resumo.taxaGanho == null ? '—' : `${dados.resumo.taxaGanho}%`
          }
          apoio={
            dados.resumo.taxaGanho == null
              ? 'nenhum negócio fechado no período'
              : `${formatarNumero(dados.resumo.ganhos)} ganhos, ${formatarNumero(dados.resumo.perdidos)} perdidos`
          }
        />
      </section>

      <PainelInsights dados={dados} />
    </>
  )
}
