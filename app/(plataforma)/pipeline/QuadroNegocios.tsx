'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/cn'
import { formatarReais, formatarData, formatarNumero } from '@/lib/formato'
import type {
  ColunaDoQuadro,
  NegocioNoQuadro,
  MotivoPerda,
} from '@/lib/crm'

/** Cor da faixa no topo da coluna — o campo `cor` da etapa é um token, não um hex. */
const FAIXA_POR_COR: Record<string, string> = {
  verde: 'bg-verde-500',
  amarelo: 'bg-amarelo-400',
  neutro: 'bg-tinta-300',
}

function iniciais(nome: string) {
  return nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
}

export function QuadroNegocios({
  colunas,
  motivosPerda,
  emailDoMembro,
}: {
  colunas: ColunaDoQuadro[]
  motivosPerda: MotivoPerda[]
  emailDoMembro: string
}) {
  const router = useRouter()

  /**
   * Etapa "otimista" por negócio: o cartão se move na hora do drop e só sai
   * daqui quando o servidor confirma a mesma etapa. Sem isso o cartão volta
   * para a coluna antiga por um instante até o refresh chegar, e a tela pisca
   * como se o arraste tivesse falhado.
   */
  const [movidos, setMovidos] = useState<Record<string, string>>({})
  const [emVoo, setEmVoo] = useState<Set<string>>(new Set())
  const [erro, setErro] = useState<string | null>(null)
  const [colunaAlvo, setColunaAlvo] = useState<string | null>(null)
  const [arrastando, setArrastando] = useState<string | null>(null)
  const [soMeus, setSoMeus] = useState(false)
  const [fechando, setFechando] = useState<NegocioNoQuadro | null>(null)

  const todos = useMemo(
    () => colunas.flatMap((c) => c.negocios),
    [colunas],
  )

  // Descarta o override assim que o servidor concorda com ele — a limpeza é
  // por comparação, não por timer, então nunca fica preso se o refresh atrasar.
  useEffect(() => {
    setMovidos((anterior) => {
      const proximo = { ...anterior }
      let mudou = false
      for (const negocio of todos) {
        if (proximo[negocio.id] === negocio.etapaId) {
          delete proximo[negocio.id]
          mudou = true
        }
      }
      return mudou ? proximo : anterior
    })
  }, [todos])

  const visiveis = useMemo(() => {
    const filtrados = soMeus
      ? todos.filter((n) => n.donoEmail === emailDoMembro)
      : todos
    return colunas.map((coluna) => {
      const negocios = filtrados.filter(
        (n) => (movidos[n.id] ?? n.etapaId) === coluna.etapa.id,
      )
      return {
        ...coluna,
        negocios,
        valorTotal: negocios.reduce((s, n) => s + (n.valor ?? 0), 0),
      }
    })
  }, [colunas, todos, movidos, soMeus, emailDoMembro])

  async function moverPara(negocio: NegocioNoQuadro, etapaId: string) {
    const etapaAtual = movidos[negocio.id] ?? negocio.etapaId
    if (etapaAtual === etapaId) return

    setErro(null)
    setMovidos((m) => ({ ...m, [negocio.id]: etapaId }))
    setEmVoo((s) => new Set(s).add(negocio.id))

    try {
      const res = await fetch(`/api/crm/negocios/${negocio.id}/etapa`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ etapaId }),
      })
      if (!res.ok) {
        const dados = await res.json().catch(() => ({}))
        // Desfaz: o cartão volta para onde estava de verdade.
        setMovidos((m) => {
          const proximo = { ...m }
          delete proximo[negocio.id]
          return proximo
        })
        setErro(dados.mensagem ?? 'Não foi possível mover o negócio.')
        return
      }
      router.refresh()
    } catch {
      setMovidos((m) => {
        const proximo = { ...m }
        delete proximo[negocio.id]
        return proximo
      })
      setErro('Falha de conexão ao mover o negócio.')
    } finally {
      setEmVoo((s) => {
        const proximo = new Set(s)
        proximo.delete(negocio.id)
        return proximo
      })
    }
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            tamanho="sm"
            variante={soMeus ? 'primario' : 'secundario'}
            onClick={() => setSoMeus((v) => !v)}
            aria-pressed={soMeus}
          >
            {soMeus ? 'Vendo só os meus' : 'Ver só os meus'}
          </Button>
          <span className="text-xs text-tinta-500">
            {formatarNumero(visiveis.reduce((s, c) => s + c.negocios.length, 0))}{' '}
            negócios em aberto
          </span>
        </div>
        <p className="text-xs text-tinta-400">
          Arraste um cartão entre colunas, ou use o menu <strong>⋯</strong> nele.
        </p>
      </div>

      {erro && (
        <div
          role="alert"
          className="mb-4 flex items-start justify-between gap-3 rounded-cartao border border-perigo-100 bg-perigo-50 px-4 py-3 text-sm text-perigo-700"
        >
          <span>{erro}</span>
          <button
            onClick={() => setErro(null)}
            className="shrink-0 font-semibold hover:underline"
          >
            fechar
          </button>
        </div>
      )}

      {/* Rolagem horizontal fica no container do quadro: a página em si nunca
          rola de lado, mesmo com muitas etapas configuradas. */}
      <div className="rolagem-fina -mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        <div className="flex min-w-max gap-3">
          {visiveis.map((coluna) => {
            const alvo = colunaAlvo === coluna.etapa.id && arrastando !== null
            return (
              <section
                key={coluna.etapa.id}
                aria-label={coluna.etapa.nome}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                  setColunaAlvo(coluna.etapa.id)
                }}
                onDragLeave={(e) => {
                  // Só limpa quando o ponteiro sai da coluna inteira, não ao
                  // cruzar a borda de um cartão filho.
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setColunaAlvo((atual) =>
                      atual === coluna.etapa.id ? null : atual,
                    )
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  setColunaAlvo(null)
                  const id = e.dataTransfer.getData('text/plain')
                  const negocio = todos.find((n) => n.id === id)
                  if (negocio) void moverPara(negocio, coluna.etapa.id)
                }}
                className={cn(
                  'flex w-[17.5rem] shrink-0 flex-col rounded-cartao border bg-tinta-50/70 transition-colors',
                  alvo
                    ? 'border-verde-400 bg-verde-50/70'
                    : 'border-tinta-200',
                )}
              >
                <div
                  aria-hidden
                  className={cn(
                    'h-1 rounded-t-cartao',
                    FAIXA_POR_COR[coluna.etapa.cor ?? 'neutro'] ??
                      'bg-tinta-300',
                  )}
                />
                <header className="flex items-baseline justify-between gap-2 px-3.5 py-3">
                  <h3 className="truncate text-sm font-bold text-tinta-900">
                    {coluna.etapa.nome}
                  </h3>
                  <span className="numerico shrink-0 rounded-full bg-white px-2 py-0.5 text-xs font-bold text-tinta-600 ring-1 ring-tinta-200 ring-inset">
                    {coluna.negocios.length}
                  </span>
                </header>
                {coluna.valorTotal > 0 && (
                  <p className="numerico -mt-1.5 px-3.5 pb-2 text-xs font-semibold text-verde-700">
                    {formatarReais(coluna.valorTotal)}
                  </p>
                )}

                <div className="flex flex-1 flex-col gap-2 px-2.5 pb-2.5">
                  {coluna.negocios.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-tinta-200 px-3 py-6 text-center text-xs text-tinta-400">
                      {alvo ? 'Solte aqui' : 'Vazio'}
                    </p>
                  ) : (
                    coluna.negocios.map((negocio) => (
                      <Cartao
                        key={negocio.id}
                        negocio={negocio}
                        etapas={colunas.map((c) => c.etapa)}
                        etapaAtual={movidos[negocio.id] ?? negocio.etapaId}
                        salvando={emVoo.has(negocio.id)}
                        aoArrastar={setArrastando}
                        aoMover={(etapaId) => void moverPara(negocio, etapaId)}
                        aoFechar={() => setFechando(negocio)}
                      />
                    ))
                  )}
                </div>
              </section>
            )
          })}
        </div>
      </div>

      {fechando && (
        <DialogoFechar
          negocio={fechando}
          motivosPerda={motivosPerda}
          aoCancelar={() => setFechando(null)}
          aoConcluir={() => {
            setFechando(null)
            router.refresh()
          }}
        />
      )}
    </>
  )
}

