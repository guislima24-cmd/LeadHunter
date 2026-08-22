'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Selecao } from '@/components/ui/Campo'
import { cn } from '@/lib/cn'
import type { MotivoPerda } from '@/lib/crm'

/**
 * Fecha um negócio como ganho ou perdido. Vive fora do quadro porque a ficha
 * do negócio fecha exatamente do mesmo jeito — e o motivo obrigatório na
 * perda é regra do banco (`crm_fechar_negocio`), não da tela: duplicar o
 * diálogo seria duplicar a chance de as duas telas discordarem dela.
 */
export function DialogoFecharNegocio({
  negocioId,
  titulo,
  organizacaoNome,
  motivosPerda,
  aoCancelar,
  aoConcluir,
}: {
  negocioId: string
  titulo: string
  organizacaoNome: string
  motivosPerda: MotivoPerda[]
  aoCancelar: () => void
  aoConcluir: () => void
}) {
  const [status, setStatus] = useState<'ganho' | 'perdido'>('ganho')
  const [motivo, setMotivo] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function confirmar() {
    if (status === 'perdido' && !motivo) {
      setErro('Escolha o motivo da perda.')
      return
    }
    setSalvando(true)
    setErro(null)
    try {
      const res = await fetch(`/api/crm/negocios/${negocioId}/fechar`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          motivoPerdaId: status === 'perdido' ? motivo : null,
        }),
      })
      if (!res.ok) {
        const dados = await res.json().catch(() => ({}))
        setErro(dados.mensagem ?? 'Não foi possível fechar o negócio.')
        return
      }
      aoConcluir()
    } catch {
      setErro('Falha de conexão ao fechar o negócio.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Fechar negócio ${titulo}`}
      className="fixed inset-0 z-50 flex items-end justify-center bg-tinta-900/40 p-0 text-left sm:items-center sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget && !salvando) aoCancelar()
      }}
    >
      <div className="surgir w-full max-w-md rounded-t-cartao bg-white p-5 shadow-lg sm:rounded-cartao">
        <h2 className="font-titulo text-base font-bold text-tinta-900">
          Fechar negócio
        </h2>
        <p className="mt-0.5 truncate text-sm text-tinta-500">
          {titulo} · {organizacaoNome}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {(['ganho', 'perdido'] as const).map((opcao) => (
            <button
              key={opcao}
              onClick={() => setStatus(opcao)}
              aria-pressed={status === opcao}
              className={cn(
                'rounded-lg border px-3 py-2.5 text-sm font-semibold capitalize transition-colors',
                status === opcao
                  ? opcao === 'ganho'
                    ? 'border-verde-500 bg-verde-50 text-verde-700'
                    : 'border-perigo-500 bg-perigo-50 text-perigo-700'
                  : 'border-tinta-200 bg-white text-tinta-600 hover:bg-tinta-50',
              )}
            >
              {opcao}
            </button>
          ))}
        </div>

        {status === 'perdido' && (
          <label className="mt-4 block">
            <span className="text-xs font-semibold text-tinta-700">
              Motivo da perda
            </span>
            <Selecao
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="mt-1"
            >
              <option value="">Escolha…</option>
              {motivosPerda.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </Selecao>
          </label>
        )}

        <p className="mt-3 text-xs leading-relaxed text-tinta-500">
          O negócio sai do quadro e passa a contar nos fechados do mês. O
          histórico de etapas é preservado para o cálculo de conversão.
        </p>

        {erro && (
          <p className="mt-3 rounded-lg bg-perigo-50 px-3 py-2 text-xs text-perigo-700">
            {erro}
          </p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <Button
            variante="secundario"
            tamanho="sm"
            onClick={aoCancelar}
            disabled={salvando}
          >
            Cancelar
          </Button>
          <Button
            tamanho="sm"
            variante={status === 'ganho' ? 'primario' : 'perigo'}
            onClick={confirmar}
            carregando={salvando}
          >
            Marcar como {status}
          </Button>
        </div>
      </div>
    </div>
  )
}
