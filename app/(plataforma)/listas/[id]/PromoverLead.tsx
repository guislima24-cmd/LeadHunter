'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

/**
 * Transforma um lead bruto em negócio no funil do CRM.
 *
 * É sempre ação humana e explícita: nenhuma automação promove lead sozinha,
 * senão o funil viraria despejo dos 1,6 milhão de registros da base. A RPC do
 * banco é idempotente por CNPJ, mas quando já existe negócio a tela mostra o
 * atalho para ele em vez de oferecer o botão de novo.
 */
export function PromoverLead({
  cnpj,
  empresa,
  enriquecido,
  negocioExistente,
}: {
  cnpj: string
  empresa: string
  enriquecido: boolean
  negocioExistente: { etapaNome: string; status: string } | null
}) {
  const router = useRouter()
  const [confirmando, setConfirmando] = useState(false)
  const [criando, setCriando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  if (negocioExistente) {
    return (
      <Link href="/pipeline" className="inline-block" title={`Negócio em ${negocioExistente.etapaNome}`}>
        <Badge tom={negocioExistente.status === 'aberto' ? 'verde' : 'neutro'}>
          {negocioExistente.status === 'aberto'
            ? negocioExistente.etapaNome
            : negocioExistente.status}
        </Badge>
      </Link>
    )
  }

  async function promover() {
    setCriando(true)
    setErro(null)
    try {
      const res = await fetch(`/api/crm/leads/${encodeURIComponent(cnpj)}/promover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const dados = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErro(dados.mensagem ?? 'Não foi possível iniciar o negócio.')
        return
      }
      setConfirmando(false)
      router.refresh()
    } catch {
      setErro('Falha de conexão ao iniciar o negócio.')
    } finally {
      setCriando(false)
    }
  }

  if (confirmando) {
    return (
      <div className="surgir min-w-52 rounded-lg border border-amarelo-200 bg-amarelo-50 p-3 text-left">
        <p className="text-xs leading-relaxed text-tinta-700">
          Criar negócio para <strong>{empresa}</strong> na primeira etapa do
          funil, com você como responsável?
        </p>
        {!enriquecido && (
          <p className="mt-1.5 text-[0.7rem] leading-relaxed text-amarelo-700">
            Este lead ainda não foi enriquecido, então o negócio nasce sem
            contato/decisor — dá para adicionar depois.
          </p>
        )}
        {erro && (
          <p className="mt-2 rounded bg-perigo-50 px-2 py-1.5 text-[0.7rem] text-perigo-700">
            {erro}
          </p>
        )}
        <div className="mt-2.5 flex gap-1.5">
          <Button tamanho="sm" onClick={promover} carregando={criando}>
            Criar
          </Button>
          <Button
            tamanho="sm"
            variante="secundario"
            onClick={() => setConfirmando(false)}
            disabled={criando}
          >
            Cancelar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <Button
      tamanho="sm"
      variante="secundario"
      onClick={() => setConfirmando(true)}
    >
      Iniciar negócio
    </Button>
  )
}
