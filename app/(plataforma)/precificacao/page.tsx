import Link from 'next/link'
import { Cabecalho } from '@/components/layout/Cabecalho'
import { Card, CardCabecalho } from '@/components/ui/Card'
import { Metrica } from '@/components/ui/Metrica'
import { Badge } from '@/components/ui/Badge'
import { EstadoVazio } from '@/components/ui/Estado'
import { Tabela, Th, Td, Tr } from '@/components/ui/Tabela'
import { NovoOrcamento } from '@/components/crm/NovoOrcamento'
import { exigirMembro } from '@/lib/sessao'
import {
  listarOrcamentos,
  listarNegociosParaOrcamento,
  obterCatalogoPrecificacao,
} from '@/lib/orcamentos'
import {
  formatarNumero,
  formatarReais,
  tempoRelativo,
} from '@/lib/formato'

export const metadata = { title: 'Precificação' }

const ROTULO_NIVEL: Record<string, string> = {
  ideal: 'Ideal',
  aceitavel: 'Aceitável',
  ponto_equilibrio: 'Ponto de equilíbrio',
}

/**
 * Aba de precificação: os orçamentos abertos e a régua que os calcula.
 *
 * O orçamento vive colado a um negócio (é dele que sai o valor que o funil
 * mostra), mas ganhou aba própria porque montar preço é um trabalho à parte
 * de tocar o negócio — e porque a calculadora que isto substitui era uma
 * ferramenta separada, aberta sozinha.
 */
export default async function PaginaPrecificacao() {
  const membro = await exigirMembro()
  const [orcamentos, negocios, catalogo] = await Promise.all([
    listarOrcamentos(),
    listarNegociosParaOrcamento(),
    obterCatalogoPrecificacao(),
  ])

  const rascunhos = orcamentos.filter((o) => o.status === 'rascunho')
  const finalizados = orcamentos.filter((o) => o.status === 'finalizado')
  const somaFinalizados = finalizados.reduce((s, o) => s + (o.valorIdeal ?? 0), 0)
  const comHistorico = Object.values(catalogo.historico).filter((h) => h.amostra > 0)

  return (
    <>
      <Cabecalho
        titulo="Precificação"
        descricao="Monta o preço de uma proposta com a régua que o time já usa — taxa por porte, complexidade do escopo e capacidade do time — e compara com o que já foi cobrado por serviço parecido."
        acao={
          <div className="flex flex-wrap items-center gap-2">
            {membro.papel === 'admin' && (
              <Link
                href="/precificacao/referencia"
                className="inline-flex h-8 items-center rounded-md border border-tinta-200 bg-white px-3 text-xs font-semibold text-tinta-800 transition-colors hover:bg-tinta-50"
              >
                Referência
              </Link>
            )}
            <NovoOrcamento
              negocios={negocios}
              portes={catalogo.portes}
              faixas={catalogo.faixas}
            />
          </div>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metrica
          rotulo="Rascunhos"
          valor={formatarNumero(rascunhos.length)}
          apoio="orçamentos em montagem"
        />
        <Metrica
          rotulo="Finalizados"
          valor={formatarNumero(finalizados.length)}
          apoio="viraram proposta"
          destaque={finalizados.length > 0}
        />
        <Metrica
          rotulo="Valor proposto"
          valor={formatarReais(somaFinalizados)}
          apoio="somando os finalizados"
          destaque={somaFinalizados > 0}
        />
        <Metrica
          rotulo="Serviços com histórico"
          valor={formatarNumero(comHistorico.length)}
          apoio={`de ${formatarNumero(catalogo.servicos.length)} no catálogo`}
        />
      </section>

      <Card className="mt-6">
        <CardCabecalho
          titulo="Orçamentos"
          descricao="Rascunho é editável; finalizado vira registro e já gravou o valor no negócio."
        />
        {orcamentos.length === 0 ? (
          <EstadoVazio
            titulo="Nenhum orçamento ainda"
            descricao="Abra um a partir de um negócio do funil. Você escolhe os serviços, o esforço de cada um e a complexidade do escopo; o preço sai nos três níveis que o time usa."
          />
        ) : (
          <Tabela>
            <thead>
              <tr>
                <Th>Negócio</Th>
                <Th>Porte</Th>
                <Th className="text-right">Serviços</Th>
                <Th className="text-right">Valor ideal</Th>
                <Th>Situação</Th>
                <Th>Atualizado</Th>
              </tr>
            </thead>
            <tbody>
              {orcamentos.map((o) => (
                <Tr key={o.id}>
                  <Td>
                    <Link
                      href={`/precificacao/${o.id}`}
                      className="font-semibold text-tinta-900 hover:text-verde-700 hover:underline"
                    >
                      {o.negocioTitulo}
                    </Link>
                    <span className="block text-xs text-tinta-500">
                      {o.organizacaoNome}
                    </span>
                  </Td>
                  <Td className="text-tinta-600">{o.porteNome}</Td>
                  <Td className="numerico text-right">
                    {formatarNumero(o.quantidadeItens)}
                  </Td>
                  <Td className="numerico text-right font-semibold">
                    {o.valorIdeal == null ? '—' : formatarReais(o.valorIdeal)}
                  </Td>
                  <Td>
                    {o.status === 'finalizado' ? (
                      <Badge tom="verde">
                        {ROTULO_NIVEL[o.nivelProposto ?? ''] ?? 'Finalizado'}
                      </Badge>
                    ) : (
                      <Badge tom="contorno">Rascunho</Badge>
                    )}
                  </Td>
                  <Td className="text-tinta-500">{tempoRelativo(o.atualizadoEm)}</Td>
                </Tr>
              ))}
            </tbody>
          </Tabela>
        )}
      </Card>
    </>
  )
}
