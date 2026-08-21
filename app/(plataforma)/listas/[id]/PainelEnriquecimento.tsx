'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'

const INTERVALO_MS = 15_000
/** ~5 min. O W2 espera 15 s entre leads, então listas grandes passam disso. */
const MAX_TENTATIVAS = 20

/**
 * Estado do enriquecimento da lista, com auto-refresh e reenvio.
 *
 * O W1 responde assim que grava a lista e dispara o enriquecimento em segundo
 * plano, então a página abre com todos os leads "Na fila". Sem o refresh
 * automático, o time olhava a tela parada e concluía que o enriquecimento não
 * tinha rodado — quando só faltava recarregar.
 *
 * E quem falhou precisa de um caminho de volta: antes, um lead que batia na
 * cota do modelo ficava com status de erro para sempre, sem botão nenhum.
 */
export function PainelEnriquecimento({
  listaId,
  naFila,
  falhos,
}: {
  listaId: string
  naFila: number
  falhos: number
}) {
  const router = useRouter()
  const [tentativas, setTentativas] = useState(0)
  const [reenfileirando, setReenfileirando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [reenfileirado, setReenfileirado] = useState(false)

  useEffect(() => {
    if (naFila === 0 || tentativas >= MAX_TENTATIVAS) return
    const id = setTimeout(() => {
      setTentativas((n) => n + 1)
      router.refresh()
    }, INTERVALO_MS)
    return () => clearTimeout(id)
  }, [naFila, tentativas, router])

  async function reenfileirar() {
    setReenfileirando(true)
    setErro(null)
    try {
      const res = await fetch(`/api/listas/${listaId}/enriquecer`, {
        method: 'POST',
      })
      const dados = await res.json()
      if (!res.ok) {
        setErro(dados.mensagem ?? 'Não foi possível reenfileirar.')
        return
      }
      setReenfileirado(true)
      setTentativas(0)
      router.refresh()
    } catch {
      setErro('Falha de conexão ao reenfileirar o enriquecimento.')
    } finally {
      setReenfileirando(false)
    }
  }

  if (naFila === 0 && falhos === 0) return null

  const rodando = naFila > 0 && tentativas < MAX_TENTATIVAS

  return (
    <div className="surgir mt-4 rounded-cartao border border-amarelo-200 bg-amarelo-50 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-tinta-700">
        {rodando && (
          <span
            aria-hidden
            className="size-3 animate-spin rounded-full border-2 border-amarelo-400 border-t-transparent"
          />
        )}
        <span>
          {rodando ? (
            <>
              Enriquecendo {naFila} {naFila === 1 ? 'lead' : 'leads'} com IA. A
              página se atualiza sozinha conforme eles ficam prontos.
            </>
          ) : naFila > 0 ? (
            <>
              {naFila} {naFila === 1 ? 'lead continua' : 'leads continuam'} na
              fila há alguns minutos.
            </>
          ) : (
            <>
              {falhos} {falhos === 1 ? 'lead ficou' : 'leads ficaram'} sem
              enriquecimento — em geral é a cota do modelo, que renova sozinha.
            </>
          )}
        </span>
      </div>

      {!rodando && (
        <div className="mt-3">
          {reenfileirado ? (
            <p className="text-xs text-tinta-600">
              Reenfileirado. O enriquecimento roda em segundo plano; recarregue
              em alguns minutos.
            </p>
          ) : (
            <Button
              tamanho="sm"
              variante="secundario"
              onClick={reenfileirar}
              carregando={reenfileirando}
            >
              Tentar enriquecer de novo
            </Button>
          )}
        </div>
      )}

      {erro && (
        <p className="mt-2 rounded-lg bg-perigo-50 px-3 py-2 text-xs text-perigo-700">
          {erro}
        </p>
      )}
    </div>
  )
}
