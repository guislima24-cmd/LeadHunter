'use client'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useTransition } from 'react'
import { Entrada, Selecao } from '@/components/ui/Campo'

/**
 * Filtro de período do painel: mês, trimestre, ano ou intervalo à mão.
 *
 * Escreve na URL — um painel filtrado é a coisa que mais se manda por link, e
 * na URL o servidor já devolve os números certos em vez de o navegador
 * recortar depois.
 *
 * Os atalhos são calculados no cliente e viram sempre um par de datas
 * explícito. "Este trimestre" salvo como atalho apontaria para outro
 * trimestre daqui a três meses; salvo como `2026-07-01 a 2026-09-30`, o link
 * continua mostrando o que mostrava quando foi mandado.
 */
export function FiltroPeriodo() {
  const router = useRouter()
  const caminho = usePathname()
  const params = useSearchParams()
  const [pendente, iniciar] = useTransition()

  const inicio = params.get('inicio') ?? ''
  const fim = params.get('fim') ?? ''

  function aplicar(novoInicio: string, novoFim: string) {
    const proximos = new URLSearchParams(params.toString())
    proximos.set('inicio', novoInicio)
    proximos.set('fim', novoFim)
    iniciar(() => router.push(`${caminho}?${proximos.toString()}`))
  }

  function atalho(qual: string) {
    const hoje = new Date()
    const ano = hoje.getUTCFullYear()
    const mes = hoje.getUTCMonth()
    let de: Date
    let ate: Date

    if (qual === 'mes') {
      de = new Date(Date.UTC(ano, mes, 1))
      ate = new Date(Date.UTC(ano, mes + 1, 0))
    } else if (qual === 'mes_passado') {
      de = new Date(Date.UTC(ano, mes - 1, 1))
      ate = new Date(Date.UTC(ano, mes, 0))
    } else if (qual === 'trimestre') {
      const inicioTri = Math.floor(mes / 3) * 3
      de = new Date(Date.UTC(ano, inicioTri, 1))
      ate = new Date(Date.UTC(ano, inicioTri + 3, 0))
    } else if (qual === 'ano') {
      de = new Date(Date.UTC(ano, 0, 1))
      ate = new Date(Date.UTC(ano, 12, 0))
    } else {
      return
    }

    aplicar(de.toISOString().slice(0, 10), ate.toISOString().slice(0, 10))
  }

  return (
    <div className="mb-5 flex flex-wrap items-end gap-2">
      <label>
        <span className="mb-1 block text-xs font-semibold text-tinta-700">
          Atalhos
        </span>
        <Selecao
          value=""
          onChange={(e) => atalho(e.target.value)}
          className="w-44"
          aria-label="Escolher período rápido"
        >
          <option value="">Escolher…</option>
          <option value="mes">Este mês</option>
          <option value="mes_passado">Mês passado</option>
          <option value="trimestre">Este trimestre</option>
          <option value="ano">Este ano</option>
        </Selecao>
      </label>

      <label>
        <span className="mb-1 block text-xs font-semibold text-tinta-700">
          De
        </span>
        <Entrada
          type="date"
          value={inicio}
          max={fim || undefined}
          onChange={(e) => aplicar(e.target.value, fim || e.target.value)}
          className="w-40"
        />
      </label>

      <label>
        <span className="mb-1 block text-xs font-semibold text-tinta-700">
          Até
        </span>
        <Entrada
          type="date"
          value={fim}
          min={inicio || undefined}
          onChange={(e) => aplicar(inicio || e.target.value, e.target.value)}
          className="w-40"
        />
      </label>

      {pendente && (
        <span className="pb-2 text-xs text-tinta-500">carregando…</span>
      )}
    </div>
  )
}
