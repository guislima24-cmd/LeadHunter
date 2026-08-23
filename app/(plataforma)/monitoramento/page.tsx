import { notFound } from 'next/navigation'
import { Cabecalho } from '@/components/layout/Cabecalho'
import { Card, CardCabecalho } from '@/components/ui/Card'
import { Metrica, Barra } from '@/components/ui/Metrica'
import { Badge } from '@/components/ui/Badge'
import { Tabela, Th, Td, Tr } from '@/components/ui/Tabela'
import { EstadoVazio } from '@/components/ui/Estado'
import { exigirMembro } from '@/lib/sessao'
import { obterMonitoramento, obterResumoInicio } from '@/lib/dados'
import {
  formatarNumero,
  formatarPercentual,
  formatarDataHora,
  tempoRelativo,
} from '@/lib/formato'
import {
  COTA_TAVILY_MES,
  CREDITOS_TAVILY_POR_LEAD,
  ORCAMENTO_MAPS_USD,
  PLANILHA_URL,
} from '@/lib/constantes'

export const metadata = { title: 'Monitoramento' }

export default async function PaginaMonitoramento() {
  const membro = await exigirMembro()
  if (membro.papel !== 'admin') notFound()

  const [painel, resumo] = await Promise.all([
    obterMonitoramento(),
    obterResumoInicio(membro.abaPlanilha),
  ])

  const percentualTavily = (painel.tavilyCreditosMes / COTA_TAVILY_MES) * 100
  const tomTavily =
    percentualTavily >= 90 ? 'perigo' : percentualTavily >= 70 ? 'amarelo' : 'verde'
  const leadsRestantes = Math.max(
    0,
    Math.floor((COTA_TAVILY_MES - painel.tavilyCreditosMes) / CREDITOS_TAVILY_POR_LEAD),
  )

  return (
    <>
      <Cabecalho
        titulo="Monitoramento"
        descricao="Falhas das automações e consumo dos serviços pagos, no mês corrente."
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metrica
          rotulo="Falhas no mês"
          valor={formatarNumero(painel.falhasNoMes)}
          apoio={painel.falhasNoMes === 0 ? 'Nenhuma automação quebrou' : 'Veja o detalhe abaixo'}
          destaque={painel.falhasNoMes === 0}
        />
        <Metrica
          rotulo="Créditos Tavily"
          valor={formatarNumero(painel.tavilyCreditosMes)}
          apoio={`de ${formatarNumero(COTA_TAVILY_MES)} no mês`}
        />
        <Metrica
          rotulo="Enriquecidos no mês"
          valor={formatarNumero(painel.tavilyLeadsMes)}
          apoio="consumiram cota da Tavily desde o dia 1º"
        />
        <Metrica
          rotulo="Ainda cabem"
          valor={formatarNumero(leadsRestantes)}
          apoio="leads até a cota do mês acabar"
        />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardCabecalho
            titulo="Falhas recentes"
            descricao="Registradas automaticamente sempre que um workflow quebra em produção."
          />
          {painel.falhas.length === 0 ? (
            <EstadoVazio
              titulo="Nenhuma falha registrada"
              descricao="Todas as automações rodaram sem erro desde que o tratamento central de falhas foi ligado."
            />
          ) : (
            <Tabela>
              <thead>
                <tr>
                  <Th>Workflow</Th>
                  <Th>Nó</Th>
                  <Th>Mensagem</Th>
                  <Th>Quando</Th>
                </tr>
              </thead>
              <tbody>
                {painel.falhas.map((falha) => (
                  <Tr key={falha.id}>
                    <Td className="font-semibold whitespace-nowrap text-tinta-900">
                      {falha.workflowNome ?? '—'}
                    </Td>
                    <Td className="text-xs whitespace-nowrap text-tinta-600">
                      {falha.noComErro ?? '—'}
                    </Td>
                    <Td>
                      <span className="block max-w-md truncate text-xs text-tinta-600">
                        {falha.mensagem ?? '—'}
                      </span>
                    </Td>
                    <Td className="text-xs whitespace-nowrap text-tinta-500">
                      {tempoRelativo(falha.ocorridoEm)}
                      <span className="block text-tinta-400">
                        {formatarDataHora(falha.ocorridoEm)}
                      </span>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Tabela>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardCabecalho
              titulo="Enriquecimento com IA"
              descricao="Acumulado em toda a base de leads da Receita Federal — não só o mês."
            />
            <div className="space-y-3 p-5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-tinta-600">Concluídos</span>
                <Badge tom="verde">{formatarNumero(resumo.enriquecidos)}</Badge>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-tinta-600">Aguardando cota</span>
                <Badge
                  tom={resumo.pendentesEnriquecimento > 0 ? 'amarelo' : 'neutro'}
                >
                  {formatarNumero(resumo.pendentesEnriquecimento)}
                </Badge>
              </div>
              <p className="border-t border-tinta-100 pt-3 text-xs leading-relaxed text-tinta-500">
                Leads marcados como <em>aguardando cota</em> voltam a ser
                enriquecidos assim que o limite mensal da Tavily renovar.
              </p>
            </div>
          </Card>

          <Card>
            <CardCabecalho
              titulo="Cota da Tavily"
              descricao="Pesquisa na web do enriquecimento."
            />
            <div className="space-y-3 p-5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="numerico font-titulo text-2xl font-extrabold text-tinta-900">
                  {formatarPercentual(percentualTavily)}
                </span>
                <Badge tom={tomTavily}>
                  {tomTavily === 'perigo'
                    ? 'No limite'
                    : tomTavily === 'amarelo'
                      ? 'Atenção'
                      : 'Folgado'}
                </Badge>
              </div>
              <Barra percentual={percentualTavily} tom={tomTavily} />
              <p className="text-xs leading-relaxed text-tinta-500">
                O enriquecimento trava sozinho antes de estourar a cota: leads
                que não couberem ficam como <em>aguardando cota</em> e voltam a
                ser processados quando o mês virar.
              </p>
            </div>
          </Card>

          {painel.falhasPorWorkflow.length > 0 && (
            <Card>
              <CardCabecalho titulo="Falhas por workflow" />
              <div className="divide-y divide-tinta-100">
                {painel.falhasPorWorkflow.map((linha) => (
                  <div
                    key={linha.workflow}
                    className="flex items-center justify-between gap-3 px-5 py-3"
                  >
                    <span className="min-w-0 truncate text-sm text-tinta-700">
                      {linha.workflow}
                    </span>
                    <Badge tom="perigo">{formatarNumero(linha.total)}</Badge>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card>
            <CardCabecalho titulo="Google Maps" descricao="Serviço pago por chamada." />
            <div className="space-y-3 p-5 text-sm leading-relaxed text-tinta-600">
              <p>
                O teto de US$ {ORCAMENTO_MAPS_USD} por mês é conferido pelo
                próprio workflow antes de cada cidade.
              </p>
              <p className="text-xs text-tinta-500">
                O extrato fica na aba <em>Maps Usage</em> da planilha — é lá que
                o gasto é somado, não neste banco.
              </p>
              <a
                href={PLANILHA_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-sm font-semibold text-verde-700 hover:underline"
              >
                Ver o extrato →
              </a>
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}
