import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Cabecalho } from '@/components/layout/Cabecalho'
import { ReferenciaPrecificacao } from '@/components/crm/ReferenciaPrecificacao'
import { exigirMembro } from '@/lib/sessao'
import { obterCatalogoPrecificacao } from '@/lib/orcamentos'

export const metadata = { title: 'Referência de preço' }

/**
 * Só admin: são os números que definem quanto a empresa cobra. Mexer neles
 * muda o preço de todo orçamento novo.
 */
export default async function PaginaReferencia() {
  const membro = await exigirMembro()
  if (membro.papel !== 'admin') notFound()

  const catalogo = await obterCatalogoPrecificacao()

  return (
    <>
      <div className="mb-4">
        <Link
          href="/precificacao"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-tinta-500 transition-colors hover:text-verde-700"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="size-3.5">
            <path d="M14 6l-6 6 6 6" />
          </svg>
          Voltar para os orçamentos
        </Link>
      </div>

      <Cabecalho
        titulo="Referência de preço"
        descricao="A régua por trás da calculadora: taxa/hora por porte, o quanto cada escolha de escopo encarece e os multiplicadores de capacidade. Tudo o que aqui era código na planilha antiga."
      />

      <ReferenciaPrecificacao catalogo={catalogo} />
    </>
  )
}
