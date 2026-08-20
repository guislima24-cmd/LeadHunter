import { Cabecalho } from '@/components/layout/Cabecalho'
import { Card, CardCabecalho } from '@/components/ui/Card'
import { Barra } from '@/components/ui/Metrica'
import { Badge } from '@/components/ui/Badge'
import { Tabela, Th, Td, Tr } from '@/components/ui/Tabela'
import { EstadoVazio } from '@/components/ui/Estado'
import { exigirMembro } from '@/lib/sessao'
import { obterFunilDoMembro, obterMetricasW7 } from '@/lib/dados'
import {
  formatarNumero,
  formatarPercentual,
  formatarDataHora,
} from '@/lib/formato'

export const metadata = { title: 'Pipeline' }

export default async function PaginaPipeline() {
  const membro = await exigirMembro()
  const [funil, w7] = await Promise.all([
    obterFunilDoMembro(membro.abaPlanilha),
    obterMetricasW7(),
  ])

  const topo = funil[0]?.quantidade ?? 0

  return (
    <>
      <Cabecalho
        titulo="Pipeline"
        descricao="Onde seus leads estão hoje e quanto cada etapa converte."
      />

      <Card>
        <CardCabecalho
          titulo="Seu funil de prospecção"
          descricao="Calculado ao vivo a partir do que a plataforma movimentou."
        />

        {funil.length === 0 || topo === 0 ? (
          <EstadoVazio
            titulo="Sem movimento ainda"
            descricao="Assim que você gerar a primeira lista, o funil começa a se preencher aqui."
          />
        ) : (
          <div className="divide-y divide-tinta-100">
            {funil.map((etapa, indice) => {
              const percentualDoTopo = topo > 0 ? (etapa.quantidade / topo) * 100 : 0
              const anterior = indice > 0 ? funil[indice - 1] : null
              const conversao =
                anterior && anterior.quantidade > 0
                  ? (etapa.quantidade / anterior.quantidade) * 100
                  : null

              return (
                <div key={etapa.chave} className="px-5 py-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-tinta-900">
                        {etapa.rotulo}
                      </p>
                      <p className="mt-0.5 text-xs text-tinta-500">
                        {etapa.descricao}
                      </p>
                    </div>
                    <div className="flex items-baseline gap-3">
                      {conversao != null && (
                        <Badge tom={conversao >= 50 ? 'verde' : 'neutro'}>
                          {formatarPercentual(conversao)} da etapa anterior
                        </Badge>
                      )}
                      <span className="numerico font-titulo text-xl font-extrabold text-tinta-900">
                        {formatarNumero(etapa.quantidade)}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3">
                    <Barra
                      percentual={percentualDoTopo}
                      tom={indice === 0 ? 'verde' : percentualDoTopo < 20 ? 'amarelo' : 'verde'}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <Card className="mt-6">
        <CardCabecalho
          titulo="Funil comercial do time"
          descricao={
            w7.calculadoEm
              ? `Calculado pela IA em ${formatarDataHora(w7.calculadoEm)}.`
              : 'Análise diária a partir do funil de KPI da planilha.'
          }
          acao={w7.calculadoEm ? <Badge tom="verde">Atualizado</Badge> : undefined}
        />

        {w7.metricas.length === 0 ? (
          <EstadoVazio
            titulo="Ainda sem dados do time"
            descricao="Este quadro é preenchido pela análise diária de funil, que roda às 8h e cruza a planilha com o Notion. Ele aparece aqui depois do primeiro ciclo com o Notion conectado."
          />
        ) : (
          <>
            <Tabela>
              <thead>
                <tr>
                  <Th>Etapa</Th>
                  <Th className="text-right">Leads na etapa</Th>
                  <Th className="text-right">Conversão</Th>
                  <Th className="text-right">Tempo médio</Th>
                </tr>
              </thead>
              <tbody>
                {w7.metricas.map((m) => (
                  <Tr key={m.etapa}>
                    <Td className="font-semibold text-tinta-900">{m.etapa}</Td>
                    <Td className="numerico text-right">
                      {formatarNumero(m.quantidadeAtual)}
                    </Td>
                    <Td className="numerico text-right text-tinta-600">
                      {m.taxaConversao == null
                        ? '—'
                        : formatarPercentual(m.taxaConversao)}
                    </Td>
                    <Td className="numerico text-right text-tinta-600">
                      {m.tempoMedioDias == null
                        ? '—'
                        : `${formatarNumero(Math.round(m.tempoMedioDias))} dias`}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Tabela>

            {w7.metricas.some((m) => m.observacoesIa) && (
              <div className="border-t border-tinta-200 px-5 py-4">
                <p className="mb-2 text-[0.7rem] font-semibold tracking-wide text-tinta-500 uppercase">
                  Leitura da IA
                </p>
                <ul className="space-y-2">
                  {w7.metricas
                    .filter((m) => m.observacoesIa)
                    .map((m) => (
                      <li key={m.etapa} className="flex gap-2.5 text-sm">
                        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-amarelo-400" />
                        <span className="leading-relaxed text-tinta-600">
                          <strong className="font-semibold text-tinta-800">
                            {m.etapa}:
                          </strong>{' '}
                          {m.observacoesIa}
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </>
        )}
      </Card>
    </>
  )
}
