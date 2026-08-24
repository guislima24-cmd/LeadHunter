'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/cn'

type TipoEvento = 'aceite' | 'resposta'

const ROTULO: Record<TipoEvento, { curto: string; ajuda: string }> = {
  aceite: {
    curto: 'Aceitou',
    ajuda: 'O lead topou conversar — abriu a porta para a prospecção.',
  },
  resposta: {
    curto: 'Respondeu',
    ajuda: 'O lead respondeu o email, seja o que for que tenha dito.',
  },
}

/**
 * Marca que um lead aceitou o contato ou respondeu o email.
 *
 * Existe porque nenhum workflow lê a caixa de entrada institucional hoje: o
 * W3 grava que o email saiu, e o que veio depois só quem conversou sabe. Sem
 * este registro, o funil de prospecção do painel de Insights só conseguiria
 * mostrar as pontas — quantos foram prospectados e quantos viraram contrato —
 * com um buraco no meio exatamente onde a prospecção é ganha ou perdida.
 *
 * Os dois botões alternam: clicar de novo desmarca. O registro errado é mais
 * comum que o esquecido, e um dado que só entra e nunca sai é um dado que o
 * time para de confiar.
 */
export function EventosDoLead({
  cnpj,
  aceite,
  resposta,
}: {
  cnpj: string
  aceite: boolean
  resposta: boolean
}) {
  const router = useRouter()
  const [ocupado, setOcupado] = useState<TipoEvento | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function alternar(tipo: TipoEvento, marcado: boolean) {
    setOcupado(tipo)
    setErro(null)
    try {
      const res = await fetch(
        marcado
          ? `/api/crm/leads/${encodeURIComponent(cnpj)}/eventos?tipoEvento=${tipo}`
          : `/api/crm/leads/${encodeURIComponent(cnpj)}/eventos`,
        marcado
          ? { method: 'DELETE' }
          : {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ tipoEvento: tipo }),
            },
      )
      if (!res.ok) {
        const dados = await res.json().catch(() => ({}))
        setErro(dados.mensagem ?? 'Não foi possível registrar.')
        return
      }
      router.refresh()
    } catch {
      setErro('Falha de conexão.')
    } finally {
      setOcupado(null)
    }
  }

  const estados: Array<[TipoEvento, boolean]> = [
    ['aceite', aceite],
    ['resposta', resposta],
  ]

  return (
    <span className="flex flex-col gap-1">
      <span className="flex gap-1">
        {estados.map(([tipo, marcado]) => (
          <button
            key={tipo}
            type="button"
            onClick={() => alternar(tipo, marcado)}
            disabled={ocupado != null}
            aria-pressed={marcado}
            title={ROTULO[tipo].ajuda}
            className={cn(
              'rounded-full border px-2 py-0.5 text-[0.7rem] font-semibold transition-colors disabled:opacity-50',
              marcado
                ? 'border-verde-500 bg-verde-50 text-verde-700'
                : 'border-tinta-200 bg-white text-tinta-500 hover:border-tinta-300 hover:text-tinta-700',
            )}
          >
            {marcado ? '✓ ' : ''}
            {ROTULO[tipo].curto}
          </button>
        ))}
      </span>
      {erro && <span className="text-[0.7rem] text-perigo-600">{erro}</span>}
    </span>
  )
}
