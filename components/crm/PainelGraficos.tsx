'use client'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardCabecalho } from '@/components/ui/Card'
import { COR, EIXO } from '@/lib/cores-grafico'
import {
  formatarNumero,
  formatarPercentual,
  formatarReais,
  formatarReaisCompacto,
} from '@/lib/formato'
import type { EtapaAlcancada, MesFechado, FatiaOrigem } from '@/lib/crm'
import type { EtapaFunil as EtapaFunilLeads } from '@/lib/dados'

/**
 * Gráficos do funil.
 *
 * A paleta vive em `lib/cores-grafico.ts` — validada uma vez, usada por todos
 * os painéis. Ver lá por que ela não usa as cores da interface.
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
        <p className="mb-1 text-xs font-bold text-tinta-900">{rotulo}</p>
      )}
      {itens.map((i) => (
        <p key={i.nome} className="flex items-center gap-1.5 text-xs text-tinta-600">
          {i.cor && (
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={{ background: i.cor }}
            />
          )}
          {i.nome}
          <strong className="numerico ml-auto pl-3 font-semibold text-tinta-900">
            {i.valor}
          </strong>
        </p>
      ))}
    </div>
  )
}

/**
 * Rótulo direto no fim da barra — o número é a mensagem, não decoração.
 *
 * O Recharts entrega as coordenadas como `string | number` (SVG aceita
 * ambos), então elas são convertidas antes de entrar na conta.
 */
function RotuloBarra({
  x,
  y,
  width,
  height,
  value,
  formatar,
}: {
  x?: string | number
  y?: string | number
  width?: string | number
  height?: string | number
  // O tipo do Recharts para `value` admite null e nós de React; só interessa
  // o caso numérico, e o resto sai pelo guarda abaixo.
  value?: unknown
  formatar: (v: number) => string
}) {
  const px = Number(x)
  const py = Number(y)
  const largura = Number(width)
  const altura = Number(height)
  const numero = typeof value === 'number' ? value : NaN
  if ([px, py, largura, altura, numero].some(Number.isNaN)) return null

  return (
    <text
      x={px + largura + 8}
      y={py + altura / 2}
      dominantBaseline="middle"
      className="numerico"
      fill="#4d544f"
      fontSize={11}
      fontWeight={600}
    >
      {formatar(numero)}
    </text>
  )
}

