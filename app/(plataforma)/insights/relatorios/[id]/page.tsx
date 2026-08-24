import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Cabecalho } from '@/components/layout/Cabecalho'
import { Card, CardCabecalho } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { EditorRelatorio } from '@/components/crm/EditorRelatorio'
import { exigirMembro } from '@/lib/sessao'
import { obterRelatorio } from '@/lib/insights'
import type { SnapshotDeMetricas } from '@/lib/tipos-insights'
import {
  formatarDataHora,
  formatarMesAno,
  formatarNumero,
  formatarReais,
} from '@/lib/formato'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const relatorio = await obterRelatorio(id)
  return { title: relatorio ? relatorio.titulo : 'Relatório' }
}

/**
 * Um relatório mensal, com os números que o embasaram ao lado.
 *
 * O snapshot fica visível de propósito. Um relatório gerado por IA precisa ser
 * conferível: quem revisa tem de poder bater cada afirmação do texto contra o
 * número que a originou, sem sair da tela e sem confiar que a máquina somou
 * certo — ela não somou nada, o CRM somou, e é isso que está do lado.
 */
export default async function PaginaRelatorio({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await exigirMembro()
  const { id } = await params

  const relatorio = await obterRelatorio(id)
  if (!relatorio) notFound()

  const snapshot = relatorio.metricasSnapshot as SnapshotDeMetricas | null

  return (
    <>
      <div className="mb-4">
        <Link
          href="/insights/relatorios"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-tinta-500 transition-colors hover:text-verde-700"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="size-3.5">
            <path d="M14 6l-6 6 6 6" />
          </svg>
          Todos os relatórios
        </Link>
      </div>

      <Cabecalho
        titulo={relatorio.titulo}
        descricao={`${formatarMesAno(relatorio.periodoReferencia)} · criado por ${relatorio.criadoPorEmail ?? 'desconhecido'} em ${formatarDataHora(relatorio.criadoEm)}`}
        acao={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {relatorio.geradoPorIa && <Badge tom="info">rascunho da IA</Badge>}
            <Badge tom={relatorio.status === 'publicado' ? 'verde' : 'contorno'}>
              {relatorio.status === 'publicado' ? 'Publicado' : 'Rascunho'}
            </Badge>
          </div>
        }
      />

      {relatorio.geradoPorIa && relatorio.status === 'rascunho' && (
        <p className="mb-5 rounded-lg border border-info-200 bg-info-50 px-3.5 py-2.5 text-xs leading-relaxed text-info-700">
          Este texto foi escrito por IA a partir dos números ao lado — ela não
          calculou nem estimou nada, só redigiu. Ainda assim,{' '}
          <strong>leia antes de publicar</strong>: confira se cada afirmação
          bate com os números, e reescreva o que não soar como o time escreve.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="p-6 lg:col-span-3">
          <EditorRelatorio relatorio={relatorio} />
        </Card>

        <div className="space-y-6 lg:col-span-2">
          {snapshot ? (
            <>
              <Card>
                <CardCabecalho
                  titulo="Os números deste relatório"
                  descricao="Congelados quando o relatório foi criado. Não mudam se o dado histórico for editado depois."
                />
                <dl className="divide-y divide-tinta-100 text-sm">
                  <Linha
                    rotulo="Negócios ganhos"
                    valor={formatarNumero(snapshot.resumo?.ganhos ?? 0)}
                  />
                  <Linha
                    rotulo="Negócios perdidos"
                    valor={formatarNumero(snapshot.resumo?.perdidos ?? 0)}
                  />
                  <Linha
                    rotulo="Valor fechado"
                    valor={formatarReais(snapshot.resumo?.valorGanho ?? 0)}
                  />
                  <Linha
                    rotulo="Ticket médio"
                    valor={
                      snapshot.resumo?.ticketMedio == null
                        ? '—'
                        : formatarReais(snapshot.resumo.ticketMedio)
                    }
                  />
                  <Linha
                    rotulo="Ganhos entre os fechados"
                    valor={
                      snapshot.resumo?.taxaGanho == null
                        ? '—'
                        : `${snapshot.resumo.taxaGanho}%`
                    }
                  />
                </dl>
              </Card>

              {snapshot.funilProspeccao?.length > 0 && (
                <Card>
                  <CardCabecalho titulo="Funil de prospecção" />
                  <dl className="divide-y divide-tinta-100 text-sm">
                    {snapshot.funilProspeccao.map((e) => (
                      <Linha
                        key={e.chave}
                        rotulo={e.rotulo}
                        valor={formatarNumero(e.quantidade)}
                      />
                    ))}
                  </dl>
                </Card>
              )}

              {snapshot.motivosDePerda?.length > 0 && (
                <Card>
                  <CardCabecalho titulo="Motivos de perda" />
                  <dl className="divide-y divide-tinta-100 text-sm">
                    {snapshot.motivosDePerda.map((m) => (
                      <Linha
                        key={m.motivo}
                        rotulo={m.motivo}
                        valor={formatarNumero(m.quantidade)}
                      />
                    ))}
                  </dl>
                </Card>
              )}

              {snapshot.metas?.length > 0 && (
                <Card>
                  <CardCabecalho titulo="Metas do período" />
                  <dl className="divide-y divide-tinta-100 text-sm">
                    {snapshot.metas.map((m) => (
                      <Linha
                        key={m.nome}
                        rotulo={m.nome}
                        valor={`${m.percentual}%`}
                      />
                    ))}
                  </dl>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <p className="px-5 py-6 text-center text-xs text-tinta-500">
                Este relatório não guardou os números do período.
              </p>
            </Card>
          )}

          {relatorio.status === 'publicado' && (
            <Card>
              <CardCabecalho titulo="Publicação" />
              <dl className="divide-y divide-tinta-100 text-sm">
                <Linha
                  rotulo="Publicado por"
                  valor={relatorio.publicadoPorEmail ?? '—'}
                />
                <Linha
                  rotulo="Publicado em"
                  valor={formatarDataHora(relatorio.publicadoEm)}
                />
              </dl>
            </Card>
          )}
        </div>
      </div>
    </>
  )
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-5 py-2.5">
      <dt className="min-w-0 truncate text-xs font-semibold text-tinta-500">
        {rotulo}
      </dt>
      <dd className="numerico shrink-0 font-semibold text-tinta-900">{valor}</dd>
    </div>
  )
}
