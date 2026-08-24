'use client'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardCabecalho } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { COR, EIXO } from '@/lib/cores-grafico'
import {
  formatarMesAno,
  formatarNumero,
  formatarReais,
  formatarReaisCompacto,
} from '@/lib/formato'
import type { DadosDoPainel } from '@/lib/tipos-insights'
import { BarrasDeMeta } from '@/components/crm/BarrasDeMeta'

/**
 * O painel de Insights.
 *
 * Paleta em `lib/cores-grafico.ts` — validada uma vez para todos os painéis.
 * `isAnimationActive={false}` em toda série: a animação de entrada do Recharts
 * deixa o gráfico em branco no primeiro quadro, o que atrapalha impressão e
 * captura, e num painel que se abre para conferir número não acrescenta nada.
 */

function Dica({
  ativo,
  rotulo,
  itens,
}: {
  ativo?: boolean
  rotulo?: string
  itens: Array<{ nome: string; valor: string; cor?: string }>
}) {
  if (!ativo) return null
  return (
    <div className="rounded-lg border border-tinta-200 bg-white px-3 py-2 shadow-flutuante">
      {rotulo && (
        <p className="mb-1 text-xs font-semibold text-tinta-900">{rotulo}</p>
      )}
      {itens.map((item) => (
        <p key={item.nome} className="flex items-center gap-1.5 text-xs text-tinta-600">
          {item.cor && (
            <span
              aria-hidden="true"
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: item.cor }}
            />
          )}
          {item.nome}:{' '}
          <span className="numerico font-semibold text-tinta-900">{item.valor}</span>
        </p>
      ))}
    </div>
  )
}

