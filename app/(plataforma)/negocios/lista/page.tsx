import Link from 'next/link'
import { Cabecalho } from '@/components/layout/Cabecalho'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { EstadoVazio } from '@/components/ui/Estado'
import { Tabela, Th, Td, Tr } from '@/components/ui/Tabela'
import { NovoNegocio } from '@/components/crm/NovoNegocio'
import { AbasNegocios } from '@/components/crm/AbasNegocios'
import { FiltrosLista } from '@/components/crm/FiltrosLista'
import { exigirMembro } from '@/lib/sessao'
import {
  listarEtapasAtivas,
  listarMembrosAtivos,
  listarOrganizacoes,
  listarProdutosServicos,
} from '@/lib/crm'
import { listarNegocios, contarReagendadosPendentes } from '@/lib/negocios'
import {
  formatarData,
  formatarNumero,
  formatarReais,
  tempoRelativo,
} from '@/lib/formato'

export const metadata = { title: 'Negócios · Lista' }

/**
 * Visualização Lista: a tabela que o Kanban não consegue ser.
 *
 * O Kanban é bom para mover e ruim para comparar — não dá para ordenar por
 * valor nem ver trinta negócios de uma vez. É também a única visualização que
 * mostra fechados, porque é aqui que se procura "aquele negócio do ano
 * passado" que no quadro não existe mais.
 */
export default async function PaginaListaNegocios({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string
    etapa?: string
    dono?: string
    busca?: string
    pagina?: string
  }>
}) {
  await exigirMembro()
  const filtros = await searchParams

  const status = (filtros.status ?? 'aberto') as
    | 'aberto'
    | 'ganho'
    | 'perdido'
    | 'todos'
  const pagina = Number(filtros.pagina) || 1

  const [resultado, etapas, membros, organizacoes, produtos, reagendados] =
    await Promise.all([
      listarNegocios({
        status,
        etapaId: filtros.etapa,
        donoEmail: filtros.dono,
        busca: filtros.busca,
        pagina,
      }),
      listarEtapasAtivas(),
      listarMembrosAtivos(),
      listarOrganizacoes(),
      listarProdutosServicos(),
      contarReagendadosPendentes(),
    ])

  const somaVisivel = resultado.negocios.reduce((s, n) => s + (n.valor ?? 0), 0)

  return (
    <>
      <Cabecalho
        titulo="Negócios"
        descricao="Todos os negócios do time, filtráveis e ordenados pela última alteração."
        acao={<NovoNegocio organizacoes={organizacoes} produtos={produtos} />}
      />

      <AbasNegocios reagendadosPendentes={reagendados} />

      <FiltrosLista etapas={etapas} membros={membros} />

      <Card>
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-tinta-100 px-5 py-3">
          <p className="text-sm font-semibold text-tinta-800">
            {formatarNumero(resultado.total)}{' '}
            {resultado.total === 1 ? 'negócio' : 'negócios'}
          </p>
          <p className="text-xs text-tinta-500">
            {formatarReais(somaVisivel)} nesta página
          </p>
        </div>

        {resultado.negocios.length === 0 ? (
          <EstadoVazio
            titulo="Nenhum negócio com esses filtros"
            descricao="Afrouxe a busca ou troque a situação — “Em aberto” esconde os que já foram ganhos ou perdidos."
          />
        ) : (
          <Tabela>
            <thead>
              <tr>
                <Th>Negócio</Th>
                <Th>Contato</Th>
                <Th>Etapa</Th>
                <Th className="text-right">Valor</Th>
                <Th>Previsão</Th>
                <Th>Próxima atividade</Th>
                <Th>Dono</Th>
              </tr>
            </thead>
            <tbody>
              {resultado.negocios.map((n) => (
                <Tr key={n.id}>
                  <Td>
                    <Link
                      href={`/negocios/${n.id}`}
                      className="font-semibold text-tinta-900 hover:text-verde-700 hover:underline"
                    >
                      {n.titulo}
                    </Link>
                    <span className="block truncate text-xs text-tinta-500">
                      {n.organizacaoNome}
                    </span>
                  </Td>
                  <Td className="text-tinta-600">{n.contatoNome ?? '—'}</Td>
                  <Td>
                    {n.status === 'aberto' ? (
                      <span className="text-tinta-700">{n.etapaNome}</span>
                    ) : (
                      <Badge tom={n.status === 'ganho' ? 'verde' : 'perigo'}>
                        {n.status}
                      </Badge>
                    )}
                  </Td>
                  <Td className="numerico text-right font-semibold">
                    {n.valor == null ? (
                      <span className="text-tinta-400">—</span>
                    ) : (
                      formatarReais(n.valor)
                    )}
                  </Td>
                  <Td className="whitespace-nowrap">
                    {n.previsaoFechamento == null ? (
                      <span className="text-tinta-400">—</span>
                    ) : (
                      <span
                        className={
                          n.atrasado
                            ? 'font-semibold text-perigo-700'
                            : 'text-tinta-600'
                        }
                      >
                        {formatarData(n.previsaoFechamento)}
                      </span>
                    )}
                  </Td>
                  <Td>
                    {n.proximaAtividade == null ? (
                      <span className="text-xs text-tinta-400">
                        nada agendado
                      </span>
                    ) : (
                      <span className="block">
                        <span className="block text-xs font-semibold text-tinta-800">
                          {tempoRelativo(n.proximaAtividade)}
                        </span>
                        <span className="block truncate text-xs text-tinta-500">
                          {n.proximaAtividadeTitulo}
                        </span>
                      </span>
                    )}
                  </Td>
                  <Td className="truncate text-xs text-tinta-600">
                    {n.donoNome}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Tabela>
        )}

        {resultado.totalPaginas > 1 && (
          <Paginacao
            pagina={resultado.pagina}
            totalPaginas={resultado.totalPaginas}
            filtros={filtros}
          />
        )}
      </Card>
    </>
  )
}

function Paginacao({
  pagina,
  totalPaginas,
  filtros,
}: {
  pagina: number
  totalPaginas: number
  filtros: Record<string, string | undefined>
}) {
  function href(destino: number) {
    const params = new URLSearchParams()
    for (const [chave, valor] of Object.entries(filtros)) {
      if (valor && chave !== 'pagina') params.set(chave, valor)
    }
    if (destino > 1) params.set('pagina', String(destino))
    const consulta = params.toString()
    return `/negocios/lista${consulta ? `?${consulta}` : ''}`
  }

  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3">
      <p className="text-xs text-tinta-500">
        Página {formatarNumero(pagina)} de {formatarNumero(totalPaginas)}
      </p>
      <div className="flex gap-2">
        {pagina > 1 && (
          <Link
            href={href(pagina - 1)}
            className="inline-flex h-8 items-center rounded-md border border-tinta-200 bg-white px-3 text-xs font-semibold text-tinta-800 transition-colors hover:bg-tinta-50"
          >
            Anterior
          </Link>
        )}
        {pagina < totalPaginas && (
          <Link
            href={href(pagina + 1)}
            className="inline-flex h-8 items-center rounded-md border border-tinta-200 bg-white px-3 text-xs font-semibold text-tinta-800 transition-colors hover:bg-tinta-50"
          >
            Próxima
          </Link>
        )}
      </div>
    </div>
  )
}
