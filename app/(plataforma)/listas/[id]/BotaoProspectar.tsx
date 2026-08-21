'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { formatarNumero } from '@/lib/formato'

interface Resultado {
  enviados: number
  erros: number
  pulados: number
  totalProcessado: number
}

export function BotaoProspectar({
  listaId,
  elegiveis,
  habilitado,
}: {
  listaId: string
  elegiveis: number
  habilitado: boolean
}) {
  const router = useRouter()
  const [confirmando, setConfirmando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function prospectar() {
    setEnviando(true)
    setErro(null)
    try {
      const resposta = await fetch(`/api/listas/${listaId}/prospectar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const dados = await resposta.json()
      if (!resposta.ok) {
        setErro(dados.mensagem ?? 'Não foi possível disparar a prospecção.')
        return
      }
      setResultado(dados)
      setConfirmando(false)
      router.refresh()
    } catch {
      setErro('Falha de conexão ao disparar a prospecção.')
    } finally {
      setEnviando(false)
    }
  }

  if (resultado) {
    // Zero enviado com erro no meio não é conclusão: é falha. Pintar de verde
    // era o que fazia a tela dizer "concluída" para uma rodada em que nenhum
    // email saiu, e o time só descobria depois, na caixa de saída vazia.
    const deuCerto = resultado.enviados > 0
    const houveFalha = resultado.erros > 0

    return (
      <div
        className={`surgir rounded-cartao border p-4 ${
          deuCerto
            ? 'border-verde-200 bg-verde-50/60'
            : 'border-perigo-100 bg-perigo-50/60'
        }`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge tom={deuCerto ? 'verde' : 'perigo'}>
            {deuCerto ? 'Prospecção concluída' : 'Nenhum email enviado'}
          </Badge>
          <span className="text-sm font-semibold text-tinta-900">
            {formatarNumero(resultado.enviados)} emails enviados
          </span>
        </div>
        <p className="mt-1.5 text-xs text-tinta-600">
          {formatarNumero(resultado.pulados)} pulados (já contatados ou sem
          email) · {formatarNumero(resultado.erros)} com erro · de{' '}
          {formatarNumero(resultado.totalProcessado)} processados.
        </p>
        {houveFalha && (
          <p className="mt-1.5 text-xs text-tinta-600">
            Os leads com erro continuam sem contato e podem ser reenviados: o
            envio é idempotente, quem já recebeu não recebe de novo.
          </p>
        )}
      </div>
    )
  }

  return (
    <div>
      {!confirmando ? (
        <Button
          onClick={() => setConfirmando(true)}
          disabled={!habilitado || elegiveis === 0}
        >
          Prospectar por email
          {elegiveis > 0 && ` (${formatarNumero(elegiveis)})`}
        </Button>
      ) : (
        <div className="surgir rounded-cartao border border-amarelo-200 bg-amarelo-50 p-4">
          <p className="text-sm font-semibold text-tinta-900">
            Enviar email para {formatarNumero(elegiveis)} leads?
          </p>
          <p className="mt-1 text-xs leading-relaxed text-tinta-600">
            Os emails saem de verdade, pela conta do Gmail configurada no
            workflow. Quem já foi contatado ou não tem email é pulado
            automaticamente. Esta ação não tem desfazer.
          </p>
          <div className="mt-3 flex gap-2">
            <Button tamanho="sm" onClick={prospectar} carregando={enviando}>
              Confirmar envio
            </Button>
            <Button
              tamanho="sm"
              variante="secundario"
              onClick={() => setConfirmando(false)}
              disabled={enviando}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {erro && (
        <p className="mt-3 rounded-lg bg-perigo-50 px-3 py-2 text-xs text-perigo-700">
          {erro}
        </p>
      )}
    </div>
  )
}
