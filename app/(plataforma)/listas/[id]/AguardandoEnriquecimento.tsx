'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const INTERVALO_MS = 15_000
/** ~5 min. O W2 espera 15 s entre leads, então listas grandes passam disso. */
const MAX_TENTATIVAS = 20

/**
 * O W1 responde assim que grava a lista e dispara o enriquecimento em segundo
 * plano, então a página abre com todos os leads "Na fila". Sem isto, o time
 * olhava a tela parada e concluía que o enriquecimento não tinha rodado —
 * quando na verdade só faltava recarregar.
 */
export function AguardandoEnriquecimento({ naFila }: { naFila: number }) {
  const router = useRouter()
  const [tentativas, setTentativas] = useState(0)

  useEffect(() => {
    if (naFila === 0 || tentativas >= MAX_TENTATIVAS) return
    const id = setTimeout(() => {
      setTentativas((n) => n + 1)
      router.refresh()
    }, INTERVALO_MS)
    return () => clearTimeout(id)
  }, [naFila, tentativas, router])

  if (naFila === 0) return null

  const desistiu = tentativas >= MAX_TENTATIVAS

  return (
    <div className="surgir mt-4 flex flex-wrap items-center gap-2 rounded-cartao border border-amarelo-200 bg-amarelo-50 px-4 py-3 text-xs text-tinta-700">
      {!desistiu && (
        <span
          aria-hidden
          className="size-3 animate-spin rounded-full border-2 border-amarelo-400 border-t-transparent"
        />
      )}
      <span>
        {desistiu ? (
          <>
            {naFila} {naFila === 1 ? 'lead continua' : 'leads continuam'} sem
            enriquecimento. Recarregue a página ou confira o Monitoramento.
          </>
        ) : (
          <>
            Enriquecendo {naFila} {naFila === 1 ? 'lead' : 'leads'} com IA. A
            página se atualiza sozinha conforme eles ficam prontos.
          </>
        )}
      </span>
    </div>
  )
}
