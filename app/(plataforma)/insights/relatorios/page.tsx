import Link from 'next/link'
import { Cabecalho } from '@/components/layout/Cabecalho'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { EstadoVazio } from '@/components/ui/Estado'
import { AbasInsights } from '@/components/crm/AbasInsights'
import { exigirMembro } from '@/lib/sessao'
import { listarRelatorios } from '@/lib/insights'
import { formatarMesAno, tempoRelativo } from '@/lib/formato'

export const metadata = { title: 'Insights · Relatórios' }

/**
 * O histórico de relatórios mensais.
 *
 * Publicado é o registro daquele mês — um por mês, garantido por índice no
 * banco. Rascunhos convivem à vontade: são a mesa de trabalho.
 */
export default async function PaginaRelatorios() {
  await exigirMembro()
  const relatorios = await listarRelatorios()

  const publicados = relatorios.filter((r) => r.status === 'publicado')
  const rascunhos = relatorios.filter((r) => r.status === 'rascunho')

  return (
    <>
      <Cabecalho
        titulo="Insights"
        descricao="Os relatórios mensais do comercial, com os números daquele mês congelados junto."
        acao={
          <Link
            href="/insights/relatorios/gerar"
            className="inline-flex h-9 items-center rounded-lg bg-verde-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-verde-700"
          >
            Novo relatório
          </Link>
        }
      />

      <AbasInsights />

      {relatorios.length === 0 ? (
        <Card>
          <EstadoVazio
            titulo="Nenhum relatório ainda"
            descricao="Um relatório mensal guarda o texto e os números daquele mês juntos — se alguém reclassificar um negócio antigo depois, o relatório continua contando a história que contava. Escreva o primeiro à mão, ou peça um rascunho para a IA a partir dos números do mês."
            acao={
              <Link
                href="/insights/relatorios/gerar"
                className="inline-flex h-9 items-center rounded-lg bg-verde-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-verde-700"
              >
                Criar o primeiro
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {rascunhos.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-bold text-tinta-800">
                Rascunhos
              </h2>
              <Card>
                <ul className="divide-y divide-tinta-100">
                  {rascunhos.map((r) => (
                    <LinhaRelatorio key={r.id} relatorio={r} />
                  ))}
                </ul>
              </Card>
            </section>
          )}

          {publicados.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-bold text-tinta-800">
                Publicados
              </h2>
              <Card>
                <ul className="divide-y divide-tinta-100">
                  {publicados.map((r) => (
                    <LinhaRelatorio key={r.id} relatorio={r} />
                  ))}
                </ul>
              </Card>
            </section>
          )}
        </div>
      )}
    </>
  )
}

function LinhaRelatorio({
  relatorio,
}: {
  relatorio: Awaited<ReturnType<typeof listarRelatorios>>[number]
}) {
  return (
    <li>
      <Link
        href={`/insights/relatorios/${relatorio.id}`}
        className="flex items-baseline justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-tinta-50"
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-tinta-900">
            {relatorio.titulo}
          </span>
          <span className="block text-xs text-tinta-500">
            {formatarMesAno(relatorio.periodoReferencia)} ·{' '}
            {relatorio.status === 'publicado'
              ? `publicado ${tempoRelativo(relatorio.publicadoEm)}`
              : `editado ${tempoRelativo(relatorio.atualizadoEm)}`}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {relatorio.geradoPorIa && <Badge tom="info">rascunho da IA</Badge>}
          <Badge tom={relatorio.status === 'publicado' ? 'verde' : 'contorno'}>
            {relatorio.status === 'publicado' ? 'Publicado' : 'Rascunho'}
          </Badge>
        </span>
      </Link>
    </li>
  )
}
