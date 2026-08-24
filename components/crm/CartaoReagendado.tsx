'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/cn'
import { formatarData, formatarReais, formatarTelefone } from '@/lib/formato'
import type { Reagendado } from '@/lib/negocios'

/**
 * Um negócio perdido por timing, esperando a hora de voltar.
 *
 * O briefing aparece inteiro, sem "ver mais": ele existe justamente para
 * quem *não* conduziu a conversa original conseguir retomá-la, e um resumo
 * truncado devolve a pessoa ao problema que o campo resolve.
 */
export function CartaoReagendado({ item }: { item: Reagendado }) {
  const router = useRouter()
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const vencido = item.diasAteRecontato < 0
  const proximo = item.diasAteRecontato >= 0 && item.diasAteRecontato <= 5

  async function marcarRecontatado() {
    setSalvando(true)
    setErro(null)
    try {
      const res = await fetch(`/api/crm/reagendados/${item.id}/recontatado`, {
        method: 'PATCH',
      })
      if (!res.ok) {
        const dados = await res.json().catch(() => ({}))
        setErro(dados.mensagem ?? 'Não foi possível marcar como recontatado.')
        return
      }
      router.refresh()
    } catch {
      setErro('Falha de conexão.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <article
      className={cn(
        'rounded-cartao border bg-white p-5',
        vencido
          ? 'border-perigo-300'
          : proximo
            ? 'border-amarelo-300'
            : 'border-tinta-200',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/negocios/${item.negocioId}`}
            className="font-titulo text-base font-bold text-tinta-900 hover:text-verde-700 hover:underline"
          >
            {item.titulo}
          </Link>
          <p className="mt-0.5 truncate text-sm text-tinta-500">
            {item.organizacaoNome}
            {item.contatoNome && <> · {item.contatoNome}</>}
          </p>
        </div>

        {/* `ml-auto`: quando o título é longo o bloco quebra para a linha de
            baixo, e sem isto ele encostaria à esquerda — o `justify-between`
            do pai só alinha enquanto os dois cabem na mesma linha. */}
        <div className="ml-auto flex shrink-0 flex-col items-end gap-1.5">
          <Badge tom={vencido ? 'perigo' : proximo ? 'amarelo' : 'contorno'}>
            {vencido
              ? `atrasado ${Math.abs(item.diasAteRecontato)} d`
              : item.diasAteRecontato === 0
                ? 'recontatar hoje'
                : `em ${item.diasAteRecontato} d`}
          </Badge>
          <span className="numerico text-xs font-semibold text-tinta-600">
            {formatarData(item.dataRecontato)}
          </span>
          {item.valor != null && (
            <span className="numerico text-xs text-tinta-500">
              valor perdido: {formatarReais(item.valor)}
            </span>
          )}
        </div>
      </div>

      <dl className="mt-4 space-y-3 border-t border-tinta-100 pt-3.5">
        <div>
          <dt className="text-[0.7rem] font-bold tracking-wide text-tinta-500 uppercase">
            Por que não fechou agora
          </dt>
          <dd className="mt-1 text-sm leading-relaxed text-tinta-800">
            {item.motivoDetalhado}
          </dd>
        </div>
        <div>
          <dt className="text-[0.7rem] font-bold tracking-wide text-tinta-500 uppercase">
            O que fazer ao retomar
          </dt>
          <dd className="mt-1 text-sm leading-relaxed whitespace-pre-line text-tinta-800">
            {item.contextoParaRetomada}
          </dd>
        </div>
      </dl>

      {(item.contatoEmail || item.contatoTelefone) && (
        <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-tinta-600">
          {item.contatoEmail && (
            <a
              href={`mailto:${item.contatoEmail}`}
              className="font-semibold text-verde-700 hover:underline"
            >
              {item.contatoEmail}
            </a>
          )}
          {item.contatoTelefone && (
            <span>{formatarTelefone(item.contatoTelefone)}</span>
          )}
        </p>
      )}

      {erro && (
        <p role="alert" className="mt-3 rounded-lg bg-perigo-50 px-3 py-2 text-xs text-perigo-700">
          {erro}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-tinta-100 pt-3">
        <p className="text-xs text-tinta-400">
          Registrado por {item.criadoPorEmail}
        </p>
        <Button tamanho="sm" onClick={marcarRecontatado} carregando={salvando}>
          Marcar como recontatado
        </Button>
      </div>
    </article>
  )
}