export function PainelGraficos({
  etapasAlcancadas,
  valorPorEtapa,
  fechadosPorMes,
  origens,
  funilLeads,
}: {
  etapasAlcancadas: EtapaAlcancada[]
  valorPorEtapa: Array<{ etapa: string; valor: number }>
  fechadosPorMes: MesFechado[]
  origens: FatiaOrigem[]
  funilLeads: EtapaFunilLeads[]
}) {
  const temValor = valorPorEtapa.some((v) => v.valor > 0)
  const temFechados = fechadosPorMes.some((m) => m.ganhos > 0 || m.perdidos > 0)
  const totalOrigens = origens.reduce((s, o) => s + o.quantidade, 0)

  // "Reservados agora" é uma foto do momento, não uma etapa por onde o lead
  // passa: deixá-lo no gráfico faria o funil subir no meio do caminho.
  const etapasProspeccao = funilLeads.filter((e) => e.chave !== 'reservados')
  const temProspeccao = etapasProspeccao.some((e) => e.quantidade > 0)

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="lg:col-span-2">
        <CardCabecalho
          titulo="Funil de conversão"
          descricao="Quantos negócios já chegaram a cada etapa, e quanto sobreviveu da anterior. Conta pelo histórico, então um negócio hoje em Contrato aparece em todas as etapas por onde passou."
        />
        <div className="p-5 pr-8">
          <ResponsiveContainer width="100%" height={Math.max(200, etapasAlcancadas.length * 44)}>
            <BarChart
              data={etapasAlcancadas}
              layout="vertical"
              margin={{ top: 0, right: 56, bottom: 0, left: 0 }}
            >
              <CartesianGrid horizontal={false} stroke={COR.grade} />
              <XAxis type="number" allowDecimals={false} {...EIXO} />
              <YAxis
                type="category"
                dataKey="etapa"
                width={140}
                {...EIXO}
                tick={{ ...EIXO.tick, fontSize: 12 }}
              />
              <Tooltip
                cursor={{ fill: 'rgba(15,124,98,0.06)' }}
                content={({ active, payload, label }) => (
                  <Dica
                    ativo={active}
                    rotulo={String(label ?? '')}
                    itens={[
                      {
                        nome: 'Chegaram aqui',
                        valor: formatarNumero(Number(payload?.[0]?.value ?? 0)),
                        cor: COR.serie,
                      },
                      ...(payload?.[0]?.payload?.conversao != null
                        ? [
                            {
                              nome: 'Da etapa anterior',
                              valor: formatarPercentual(payload[0].payload.conversao),
                            },
                          ]
                        : []),
                    ]}
                  />
                )}
              />
              <Bar
                isAnimationActive={false}
                dataKey="quantidade"
                fill={COR.serie}
                radius={[0, 4, 4, 0]}
                barSize={18}
                label={(props) => (
                  <RotuloBarra
                    {...props}
                    formatar={(v) => {
                      const linha = etapasAlcancadas[props.index as number]
                      return linha?.conversao == null
                        ? formatarNumero(v)
                        : `${formatarNumero(v)}  ·  ${formatarPercentual(linha.conversao)}`
                    }}
                  />
                )}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <CardCabecalho
          titulo="Valor em aberto por etapa"
          descricao="Só negócios abertos e com valor preenchido."
        />
        {temValor ? (
          // Horizontal como o funil acima: "Negociação iniciada" não cabe sob
          // uma barra vertical sem se atropelar com as etapas vizinhas.
          <div className="p-5 pr-8">
            <ResponsiveContainer width="100%" height={Math.max(200, valorPorEtapa.length * 40)}>
              <BarChart
                data={valorPorEtapa}
                layout="vertical"
                margin={{ top: 0, right: 76, bottom: 0, left: 0 }}
              >
                <CartesianGrid horizontal={false} stroke={COR.grade} />
                <XAxis
                  type="number"
                  tickFormatter={formatarReaisCompacto}
                  {...EIXO}
                  tick={{ ...EIXO.tick, fontSize: 10 }}
                />
                <YAxis
                  type="category"
                  dataKey="etapa"
                  width={132}
                  {...EIXO}
                  tick={{ ...EIXO.tick, fontSize: 12 }}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(15,124,98,0.06)' }}
                  content={({ active, payload, label }) => (
                    <Dica
                      ativo={active}
                      rotulo={String(label ?? '')}
                      itens={[
                        {
                          nome: 'Em aberto',
                          valor: formatarReais(Number(payload?.[0]?.value ?? 0)),
                          cor: COR.serie,
                        },
                      ]}
                    />
                  )}
                />
                <Bar
                  isAnimationActive={false}
                  dataKey="valor"
                  fill={COR.serie}
                  radius={[0, 4, 4, 0]}
                  barSize={18}
                  label={(props) => (
                    <RotuloBarra {...props} formatar={formatarReaisCompacto} />
                  )}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <Vazio texto="Nenhum negócio aberto tem valor preenchido ainda." />
        )}
      </Card>

      <Card>
        <CardCabecalho
          titulo="Ganhos e perdidos"
          descricao="Negócios fechados nos últimos seis meses."
        />
        {temFechados ? (
          <div className="p-5">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={fechadosPorMes} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                <CartesianGrid vertical={false} stroke={COR.grade} />
                <XAxis dataKey="mes" {...EIXO} />
                <YAxis allowDecimals={false} width={32} {...EIXO} />
                <Tooltip
                  cursor={{ fill: 'rgba(15,124,98,0.06)' }}
                  content={({ active, payload, label }) => (
                    <Dica
                      ativo={active}
                      rotulo={String(label ?? '')}
                      itens={[
                        { nome: 'Ganhos', valor: formatarNumero(Number(payload?.[0]?.value ?? 0)), cor: COR.ganho },
                        { nome: 'Perdidos', valor: formatarNumero(Number(payload?.[1]?.value ?? 0)), cor: COR.perdido },
                      ]}
                    />
                  )}
                />
                <Legend
                  verticalAlign="top"
                  align="left"
                  height={28}
                  iconType="circle"
                  iconSize={8}
                  formatter={(v) => (
                    <span className="text-xs text-tinta-600">{v}</span>
                  )}
                />
                <Bar isAnimationActive={false} dataKey="ganhos" name="Ganhos" fill={COR.ganho} radius={[4, 4, 0, 0]} maxBarSize={22} />
                <Bar isAnimationActive={false} dataKey="perdidos" name="Perdidos" fill={COR.perdido} radius={[4, 4, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>

            {/* Barras agrupadas em seis meses não comportam rótulo direto sem
                virar sopa de número; a tabela é o caminho para quem precisa do
                valor exato ou usa leitor de tela. */}
            <details className="mt-3 border-t border-tinta-100 pt-3">
              <summary className="cursor-pointer text-xs font-semibold text-tinta-500 hover:text-tinta-800">
                Ver como tabela
              </summary>
              <table className="mt-2 w-full text-xs">
                <thead>
                  <tr className="text-left text-tinta-500">
                    <th className="py-1 font-semibold">Mês</th>
                    <th className="py-1 text-right font-semibold">Ganhos</th>
                    <th className="py-1 text-right font-semibold">Perdidos</th>
                  </tr>
                </thead>
                <tbody className="numerico">
                  {fechadosPorMes.map((m) => (
                    <tr key={m.mes} className="border-t border-tinta-100 text-tinta-700">
                      <td className="py-1">{m.mes}</td>
                      <td className="py-1 text-right">{formatarNumero(m.ganhos)}</td>
                      <td className="py-1 text-right">{formatarNumero(m.perdidos)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </div>
        ) : (
          <Vazio texto="Nenhum negócio foi fechado nos últimos seis meses." />
        )}
      </Card>

      <Card>
        <CardCabecalho
          titulo="De onde vieram os negócios"
          descricao="Google Maps não entra: o resultado da prospecção local fica só na planilha, não neste banco."
        />
        {totalOrigens > 0 ? (
          <div className="flex flex-wrap items-center gap-4 p-5">
            <ResponsiveContainer width="100%" height={200} className="max-w-[220px]">
              <PieChart>
                <Pie
                  isAnimationActive={false}
                  data={origens}
                  dataKey="quantidade"
                  nameKey="origem"
                  innerRadius={52}
                  outerRadius={82}
                  paddingAngle={2}
                  stroke="#ffffff"
                  strokeWidth={2}
                >
                  {origens.map((o, i) => (
                    <Cell key={o.origem} fill={COR.origem[i % COR.origem.length]} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => (
                    <Dica
                      ativo={active}
                      itens={[
                        {
                          nome: String(payload?.[0]?.name ?? ''),
                          valor: `${formatarNumero(Number(payload?.[0]?.value ?? 0))} de ${formatarNumero(totalOrigens)}`,
                          cor: payload?.[0]?.payload?.fill,
                        },
                      ]}
                    />
                  )}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Legenda escrita à mão em vez da do Recharts: aqui ela carrega o
                número, que é o que dispensa ler a fatia pela cor. */}
            <ul className="min-w-40 flex-1 space-y-2">
              {origens.map((o, i) => (
                <li key={o.origem} className="flex items-baseline gap-2 text-xs">
                  <span
                    aria-hidden
                    className="mt-1 size-2.5 shrink-0 rounded-full"
                    style={{ background: COR.origem[i % COR.origem.length] }}
                  />
                  <span className="min-w-0 flex-1 text-tinta-700">{o.origem}</span>
                  <span className="numerico font-semibold text-tinta-900">
                    {formatarNumero(o.quantidade)}
                  </span>
                  <span className="numerico w-11 text-right text-tinta-500">
                    {formatarPercentual((o.quantidade / totalOrigens) * 100)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <Vazio texto="Nenhum negócio no funil ainda." />
        )}
      </Card>

      <Card>
        <CardCabecalho
          titulo="Antes do funil: sua prospecção"
          descricao="O que a automação entrega para cada etapa seguinte, nas suas listas."
        />
        {temProspeccao ? (
          <div className="p-5 pr-8">
            <ResponsiveContainer width="100%" height={Math.max(180, etapasProspeccao.length * 46)}>
              <BarChart
                data={etapasProspeccao}
                layout="vertical"
                margin={{ top: 0, right: 56, bottom: 0, left: 0 }}
              >
                <CartesianGrid horizontal={false} stroke={COR.grade} />
                <XAxis type="number" allowDecimals={false} {...EIXO} />
                <YAxis
                  type="category"
                  dataKey="rotulo"
                  width={132}
                  {...EIXO}
                  tick={{ ...EIXO.tick, fontSize: 12 }}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(15,124,98,0.06)' }}
                  content={({ active, payload, label }) => (
                    <Dica
                      ativo={active}
                      rotulo={String(label ?? '')}
                      itens={[
                        {
                          nome: String(payload?.[0]?.payload?.descricao ?? 'Leads'),
                          valor: formatarNumero(Number(payload?.[0]?.value ?? 0)),
                          cor: COR.serie,
                        },
                      ]}
                    />
                  )}
                />
                <Bar
                isAnimationActive={false}
                  dataKey="quantidade"
                  fill={COR.serie}
                  radius={[0, 4, 4, 0]}
                  barSize={18}
                  label={(props) => (
                    <RotuloBarra {...props} formatar={formatarNumero} />
                  )}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <Vazio texto="Assim que você gerar a primeira lista, este gráfico começa a se preencher." />
        )}
      </Card>
    </div>
  )
}

function Vazio({ texto }: { texto: string }) {
  return (
    <p className="px-5 py-14 text-center text-xs text-tinta-500">{texto}</p>
  )
}
