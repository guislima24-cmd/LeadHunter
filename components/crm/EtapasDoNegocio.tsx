'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { DialogoFecharNegocio } from '@/components/crm/DialogoFecharNegocio'
import { cn } from '@/lib/cn'
import { formatarDataHora } from '@/lib/formato'
import type { EtapaFunil, MotivoPerda } from '@/lib/crm'

/**
 * Esteira de etapas da ficha: mostra onde o negócio está e move com um clique.
 *
 * Sem trava de "não pode voltar" — é a mesma regra do quadro e da função
 * `crm_mover_etapa`: negócio volta de etapa na vida real, e esconder isso só
 * faria o histórico mentir.
 */
export function EtapasDoNegocio({
  negocioId,
  titulo,
  organizacaoNome,
  etapas,
  etapaAtualId,
  status,
  motivoPerda,
  fechadoEm,
  motivosPerda,
}: {
  negocioId: string
  titulo: string
  organizacaoNome: string
  etapas: EtapaFunil[]
  etapaAtualId: string
  status: 'aberto' | 'ganho' | 'perdido'
  motivoPerda: string | null
  fechadoEm: string | null
  motivosPerda: MotivoPerda[]
}) {
  const router = useRouter()
  const [etapaOtimista, setEtapaOtimista] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [fechando, setFechando] = useState(false)

  // Descarta o palpite otimista assim que o servidor concorda com ele — sem
  // isso, um negócio movido por outra pessoa continuaria aparecendo na etapa
  // que *esta* aba escolheu.
  useEffect(() => {
    setEtapaOtimista((atual) => (atual === etapaAtualId ? null : atual))
  }, [etapaAtualId])

  const atual = etapaOtimista ?? etapaAtualId
  const indiceAtual = etapas.findIndex((e) => e.id === atual)
  const aberto = status === 'aberto'

  async function mover(etapaId: string) {
    if (etapaId === atual || salvando) return
    const anterior = atual
    setErro(null)
    setEtapaOtimista(etapaId)
    setSalvando(true)
    try {
      const res = await fetch(`/api/crm/negocios/${negocioId}/etapa`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ etapaId }),
      })
      if (!res.ok) {
        const dados = await res.json().catch(() => ({}))
        setEtapaOtimista(anterior)
        setErro(dados.mensagem ?? 'Não foi possível mover o negócio.')
        return
      }
      router.refresh()
    } catch {
      setEtapaOtimista(anterior)
      setErro('Falha de conexão ao mover o negócio.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="rounded-cartao border border-tinta-200 bg-white p-4 shadow-cartao">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-tinta-900">Etapa do funil</h2>
          {salvando && <Spinner className="size-3.5 text-verde-600" />}
        </div>
        {aberto ? (
          <Button
            tamanho="sm"
            variante="secundario"
            onClick={() => setFechando(true)}
          >
            Fechar negócio…
          </Button>
        ) : (
          <Badge tom={status === 'ganho' ? 'verde' : 'perigo'}>
            {status === 'ganho' ? 'Ganho' : 'Perdido'}
            {fechadoEm ? ` · ${formatarDataHora(fechadoEm)}` : ''}
          </Badge>
        )}
      </div>

      {/* Esteira rola de lado sozinha quando há muitas etapas; a página não. */}
      <div className="rolagem-fina -mx-1 overflow-x-auto px-1 pb-1">
        <ol className="flex min-w-max items-stretch gap-1">
          {etapas.map((etapa, indice) => {
            const eAtual = etapa.id === atual
            const passou = indiceAtual >= 0 && indice < indiceAtual
            return (
              <li key={etapa.id}>
                <button
                  onClick={() => void mover(etapa.id)}
                  disabled={!aberto || salvando || eAtual}
                  aria-current={eAtual ? 'step' : undefined}
                  title={
                    aberto
                      ? eAtual
                        ? 'Etapa atual'
                        : `Mover para ${etapa.nome}`
                      : 'Negócio fechado — a etapa não muda mais'
                  }
                  className={cn(
                    'h-full min-w-[7.5rem] rounded-lg border px-3 py-2 text-left text-xs font-semibold transition-colors',
                    eAtual
                      ? 'border-verde-500 bg-verde-50 text-verde-800'
                      : passou
                        ? 'border-tinta-200 bg-tinta-50 text-tinta-500'
                        : 'border-tinta-200 bg-white text-tinta-600',
                    aberto && !eAtual && 'hover:border-verde-300 hover:bg-verde-50/60 hover:text-verde-700',
                    (!aberto || eAtual) && 'cursor-default',
                  )}
                >
                  <span className="block text-[0.65rem] font-bold tracking-wide text-tinta-400 uppercase">
                    {indice + 1}
                  </span>
                  {etapa.nome}
                </button>
              </li>
            )
          })}
        </ol>
      </div>

      {!aberto && (
        <p className="mt-3 border-t border-tinta-100 pt-3 text-xs text-tinta-500">
          {status === 'ganho'
            ? 'Negócio fechado como ganho. O histórico de etapas continua contando na conversão do funil.'
            : `Negócio perdido${motivoPerda ? ` — ${motivoPerda}` : ''}. Reabrir não é possível por aqui: crie um novo negócio para a mesma empresa quando ela voltar.`}
        </p>
      )}

      {erro && (
        <p
          role="alert"
          className="mt-3 rounded-lg bg-perigo-50 px-3 py-2 text-xs text-perigo-700"
        >
          {erro}
        </p>
      )}

      {fechando && (
        <DialogoFecharNegocio
          negocioId={negocioId}
          titulo={titulo}
          organizacaoNome={organizacaoNome}
          motivosPerda={motivosPerda}
          aoCancelar={() => setFechando(false)}
          aoConcluir={() => {
            setFechando(false)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}
