'use client'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Campo, Entrada, AreaTexto, Selecao } from '@/components/ui/Campo'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/cn'
import { formatarDataHora, tempoRelativo } from '@/lib/formato'
import type { Atividade, PassagemDeEtapa, TipoAtividade } from '@/lib/crm'

/**
 * Histórico do negócio: atividades registradas pelo time e passagens de etapa,
 * numa lista só.
 *
 * As duas coisas vêm de tabelas diferentes mas respondem à mesma pergunta —
 * "o que aconteceu com esse negócio, e quando" — e separar em duas listas
 * obrigaria a ler as duas em paralelo comparando datas para reconstruir a
 * ordem dos fatos.
 */

type ItemLinha =
  | { tipo: 'atividade'; em: string; atividade: Atividade }
  | { tipo: 'etapa'; em: string; passagem: PassagemDeEtapa }

const ICONES: Record<string, React.ReactNode> = {
  phone: <path d="M6.5 3.5h3l1.5 4-2 1.5a11 11 0 0 0 5 5l1.5-2 4 1.5v3a1.5 1.5 0 0 1-1.6 1.5A15.5 15.5 0 0 1 5 5.1 1.5 1.5 0 0 1 6.5 3.5Z" />,
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 6.2a3 3 0 0 1 0 5.6M17.5 19a5.4 5.4 0 0 0-2-4.2" />
    </>
  ),
  'check-square': (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </>
  ),
  flag: <path d="M6 21V4h11l-2 3.5L17 11H6" />,
  mail: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
      <path d="m4 7 8 5.5L20 7" />
    </>
  ),
  coffee: (
    <>
      <path d="M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8Z" />
      <path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17M7 3v2M11 3v2" />
    </>
  ),
}

function Icone({ nome }: { nome: string | null }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-3.5"
    >
      {ICONES[nome ?? ''] ?? <circle cx="12" cy="12" r="7" />}
    </svg>
  )
}

