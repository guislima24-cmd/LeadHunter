import Link from 'next/link'
import { Cabecalho } from '@/components/layout/Cabecalho'
import { Card, CardCabecalho } from '@/components/ui/Card'
import { Metrica } from '@/components/ui/Metrica'
import { Badge } from '@/components/ui/Badge'
import { EstadoVazio } from '@/components/ui/Estado'
import { AbasNegocios } from '@/components/crm/AbasNegocios'
import { NovoNegocio } from '@/components/crm/NovoNegocio'
import { exigirMembro } from '@/lib/sessao'
import { listarOrganizacoes, listarProdutosServicos } from '@/lib/crm'
import {
  obterPrevisaoMensal,
  listarNegociosDoMes,
  contarReagendadosPendentes,
} from '@/lib/negocios'
import {
  formatarData,
  formatarMesAno,
  formatarNumero,
  formatarReais,
} from '@/lib/formato'

export const metadata = { title: 'Negócios · Previsão' }

/**
 * Previsão: o que se espera fechar, por mês de competência.
 *
 * Cada mês abre mostrando os negócios que o compõem — um total de R$ 180 mil
 * em março não diz nada até se ver que ele é um negócio só, e que esse
 * negócio está parado na primeira etapa desde janeiro.
 */
export default async function PaginaPrevisao() {
  await exigirMembro()

  const [previsao, organizacoes, produtos, reagendados] = await Promise.all([
    obterPrevisaoMensal(),
    listarOrganizacoes(),
    listarProdutosServicos(),
    contarReagendadosPendentes(),
  ])

  const negociosPorMes = await Promise.all(
    previsao.meses.map((m) => listarNegociosDoMes(m.mes)),
  )

  const totalPrevisto = previsao.meses.reduce((s, m) => s + m.valorTotal, 0)
  const totalNegocios = previsao.meses.reduce((s, m) => s + m.quantidade, 0)
  const maiorMes = Math.max(1, ...previsao.meses.map((m) => m.valorTotal))
  const hoje = new Date().toISOString().slice(0, 7)

  return (
    <>
      <Cabecalho
        titulo="Negócios"
        descricao="Quanto se espera fechar em cada mês, pelos negócios que já têm data de previsão."
        acao={<NovoNegocio organizacoes={organizacoes} produtos={produtos} />}
      />

      <AbasNegocios reagendadosPendentes={reagendados} />

      <section className="grid gap-4 sm:grid-cols-3">
        <Metrica
          rotulo="Total previsto"
          valor={formatarReais(totalPrevisto)}
          apoio={`em ${formatarNumero(totalNegocios)} negócios com data`}
          destaque={totalPrevisto > 0}
        />
        <Metrica
          rotulo="Meses com previsão"
          valor={formatarNumero(previsao.meses.length)}
          apoio="competências distintas à frente"
        />
        <Metrica
          rotulo="Sem previsão"
          valor={formatarNumero(previsao.semPrevisao)}
          apoio={
            previsao.semPrevisao === 0
              ? 'todo negócio aberto tem data'
              : `${formatarReais(previsao.valorSemPrevisao)} fora desta conta`
          }
        />
      </section>

      {previsao.semPrevisao > 0 && (
        <p className="mt-4 rounded-lg border border-amarelo-200 bg-amarelo-50 px-3.5 py-2.5 text-xs leading-relaxed text-amarelo-700">
          <strong>{formatarNumero(previsao.semPrevisao)}</strong>{' '}
          {previsao.semPrevisao === 1 ? 'negócio aberto não tem' : 'negócios abertos não têm'}{' '}
          previsão de fechamento e {previsao.semPrevisao === 1 ? 'ficou' : 'ficaram'}{' '}
          fora desta tela. Um negócio sem data não é previsto para mês nenhum —
          empurrá-lo para o mês corrente inventaria um compromisso que ninguém
          assumiu. Preencha a previsão na ficha de cada um para ele entrar aqui.
        </p>
      )}

      <div className="mt-6 space-y-4">
        {previsao.meses.length === 0 ? (
          <Card>
            <EstadoVazio
              titulo="Nenhum negócio com previsão de fechamento"
              descricao="A previsão se monta a partir do campo “Previsão de fechamento” de cada negócio. Abra um negócio do funil e preencha a data para ele aparecer aqui."
            />
          </Card>
        ) : (
          previsao.meses.map((mes, i) => {
            const negocios = negociosPorMes[i]
            const ehMesCorrente = mes.mes.slice(0, 7) === hoje
            const ehPassado = mes.mes.slice(0, 7) < hoje

            return (
              <Card key={mes.mes}>
                <CardCabecalho
                  titulo={formatarMesAno(mes.mes)}
                  descricao={
                    mes.semValor > 0
                      ? `${formatarNumero(mes.semValor)} ${mes.semValor === 1 ? 'negócio sem valor preenchido — o total abaixo está subestimado' : 'negócios sem valor preenchido — o total abaixo está subestimado'}`
                      : `${formatarNumero(mes.quantidade)} ${mes.quantidade === 1 ? 'negócio' : 'negócios'}`
                  }
                  acao={
                    <div className="flex items-center gap-2">
                      {ehPassado && <Badge tom="perigo">previsão vencida</Badge>}
                      {ehMesCorrente && <Badge tom="verde">mês corrente</Badge>}
                      <span className="numerico font-titulo text-lg font-extrabold text-verde-700">
                        {formatarReais(mes.valorTotal)}
                      </span>
                    </div>
                  }
                />

                {/* Barra proporcional ao maior mês — dá a forma da carteira
                    ao longo do tempo sem precisar de um gráfico à parte. */}
                <div className="px-5 pt-3">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-tinta-100">
                    <div
                      className="h-full rounded-full bg-verde-500"
                      style={{ width: `${Math.max(2, (mes.valorTotal / maiorMes) * 100)}%` }}
                    />
                  </div>
                </div>

                <ul className="mt-2 divide-y divide-tinta-100">
                  {negocios.map((n) => (
                    <li key={n.id}>
                      <Link
                        href={`/negocios/${n.id}`}
                        className="flex items-baseline justify-between gap-3 px-5 py-2.5 transition-colors hover:bg-tinta-50"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-tinta-900">
                            {n.titulo}
                          </span>
                          <span className="block truncate text-xs text-tinta-500">
                            {n.organizacaoNome} · {n.etapaNome}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="numerico block text-sm font-semibold text-tinta-900">
                            {n.valor == null ? '—' : formatarReais(n.valor)}
                          </span>
                          <span
                            className={
                              n.atrasado
                                ? 'block text-xs font-semibold text-perigo-700'
                                : 'block text-xs text-tinta-500'
                            }
                          >
                            {n.previsaoFechamento
                              ? formatarData(n.previsaoFechamento)
                              : '—'}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            )
          })
        )}
      </div>
    </>
  )
}
