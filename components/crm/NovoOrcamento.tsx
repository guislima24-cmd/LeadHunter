'use client'
import { useId, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Campo, Selecao } from '@/components/ui/Campo'
import { formatarReais } from '@/lib/formato'
import type {
  FaixaCapacidade,
  NegocioParaOrcamento,
  PorteEmpresa,
} from '@/lib/orcamentos'

/**
 * Abre um orçamento para um negócio.
 *
 * O porte já vem sugerido pelo cadastro da organização quando existe, mas
 * continua editável: na calculadora que o time usa hoje o porte sempre foi
 * escolha do momento da proposta, e nem toda empresa cadastrada tem o porte
 * preenchido.
 */
export function NovoOrcamento({
  negocios,
  portes,
  faixas,
  negocioFixo,
}: {
  negocios: NegocioParaOrcamento[]
  portes: PorteEmpresa[]
  faixas: FaixaCapacidade[]
  /** Quando aberto de dentro da ficha, o negócio já está decidido. */
  negocioFixo?: string
}) {
  const router = useRouter()
  const idBase = useId()
  const [aberto, setAberto] = useState(false)

  const inicial = negocioFixo ?? negocios[0]?.id ?? ''
  const [negocioId, setNegocioId] = useState(inicial)
  const faixaIdeal = faixas.find((f) => f.multiplicador === 1) ?? faixas[0]
  const [faixaId, setFaixaId] = useState(faixaIdeal?.id ?? '')

  const negocio = negocios.find((n) => n.id === negocioId)
  const [porteId, setPorteId] = useState(negocio?.porteEmpresaId ?? portes[0]?.id ?? '')
  const [porteTocado, setPorteTocado] = useState(false)

  const [criando, setCriando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  function trocarNegocio(id: string) {
    setNegocioId(id)
    // Só sobrescreve a sugestão enquanto o usuário não escolheu um porte à mão.
    if (!porteTocado) {
      const porteDoNegocio = negocios.find((n) => n.id === id)?.porteEmpresaId
      if (porteDoNegocio) setPorteId(porteDoNegocio)
    }
  }

  async function criar(evento: React.FormEvent) {
    evento.preventDefault()
    setCriando(true)
    setErro(null)
    try {
      const res = await fetch('/api/crm/precificacao/orcamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          negocioId,
          porteEmpresaId: porteId,
          faixaCapacidadeId: faixaId,
        }),
      })
      const dados = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErro(dados.mensagem ?? 'Não foi possível abrir o orçamento.')
        return
      }
      router.push(`/precificacao/${dados.orcamentoId}`)
      router.refresh()
    } catch {
      setErro('Falha de conexão ao abrir o orçamento.')
    } finally {
      setCriando(false)
    }
  }

  if (negocios.length === 0 && !negocioFixo) {
    return (
      <p className="text-xs text-tinta-500">
        Nenhum negócio aberto para orçar. Crie um no funil primeiro.
      </p>
    )
  }

  if (!aberto) {
    return (
      <Button tamanho="sm" onClick={() => setAberto(true)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="size-3.5">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Novo orçamento
      </Button>
    )
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Novo orçamento"
      className="fixed inset-0 z-50 flex items-end justify-center bg-tinta-900/40 p-0 text-left sm:items-center sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget && !criando) setAberto(false)
      }}
    >
      <form
        onSubmit={criar}
        className="surgir w-full max-w-md rounded-t-cartao bg-white p-5 shadow-lg sm:rounded-cartao"
      >
        <h2 className="font-titulo text-base font-bold text-tinta-900">Novo orçamento</h2>
        <p className="mt-0.5 text-sm text-tinta-500">
          Os serviços entram na tela seguinte.
        </p>

        <div className="mt-4 space-y-3.5">
          {!negocioFixo && (
            <Campo rotulo="Negócio" id={`${idBase}-negocio`}>
              <Selecao
                id={`${idBase}-negocio`}
                value={negocioId}
                onChange={(e) => trocarNegocio(e.target.value)}
                required
              >
                {negocios.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.titulo} · {n.organizacaoNome}
                  </option>
                ))}
              </Selecao>
            </Campo>
          )}

          <Campo
            rotulo="Porte do cliente"
            id={`${idBase}-porte`}
            dica={
              portes.find((p) => p.id === porteId)?.taxaHoraPadrao != null
                ? `${formatarReais(portes.find((p) => p.id === porteId)!.taxaHoraPadrao!)}/h`
                : 'sem taxa definida'
            }
          >
            <Selecao
              id={`${idBase}-porte`}
              value={porteId}
              onChange={(e) => {
                setPorteId(e.target.value)
                setPorteTocado(true)
              }}
              required
            >
              {portes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </Selecao>
          </Campo>

          <Campo rotulo="Capacidade do time agora" id={`${idBase}-faixa`}>
            <Selecao
              id={`${idBase}-faixa`}
              value={faixaId}
              onChange={(e) => setFaixaId(e.target.value)}
              required
            >
              {faixas.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label} · {f.multiplicador.toFixed(2)}×
                </option>
              ))}
            </Selecao>
          </Campo>
        </div>

        {erro && (
          <p role="alert" className="mt-3 rounded-lg bg-perigo-50 px-3 py-2 text-xs text-perigo-700">
            {erro}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <Button
            type="button"
            variante="secundario"
            tamanho="sm"
            onClick={() => setAberto(false)}
            disabled={criando}
          >
            Cancelar
          </Button>
          <Button type="submit" tamanho="sm" carregando={criando}>
            Abrir orçamento
          </Button>
        </div>
      </form>
    </div>
  )
}