export function LinhaDoTempo({
  negocioId,
  atividades,
  historico,
  tipos,
  fechado,
}: {
  negocioId: string
  atividades: Atividade[]
  historico: PassagemDeEtapa[]
  tipos: TipoAtividade[]
  fechado: boolean
}) {
  const router = useRouter()
  const [erro, setErro] = useState<string | null>(null)
  const [alternando, setAlternando] = useState<Set<string>>(new Set())

  const iconePorTipo = useMemo(
    () => new Map(tipos.map((t) => [t.id, t.icone])),
    [tipos],
  )

  const linha = useMemo<ItemLinha[]>(() => {
    const itens: ItemLinha[] = [
      ...atividades.map(
        (a): ItemLinha => ({ tipo: 'atividade', em: a.criadoEm, atividade: a }),
      ),
      ...historico.map(
        (h): ItemLinha => ({ tipo: 'etapa', em: h.entrouEm, passagem: h }),
      ),
    ]
    return itens.sort((a, b) => b.em.localeCompare(a.em))
  }, [atividades, historico])

  const pendentes = atividades.filter((a) => !a.concluida)

  async function alternarConclusao(atividade: Atividade) {
    setErro(null)
    setAlternando((s) => new Set(s).add(atividade.id))
    try {
      const res = await fetch(`/api/crm/atividades/${atividade.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ concluida: !atividade.concluida }),
      })
      if (!res.ok) {
        const dados = await res.json().catch(() => ({}))
        setErro(dados.mensagem ?? 'Não foi possível atualizar a atividade.')
        return
      }
      router.refresh()
    } catch {
      setErro('Falha de conexão ao atualizar a atividade.')
    } finally {
      setAlternando((s) => {
        const proximo = new Set(s)
        proximo.delete(atividade.id)
        return proximo
      })
    }
  }

  return (
    <div>
      <NovaAtividade
        negocioId={negocioId}
        tipos={tipos}
        fechado={fechado}
        aoCriar={() => router.refresh()}
      />

      {erro && (
        <p
          role="alert"
          className="mx-5 mt-4 rounded-lg bg-perigo-50 px-3 py-2 text-xs text-perigo-700"
        >
          {erro}
        </p>
      )}

      {pendentes.length > 0 && (
        <p className="border-t border-tinta-100 px-5 pt-3 text-xs text-tinta-500">
          {pendentes.length === 1
            ? '1 atividade em aberto'
            : `${pendentes.length} atividades em aberto`}
        </p>
      )}

      <ol className="space-y-0 px-5 py-4">
        {linha.map((item, indice) => (
          <li key={item.tipo === 'atividade' ? item.atividade.id : `${item.em}-${indice}`}>
            <div className="flex gap-3">
              {/* Fio da linha do tempo: some no último item para não sobrar
                  um traço pendurado embaixo do círculo final. */}
              <div className="flex w-6 shrink-0 flex-col items-center">
                <span
                  className={cn(
                    'flex size-6 items-center justify-center rounded-full',
                    item.tipo === 'etapa'
                      ? 'bg-verde-50 text-verde-700 ring-1 ring-verde-200 ring-inset'
                      : item.atividade.concluida
                        ? 'bg-tinta-100 text-tinta-500'
                        : 'bg-amarelo-50 text-amarelo-700 ring-1 ring-amarelo-200 ring-inset',
                  )}
                >
                  {item.tipo === 'etapa' ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="size-3">
                      <path d="M5 12h13m0 0-4.5-4.5M18 12l-4.5 4.5" />
                    </svg>
                  ) : (
                    <Icone nome={iconePorTipo.get(item.atividade.tipoId) ?? null} />
                  )}
                </span>
                {indice < linha.length - 1 && (
                  <span aria-hidden className="w-px flex-1 bg-tinta-200" />
                )}
              </div>

              <div className="min-w-0 flex-1 pb-5">
                {item.tipo === 'etapa' ? (
                  <>
                    <p className="text-sm text-tinta-800">
                      Entrou em{' '}
                      <strong className="font-semibold">
                        {item.passagem.etapaNome}
                      </strong>
                    </p>
                    <p className="mt-0.5 text-xs text-tinta-500">
                      {item.passagem.alteradoPorEmail} ·{' '}
                      <time dateTime={item.em} title={formatarDataHora(item.em)}>
                        {tempoRelativo(item.em)}
                      </time>
                      {item.passagem.saiuEm == null && (
                        <span className="ml-1.5 font-semibold text-verde-700">
                          etapa atual
                        </span>
                      )}
                    </p>
                  </>
                ) : (
                  <ItemAtividade
                    atividade={item.atividade}
                    salvando={alternando.has(item.atividade.id)}
                    aoAlternar={() => void alternarConclusao(item.atividade)}
                  />
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

function ItemAtividade({
  atividade,
  salvando,
  aoAlternar,
}: {
  atividade: Atividade
  salvando: boolean
  aoAlternar: () => void
}) {
  return (
    <>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <button
          onClick={aoAlternar}
          disabled={salvando}
          aria-pressed={atividade.concluida}
          title={
            atividade.concluida ? 'Reabrir atividade' : 'Marcar como concluída'
          }
          className={cn(
            'text-left text-sm font-semibold transition-colors',
            atividade.concluida
              ? 'text-tinta-400 line-through hover:text-tinta-600'
              : 'text-tinta-900 hover:text-verde-700',
          )}
        >
          {atividade.titulo}
        </button>
        {salvando && <Spinner className="size-3 text-verde-600" />}
        <Badge tom="contorno">{atividade.tipoNome}</Badge>
        {atividade.vencida && <Badge tom="perigo">vencida</Badge>}
      </div>

      {atividade.descricao && (
        <p className="mt-1 text-xs leading-relaxed whitespace-pre-line text-tinta-600">
          {atividade.descricao}
        </p>
      )}

      <p className="mt-1 text-xs text-tinta-500">
        {atividade.responsavelEmail} ·{' '}
        <time dateTime={atividade.criadoEm} title={formatarDataHora(atividade.criadoEm)}>
          {tempoRelativo(atividade.criadoEm)}
        </time>
        {atividade.dataPrazo && (
          <> · prazo {formatarDataHora(atividade.dataPrazo)}</>
        )}
        {atividade.concluida && atividade.concluidaEm && (
          <> · concluída {tempoRelativo(atividade.concluidaEm)}</>
        )}
      </p>
    </>
  )
}

function NovaAtividade({
  negocioId,
  tipos,
  fechado,
  aoCriar,
}: {
  negocioId: string
  tipos: TipoAtividade[]
  fechado: boolean
  aoCriar: () => void
}) {
  const [aberto, setAberto] = useState(false)
  const [tipoId, setTipoId] = useState(tipos[0]?.id ?? '')
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [prazo, setPrazo] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function criar(evento: React.FormEvent) {
    evento.preventDefault()
    setSalvando(true)
    setErro(null)
    try {
      const res = await fetch('/api/crm/atividades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          negocioId,
          tipoId,
          titulo,
          descricao: descricao || null,
          // `datetime-local` não tem fuso; o navegador interpreta no fuso do
          // usuário, que é o que se quer para "prazo às 15h".
          dataPrazo: prazo ? new Date(prazo).toISOString() : null,
        }),
      })
      const dados = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErro(dados.mensagem ?? 'Não foi possível registrar a atividade.')
        return
      }
      setTitulo('')
      setDescricao('')
      setPrazo('')
      setAberto(false)
      aoCriar()
    } catch {
      setErro('Falha de conexão ao registrar a atividade.')
    } finally {
      setSalvando(false)
    }
  }

  if (tipos.length === 0) {
    return (
      <p className="border-b border-tinta-100 px-5 py-4 text-xs text-tinta-500">
        Nenhum tipo de atividade está configurado — peça a um admin.
      </p>
    )
  }

  if (!aberto) {
    return (
      <div className="border-b border-tinta-100 px-5 py-3.5">
        <Button
          tamanho="sm"
          variante="secundario"
          onClick={() => setAberto(true)}
          larguraTotal
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="size-3.5">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Registrar atividade
        </Button>
        {fechado && (
          <p className="mt-2 text-xs text-tinta-500">
            O negócio está fechado, mas ainda dá para registrar o que
            aconteceu depois — pós-venda, renovação, follow-up.
          </p>
        )}
      </div>
    )
  }

  return (
    <form
      onSubmit={criar}
      className="space-y-3 border-b border-tinta-100 bg-tinta-50/60 px-5 py-4"
    >
      <div className="grid gap-3 sm:grid-cols-[9rem_1fr]">
        <Campo rotulo="Tipo" id="atividade-tipo">
          <Selecao
            id="atividade-tipo"
            value={tipoId}
            onChange={(e) => setTipoId(e.target.value)}
          >
            {tipos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </Selecao>
        </Campo>
        <Campo rotulo="O que aconteceu (ou vai acontecer)" id="atividade-titulo">
          <Entrada
            id="atividade-titulo"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex.: Reunião de diagnóstico com o Diretor"
            required
            autoFocus
          />
        </Campo>
      </div>

      <Campo rotulo="Detalhes" id="atividade-descricao" dica="opcional">
        <AreaTexto
          id="atividade-descricao"
          rows={3}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="O que foi combinado, objeções, próximos passos…"
        />
      </Campo>

      <Campo
        rotulo="Prazo"
        id="atividade-prazo"
        dica="opcional — entra no lembrete diário"
      >
        <Entrada
          id="atividade-prazo"
          type="datetime-local"
          value={prazo}
          onChange={(e) => setPrazo(e.target.value)}
        />
      </Campo>

      {erro && (
        <p className="rounded-lg bg-perigo-50 px-3 py-2 text-xs text-perigo-700">
          {erro}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variante="secundario"
          tamanho="sm"
          onClick={() => setAberto(false)}
          disabled={salvando}
        >
          Cancelar
        </Button>
        <Button type="submit" tamanho="sm" carregando={salvando}>
          Registrar
        </Button>
      </div>
    </form>
  )
}