export function PainelInsights({ dados }: { dados: DadosDoPainel }) {
  const {
    funilProspeccao,
    conversaoPorEtapa,
    valorPorEtapa,
    fechadosPorMes,
    rankingProspeccao,
    motivosDePerda,
    metas,
  } = dados

  const temProspeccao = funilProspeccao.some((e) => e.quantidade > 0)
  const temFechados = fechadosPorMes.some((m) => m.ganhos + m.perdidos > 0)

  return (
    <div className="space-y-6">
      {/* ---------- Funil de prospecção ---------- */}
      <Card>
        <CardCabecalho
          titulo="Funil de prospecção"
          descricao="Do primeiro email ao contrato. Este funil é separado do funil de negócios: aceite e resposta acontecem enquanto o lead ainda é lead, antes de existir negócio."
        />
        {!temProspeccao ? (
          <p className="px-5 py-10 text-center text-sm text-tinta-500">
            Nenhum movimento de prospecção no período escolhido.
          </p>
        ) : (
          <div className="p-5">
            <ol className="space-y-2.5">
              {funilProspeccao.map((etapa) => {
                const maior = Math.max(
                  1,
                  ...funilProspeccao.map((e) => e.quantidade),
                )
                const largura =
                  etapa.quantidade === 0
                    ? 0
                    : Math.max(4, (etapa.quantidade / maior) * 100)
                return (
                  <li key={etapa.chave} className="flex items-center gap-4">
                    <span className="w-40 shrink-0 text-right text-sm font-semibold text-tinta-800">
                      {etapa.rotulo}
                    </span>
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      <span
                        className="h-7 rounded-md"
                        style={{
                          width: `${largura}%`,
                          backgroundColor: COR.serie,
                        }}
                      />
                      <span className="numerico shrink-0 text-sm font-bold text-tinta-900">
                        {formatarNumero(etapa.quantidade)}
                      </span>
                      {etapa.conversao != null && (
                        <span className="numerico shrink-0 text-xs text-tinta-400">
                          {etapa.conversao}% da anterior
                        </span>
                      )}
                      {etapa.fonte === 'manual' && (
                        <Badge tom="contorno">registro manual</Badge>
                      )}
                    </span>
                  </li>
                )
              })}
            </ol>
            <p className="mt-4 border-t border-tinta-100 pt-3 text-xs leading-relaxed text-tinta-500">
              <strong>Aceite</strong> e <strong>Respostas</strong> dependem de
              alguém marcar à mão na tela do lead — nenhuma automação lê a caixa
              de entrada hoje. Se esses dois números parecerem baixos demais
              perto de Prospecção, é provável que o registro é que esteja
              faltando, não a resposta do cliente.
            </p>
          </div>
        )}
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* ---------- Ganhos x perdidos por mês ---------- */}
        <Card>
          <CardCabecalho
            titulo="Ganhos e perdidos por mês"
            descricao="Últimos doze meses, para a janela filtrada não esconder a tendência."
          />
          {!temFechados ? (
            <p className="px-5 py-10 text-center text-sm text-tinta-500">
              Nenhum negócio fechado ainda.
            </p>
          ) : (
            <div className="h-64 p-5 pl-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={fechadosPorMes} barGap={2}>
                  <CartesianGrid stroke={COR.grade} vertical={false} />
                  <XAxis
                    dataKey="mes"
                    tickFormatter={(m: string) => m.slice(5) + '/' + m.slice(2, 4)}
                    {...EIXO}
                  />
                  <YAxis allowDecimals={false} width={36} {...EIXO} />
                  <Tooltip
                    cursor={{ fill: COR.grade }}
                    content={({ active, label, payload }) => (
                      <Dica
                        ativo={active}
                        rotulo={formatarMesAno(`${String(label)}-01`)}
                        itens={(payload ?? []).map((p) => ({
                          nome: p.name === 'ganhos' ? 'Ganhos' : 'Perdidos',
                          valor: formatarNumero(Number(p.value)),
                          cor: p.color,
                        }))}
                      />
                    )}
                  />
                  <Legend
                    formatter={(v) => (v === 'ganhos' ? 'Ganhos' : 'Perdidos')}
                    wrapperStyle={{ fontSize: 12 }}
                  />
                  <Bar
                    dataKey="ganhos"
                    fill={COR.ganho}
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey="perdidos"
                    fill={COR.perdido}
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* ---------- Valor em aberto por etapa ---------- */}
        <Card>
          <CardCabecalho
            titulo="Valor em aberto por etapa"
            descricao="Quanto está em jogo em cada etapa do funil, agora."
          />
          {valorPorEtapa.every((e) => e.valor === 0) ? (
            <p className="px-5 py-10 text-center text-sm text-tinta-500">
              Nenhum negócio aberto com valor preenchido.
            </p>
          ) : (
            <div className="h-64 p-5">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={valorPorEtapa}
                  layout="vertical"
                  margin={{ left: 4, right: 56 }}
                >
                  <CartesianGrid stroke={COR.grade} horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="etapaNome"
                    width={120}
                    {...EIXO}
                  />
                  <Tooltip
                    cursor={{ fill: COR.grade }}
                    content={({ active, label, payload }) => (
                      <Dica
                        ativo={active}
                        rotulo={String(label)}
                        itens={[
                          {
                            nome: 'Valor',
                            valor: formatarReais(Number(payload?.[0]?.value ?? 0)),
                          },
                          {
                            nome: 'Negócios',
                            valor: formatarNumero(
                              Number(payload?.[0]?.payload?.quantidade ?? 0),
                            ),
                          },
                        ]}
                      />
                    )}
                  />
                  <Bar
                    dataKey="valor"
                    fill={COR.serie}
                    radius={[0, 4, 4, 0]}
                    isAnimationActive={false}
                    label={{
                      position: 'right',
                      fill: '#57605a',
                      fontSize: 11,
                      // O Recharts tipa o rótulo como `RenderableText`
                      // (string | number | null | undefined), não number.
                      formatter: (v: unknown) => {
                        const n = Number(v)
                        return Number.isFinite(n) ? formatarReaisCompacto(n) : ''
                      },
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* ---------- Conversão e tempo por etapa ---------- */}
        <Card>
          <CardCabecalho
            titulo="Passagem entre etapas"
            descricao="De tudo que já passou por cada etapa, quanto avançou para a seguinte — histórico acumulado, não só do período."
          />
          {conversaoPorEtapa.every((c) => c.passou === 0) ? (
            <p className="px-5 py-10 text-center text-sm text-tinta-500">
              Ainda não há histórico de passagem de etapa.
            </p>
          ) : (
            <div className="divide-y divide-tinta-100">
              {conversaoPorEtapa.map((c) => (
                <div key={c.etapaNome} className="px-5 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-sm font-semibold text-tinta-800">
                      {c.etapaNome}
                    </span>
                    <span className="numerico shrink-0 text-sm font-bold text-tinta-900">
                      {c.percentual == null ? '—' : `${c.percentual}%`}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-tinta-100">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${c.percentual ?? 0}%`,
                        backgroundColor: COR.serie,
                      }}
                    />
                  </div>
                  <p className="numerico mt-1 text-xs text-tinta-500">
                    {formatarNumero(c.avancou)} de {formatarNumero(c.passou)}{' '}
                    avançaram
                    {c.tempoMedioDias != null && (
                      <>
                        {' '}
                        · {formatarNumero(c.tempoMedioDias)}{' '}
                        {c.tempoMedioDias === 1 ? 'dia' : 'dias'} em média aqui
                      </>
                    )}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* ---------- Ranking de prospecção ---------- */}
        <Card>
          <CardCabecalho
            titulo="Prospecção por membro"
            descricao="Emails de prospecção enviados no período."
          />
          {rankingProspeccao.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-tinta-500">
              Nenhum email de prospecção no período.
            </p>
          ) : (
            <div
              className="p-5"
              style={{ height: Math.max(160, rankingProspeccao.length * 40 + 40) }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={rankingProspeccao}
                  layout="vertical"
                  margin={{ left: 4, right: 40 }}
                >
                  <CartesianGrid stroke={COR.grade} horizontal={false} />
                  <XAxis type="number" hide allowDecimals={false} />
                  <YAxis type="category" dataKey="membro" width={140} {...EIXO} />
                  <Tooltip
                    cursor={{ fill: COR.grade }}
                    content={({ active, label, payload }) => (
                      <Dica
                        ativo={active}
                        rotulo={String(label)}
                        itens={[
                          {
                            nome: 'Emails',
                            valor: formatarNumero(Number(payload?.[0]?.value ?? 0)),
                          },
                        ]}
                      />
                    )}
                  />
                  <Bar
                    dataKey="prospeccoes"
                    fill={COR.serie}
                    radius={[0, 4, 4, 0]}
                    isAnimationActive={false}
                    label={{
                      position: 'right',
                      fill: '#57605a',
                      fontSize: 11,
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      {/* ---------- Motivos de perda ---------- */}
      {motivosDePerda.length > 0 && (
        <Card>
          <CardCabecalho
            titulo="Por que os negócios foram perdidos"
            descricao="Motivos registrados no fechamento, dentro do período escolhido."
          />
          <div
            className="p-5"
            style={{ height: Math.max(160, motivosDePerda.length * 40 + 40) }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={motivosDePerda}
                layout="vertical"
                margin={{ left: 4, right: 40 }}
              >
                <CartesianGrid stroke={COR.grade} horizontal={false} />
                <XAxis type="number" hide allowDecimals={false} />
                <YAxis type="category" dataKey="motivo" width={180} {...EIXO} />
                <Tooltip
                  cursor={{ fill: COR.grade }}
                  content={({ active, label, payload }) => (
                    <Dica
                      ativo={active}
                      rotulo={String(label)}
                      itens={[
                        {
                          nome: 'Negócios',
                          valor: formatarNumero(Number(payload?.[0]?.value ?? 0)),
                        },
                      ]}
                    />
                  )}
                />
                <Bar
                  dataKey="quantidade"
                  radius={[0, 4, 4, 0]}
                  isAnimationActive={false}
                  label={{ position: 'right', fill: '#57605a', fontSize: 11 }}
                >
                  {motivosDePerda.map((m) => (
                    // "Momento errado" não é uma perda como as outras — é um
                    // adiamento com data marcada. Pintar igual às demais
                    // faria a barra de retomadas parecer fracasso.
                    <Cell
                      key={m.motivo}
                      fill={
                        m.motivo === 'Momento errado' ? COR.origem[1] : COR.perdido
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-tinta-500">
              <span className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="size-2 rounded-full"
                  style={{ backgroundColor: COR.perdido }}
                />
                Perda definitiva
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="size-2 rounded-full"
                  style={{ backgroundColor: COR.origem[1] }}
                />
                Momento errado — adiado, com retomada agendada
              </span>
            </p>
          </div>
        </Card>
      )}

      {/* ---------- Metas ---------- */}
      <Card>
        <CardCabecalho
          titulo="Metas do período"
          descricao="Metas cujo período se sobrepõe ao filtro escolhido."
        />
        <BarrasDeMeta metas={metas} />
      </Card>
    </div>
  )
}
