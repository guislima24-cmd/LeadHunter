import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Cabecalho } from '@/components/layout/Cabecalho'
import { Badge } from '@/components/ui/Badge'
import { EditorOrcamento } from '@/components/crm/EditorOrcamento'
import { exigirMembro } from '@/lib/sessao'
import { obterOrcamento, obterCatalogoPrecificacao } from '@/lib/orcamentos'
import { formatarDataHora } from '@/lib/formato'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const orcamento = await obterOrcamento(id)
  return { title: orcamento ? `Orçamento · ${orcamento.negocioTitulo}` : 'Orçamento' }
}

export default async function PaginaOrcamento({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  await exigirMembro()

  const [orcamento, catalogo] = await Promise.all([
    obterOrcamento(id),
    obterCatalogoPrecificacao(),
  ])
  if (!orcamento) notFound()

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <Link
          href="/precificacao"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-tinta-500 transition-colors hover:text-verde-700"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="size-3.5">
            <path d="M14 6l-6 6 6 6" />
          </svg>
          Todos os orçamentos
        </Link>
        <Link
          href={`/negocios/${orcamento.negocioId}`}
          className="text-xs font-semibold text-tinta-500 transition-colors hover:text-verde-700"
        >
          Abrir a ficha do negócio →
        </Link>
      </div>

      <Cabecalho
        titulo={orcamento.negocioTitulo}
        descricao={`${orcamento.organizacaoNome} · aberto por ${orcamento.criadoPorEmail} em ${formatarDataHora(orcamento.criadoEm)}`}
        acao={
          orcamento.status === 'finalizado' ? (
            <Badge tom="verde">Finalizado</Badge>
          ) : (
            <Badge tom="contorno">Rascunho</Badge>
          )
        }
      />

      <EditorOrcamento orcamento={orcamento} catalogo={catalogo} />
    </>
  )
}