function Cartao({
  negocio,
  etapas,
  etapaAtual,
  salvando,
  aoArrastar,
  aoMover,
  aoFechar,
}: {
  negocio: NegocioNoQuadro
  etapas: { id: string; nome: string }[]
  etapaAtual: string
  salvando: boolean
  aoArrastar: (id: string | null) => void
  aoMover: (etapaId: string) => void
  aoFechar: () => void
}) {
  const [menuAberto, setMenuAberto] = useState(false)

  return (
    <article
      draggable={!salvando}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', negocio.id)
        e.dataTransfer.effectAllowed = 'move'
        aoArrastar(negocio.id)
      }}
      onDragEnd={() => aoArrastar(null)}
      className={cn(
        'group relative rounded-lg border border-tinta-200 bg-white p-3 shadow-sm transition-shadow',
        salvando ? 'opacity-60' : 'cursor-grab hover:shadow-cartao active:cursor-grabbing',
      )}
    >
      <div className="flex items-start justify-between gap-1.5">
        <p className="min-w-0 flex-1 text-sm leading-snug font-semibold text-tinta-900">
          {negocio.titulo}
        </p>
        {salvando ? (
          <Spinner className="mt-0.5 size-3.5 shrink-0 text-verde-600" />
        ) : (
          <div className="relative shrink-0">
            <button
              onClick={() => setMenuAberto((v) => !v)}
              aria-label={`Ações de ${negocio.titulo}`}
              aria-expanded={menuAberto}
              className="-mt-1 -mr-1 rounded p-1 text-tinta-400 transition-colors hover:bg-tinta-100 hover:text-tinta-700"
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="currentColor">
                <circle cx="5" cy="12" r="1.6" />
                <circle cx="12" cy="12" r="1.6" />
                <circle cx="19" cy="12" r="1.6" />
              </svg>
            </button>

            {menuAberto && (
              <>
                {/* Camada de fechamento: clique fora fecha o menu sem
                    precisar de listener global no documento. */}
                <button
                  aria-hidden
                  tabIndex={-1}
                  onClick={() => setMenuAberto(false)}
                  className="fixed inset-0 z-10 cursor-default"
                />
                <div
                  role="menu"
                  className="surgir absolute right-0 z-20 mt-1 w-52 rounded-lg border border-tinta-200 bg-white py-1 text-left shadow-lg"
                >
                  <p className="px-3 py-1.5 text-[0.65rem] font-semibold tracking-wide text-tinta-400 uppercase">
                    Mover para
                  </p>
                  {etapas.map((etapa) => (
                    <button
                      key={etapa.id}
                      role="menuitem"
                      disabled={etapa.id === etapaAtual}
                      onClick={() => {
                        setMenuAberto(false)
                        aoMover(etapa.id)
                      }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-tinta-700 transition-colors hover:bg-tinta-50 disabled:cursor-default disabled:font-semibold disabled:text-verde-700 disabled:hover:bg-transparent"
                    >
                      {etapa.id === etapaAtual && (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="size-3">
                          <path d="m5 13 4 4L19 7" />
                        </svg>
                      )}
                      <span className={etapa.id === etapaAtual ? '' : 'pl-5'}>
                        {etapa.nome}
                      </span>
                    </button>
                  ))}
                  <div className="my-1 border-t border-tinta-100" />
                  <button
                    role="menuitem"
                    onClick={() => {
                      setMenuAberto(false)
                      aoFechar()
                    }}
                    className="w-full px-3 py-1.5 text-left text-xs font-semibold text-tinta-700 transition-colors hover:bg-tinta-50"
                  >
                    Fechar negócio…
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <p className="mt-1 truncate text-xs text-tinta-500">
        {negocio.organizacaoNome}
      </p>

      {(negocio.valor != null || negocio.produtoServico) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {negocio.valor != null && (
            <span className="numerico text-sm font-bold text-verde-700">
              {formatarReais(negocio.valor)}
            </span>
          )}
          {negocio.produtoServico && (
            <Badge tom="contorno">{negocio.produtoServico}</Badge>
          )}
        </div>
      )}

      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-tinta-100 pt-2">
        <span
          title={`${negocio.donoNome}${negocio.contatoNome ? ` · contato: ${negocio.contatoNome}` : ''}`}
          className="flex min-w-0 items-center gap-1.5"
        >
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-tinta-200 text-[0.6rem] font-bold text-tinta-600">
            {iniciais(negocio.donoNome) || '?'}
          </span>
          <span className="truncate text-[0.7rem] text-tinta-500">
            {negocio.contatoNome ?? negocio.donoNome}
          </span>
        </span>

        {negocio.previsaoFechamento && (
          <Badge tom={negocio.atrasado ? 'perigo' : 'contorno'}>
            {negocio.atrasado ? 'venceu ' : ''}
            {formatarData(negocio.previsaoFechamento)}
          </Badge>
        )}
      </div>
    </article>
  )
}

function DialogoFechar({
  negocio,
  motivosPerda,
  aoCancelar,
  aoConcluir,
}: {
  negocio: NegocioNoQuadro
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
      const res = await fetch(`/api/crm/negocios/${negocio.id}/fechar`, {
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
      aria-label={`Fechar negócio ${negocio.titulo}`}
      className="fixed inset-0 z-50 flex items-end justify-center bg-tinta-900/40 p-0 text-left sm:items-center sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) aoCancelar()
      }}
    >
      <div className="surgir w-full max-w-md rounded-t-cartao bg-white p-5 shadow-lg sm:rounded-cartao">
        <h2 className="font-titulo text-base font-bold text-tinta-900">
          Fechar negócio
        </h2>
        <p className="mt-0.5 truncate text-sm text-tinta-500">
          {negocio.titulo} · {negocio.organizacaoNome}
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
            <select
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="mt-1 h-10 w-full rounded-lg border border-tinta-200 bg-white px-3 text-sm text-tinta-900 focus:border-verde-500 focus:outline-none"
            >
              <option value="">Escolha…</option>
              {motivosPerda.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </select>
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
          <Button variante="secundario" tamanho="sm" onClick={aoCancelar} disabled={salvando}>
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
