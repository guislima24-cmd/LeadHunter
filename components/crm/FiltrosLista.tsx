'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Entrada, Selecao } from '@/components/ui/Campo'
import type { EtapaFunil, MembroResumido } from '@/lib/crm'

/**
 * Filtros da visualização Lista.
 *
 * Escrevem na URL em vez de guardar estado local: filtro de lista é a coisa
 * que mais se manda por link ("olha os do Rafael parados em Negociação"), e
 * na URL o servidor já devolve a página certa — sem carregar tudo para
 * filtrar no navegador depois.
 */
export function FiltrosLista({
  etapas,
  membros,
}: {
  etapas: EtapaFunil[]
  membros: MembroResumido[]
}) {
  const router = useRouter()
  const params = useSearchParams()
  const [pendente, iniciar] = useTransition()
  const [busca, setBusca] = useState(params.get('busca') ?? '')

  function aplicar(mudancas: Record<string, string>) {
    const proximos = new URLSearchParams(params.toString())
    for (const [chave, valor] of Object.entries(mudancas)) {
      if (valor) proximos.set(chave, valor)
      else proximos.delete(chave)
    }
    // Qualquer mudança de filtro volta para a primeira página: manter
    // `pagina=7` depois de estreitar o resultado para 12 linhas mostraria
    // uma tabela vazia e pareceria que o filtro não achou nada.
    proximos.delete('pagina')
    iniciar(() => router.push(`/negocios/lista?${proximos.toString()}`))
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        aplicar({ busca })
      }}
      className="mb-4 flex flex-wrap items-end gap-2"
    >
      <label className="min-w-52 flex-1">
        <span className="mb-1 block text-xs font-semibold text-tinta-700">
          Buscar
        </span>
        <Entrada
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          onBlur={() => aplicar({ busca })}
          placeholder="Negócio, empresa ou contato"
        />
      </label>

      <label>
        <span className="mb-1 block text-xs font-semibold text-tinta-700">
          Situação
        </span>
        <Selecao
          value={params.get('status') ?? 'aberto'}
          onChange={(e) => aplicar({ status: e.target.value })}
          className="w-36"
        >
          <option value="aberto">Em aberto</option>
          <option value="ganho">Ganhos</option>
          <option value="perdido">Perdidos</option>
          <option value="todos">Todos</option>
        </Selecao>
      </label>

      <label>
        <span className="mb-1 block text-xs font-semibold text-tinta-700">
          Etapa
        </span>
        <Selecao
          value={params.get('etapa') ?? ''}
          onChange={(e) => aplicar({ etapa: e.target.value })}
          className="w-44"
        >
          <option value="">Todas</option>
          {etapas.map((etapa) => (
            <option key={etapa.id} value={etapa.id}>
              {etapa.nome}
            </option>
          ))}
        </Selecao>
      </label>

      <label>
        <span className="mb-1 block text-xs font-semibold text-tinta-700">
          Dono
        </span>
        <Selecao
          value={params.get('dono') ?? ''}
          onChange={(e) => aplicar({ dono: e.target.value })}
          className="w-44"
        >
          <option value="">Todos</option>
          {membros.map((m) => (
            <option key={m.email} value={m.email}>
              {m.nome || m.email}
            </option>
          ))}
        </Selecao>
      </label>

      {pendente && (
        <span className="pb-2 text-xs text-tinta-500">carregando…</span>
      )}
    </form>
  )
}
