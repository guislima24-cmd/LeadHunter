'use client'
import { useId, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Campo, Entrada, AreaTexto, Selecao } from '@/components/ui/Campo'
import { Card } from '@/components/ui/Card'
import { EstadoVazio } from '@/components/ui/Estado'
import { BarrasDeMeta } from '@/components/crm/BarrasDeMeta'
import {
  ROTULO_METRICA,
  type MetaComProgresso,
  type MetricaFonte,
} from '@/lib/tipos-insights'

const FONTES: MetricaFonte[] = [
  'contratos_fechados',
  'faturamento_ganho',
  'reunioes_realizadas',
  'prospeccoes_realizadas',
  'negocios_criados',
  'manual',
]

interface Rascunho {
  id?: string
  metaPaiId: string
  nome: string
  descricao: string
  metricaFonte: MetricaFonte
  valorAlvo: string
  valorAtual: string
  unidade: string
  periodoInicio: string
  periodoFim: string
}

function rascunhoVazio(): Rascunho {
  const hoje = new Date()
  const inicio = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1))
  const fim = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + 1, 0))
  return {
    metaPaiId: '',
    nome: '',
    descricao: '',
    metricaFonte: 'contratos_fechados',
    valorAlvo: '',
    valorAtual: '0',
    unidade: '',
    periodoInicio: inicio.toISOString().slice(0, 10),
    periodoFim: fim.toISOString().slice(0, 10),
  }
}

function paraRascunho(meta: MetaComProgresso): Rascunho {
  return {
    id: meta.id,
    metaPaiId: meta.metaPaiId ?? '',
    nome: meta.nome,
    descricao: meta.descricao ?? '',
    metricaFonte: meta.metricaFonte,
    valorAlvo: String(meta.valorAlvo),
    valorAtual: String(meta.valorAtual),
    unidade: meta.unidade ?? '',
    periodoInicio: meta.periodoInicio,
    periodoFim: meta.periodoFim,
  }
}

/**
 * Criação e edição de metas — só admin chega aqui.
 *
 * Uma meta pode ser filha de outra: é assim que Objetivo → Resultados-Chave
 * se monta. O seletor de pai lista só as metas de raiz, porque um OKR de três
 * níveis é uma planilha, não uma meta.
 */
export function GerenciadorMetas({
  metas,
  podeEditar,
}: {
  metas: MetaComProgresso[]
  podeEditar: boolean
}) {
  const router = useRouter()
  const idBase = useId()
  const [rascunho, setRascunho] = useState<Rascunho | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const derivada = rascunho != null && rascunho.metricaFonte !== 'manual'

  async function salvar(evento: React.FormEvent) {
    evento.preventDefault()
    if (!rascunho) return
    setSalvando(true)
    setErro(null)

    const corpo = {
      metaPaiId: rascunho.metaPaiId || null,
      nome: rascunho.nome,
      descricao: rascunho.descricao,
      metricaFonte: rascunho.metricaFonte,
      valorAlvo: Number(rascunho.valorAlvo),
      valorAtual: Number(rascunho.valorAtual) || 0,
      unidade: rascunho.unidade,
      periodoInicio: rascunho.periodoInicio,
      periodoFim: rascunho.periodoFim,
    }

    try {
      const res = await fetch(
        rascunho.id
          ? `/api/crm/insights/metas/${rascunho.id}`
          : '/api/crm/insights/metas',
        {
          method: rascunho.id ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(corpo),
        },
      )
      const dados = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErro(dados.mensagem ?? 'Não foi possível salvar a meta.')
        return
      }
      setRascunho(null)
      router.refresh()
    } catch {
      setErro('Falha de conexão ao salvar a meta.')
    } finally {
      setSalvando(false)
    }
  }

  async function apagar(id: string) {
    setSalvando(true)
    setErro(null)
    try {
      const res = await fetch(`/api/crm/insights/metas/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const dados = await res.json().catch(() => ({}))
        setErro(dados.mensagem ?? 'Não foi possível apagar a meta.')
        return
      }
      setRascunho(null)
      router.refresh()
    } catch {
      setErro('Falha de conexão.')
    } finally {
      setSalvando(false)
    }
  }

  const raizes = metas.filter((m) => m.metaPaiId == null)

  return (
    <>
      {podeEditar && (
        <div className="mb-5 flex justify-end">
          <Button onClick={() => setRascunho(rascunhoVazio())}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="size-3.5">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Nova meta
          </Button>
        </div>
      )}

      {erro && !rascunho && (
        <p role="alert" className="mb-4 rounded-lg bg-perigo-50 px-3 py-2 text-xs text-perigo-700">
          {erro}
        </p>
      )}

      {metas.length === 0 ? (
        <Card>
          <EstadoVazio
            titulo="Nenhuma meta cadastrada"
            descricao={
              podeEditar
                ? 'Uma meta pode ser simples (“20 contratos no trimestre”) ou um Objetivo com Resultados-Chave abaixo dele. O progresso das metas ligadas a uma fonte do CRM é calculado sozinho — não precisa atualizar à mão.'
                : 'Nenhum administrador cadastrou metas ainda.'
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {raizes.map((meta) => (
            <Card key={meta.id}>
              {podeEditar && (
                <div className="flex justify-end gap-2 border-b border-tinta-100 px-5 py-2">
                  <button
                    type="button"
                    onClick={() => setRascunho(paraRascunho(meta))}
                    className="text-xs font-semibold text-tinta-600 hover:text-verde-700 hover:underline"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => apagar(meta.id)}
                    className="text-xs font-semibold text-tinta-600 hover:text-perigo-700 hover:underline"
                  >
                    Apagar
                  </button>
                </div>
              )}
              <BarrasDeMeta metas={[meta]} />
              {podeEditar && meta.filhas.length === 0 && (
                <div className="border-t border-tinta-100 px-5 py-2">
                  <button
                    type="button"
                    onClick={() =>
                      setRascunho({ ...rascunhoVazio(), metaPaiId: meta.id })
                    }
                    className="text-xs font-semibold text-verde-700 hover:underline"
                  >
                    + Resultado-Chave para este objetivo
                  </button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {rascunho && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={rascunho.id ? 'Editar meta' : 'Nova meta'}
          className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-tinta-900/40 p-0 text-left sm:items-center sm:p-6"
          onClick={(e) => {
            if (e.target === e.currentTarget && !salvando) setRascunho(null)
          }}
        >
          <form
            onSubmit={salvar}
            className="surgir my-auto w-full max-w-lg rounded-t-cartao bg-white p-5 shadow-lg sm:rounded-cartao"
          >
            <h2 className="font-titulo text-base font-bold text-tinta-900">
              {rascunho.id ? 'Editar meta' : 'Nova meta'}
            </h2>

            <div className="mt-4 space-y-3.5">
              <Campo rotulo="Nome" id={`${idBase}-nome`}>
                <Entrada
                  id={`${idBase}-nome`}
                  value={rascunho.nome}
                  onChange={(e) =>
                    setRascunho({ ...rascunho, nome: e.target.value })
                  }
                  placeholder="Ex.: Fechar 12 contratos no trimestre"
                  required
                />
              </Campo>

              <Campo rotulo="Descrição" id={`${idBase}-desc`} dica="opcional">
                <AreaTexto
                  id={`${idBase}-desc`}
                  rows={2}
                  value={rascunho.descricao}
                  onChange={(e) =>
                    setRascunho({ ...rascunho, descricao: e.target.value })
                  }
                />
              </Campo>

              {raizes.length > 0 && (
                <Campo
                  rotulo="Faz parte de qual objetivo"
                  id={`${idBase}-pai`}
                  dica="deixe vazio para uma meta solta"
                >
                  <Selecao
                    id={`${idBase}-pai`}
                    value={rascunho.metaPaiId}
                    onChange={(e) =>
                      setRascunho({ ...rascunho, metaPaiId: e.target.value })
                    }
                  >
                    <option value="">Nenhum — é uma meta própria</option>
                    {raizes
                      .filter((m) => m.id !== rascunho.id)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.nome}
                        </option>
                      ))}
                  </Selecao>
                </Campo>
              )}

              <Campo
                rotulo="De onde vem o progresso"
                id={`${idBase}-fonte`}
                dica={derivada ? 'calculado sozinho' : 'você atualiza à mão'}
              >
                <Selecao
                  id={`${idBase}-fonte`}
                  value={rascunho.metricaFonte}
                  onChange={(e) =>
                    setRascunho({
                      ...rascunho,
                      metricaFonte: e.target.value as MetricaFonte,
                    })
                  }
                >
                  {FONTES.map((f) => (
                    <option key={f} value={f}>
                      {ROTULO_METRICA[f]}
                    </option>
                  ))}
                </Selecao>
              </Campo>

              <div className="grid grid-cols-2 gap-3">
                <Campo rotulo="Alvo" id={`${idBase}-alvo`}>
                  <Entrada
                    id={`${idBase}-alvo`}
                    type="number"
                    min="0"
                    step="any"
                    value={rascunho.valorAlvo}
                    onChange={(e) =>
                      setRascunho({ ...rascunho, valorAlvo: e.target.value })
                    }
                    required
                  />
                </Campo>

                {derivada ? (
                  <Campo rotulo="Unidade" id={`${idBase}-un`} dica="opcional">
                    <Entrada
                      id={`${idBase}-un`}
                      value={rascunho.unidade}
                      onChange={(e) =>
                        setRascunho({ ...rascunho, unidade: e.target.value })
                      }
                      placeholder="contratos, reuniões…"
                    />
                  </Campo>
                ) : (
                  <Campo rotulo="Valor atual" id={`${idBase}-atual`}>
                    <Entrada
                      id={`${idBase}-atual`}
                      type="number"
                      step="any"
                      value={rascunho.valorAtual}
                      onChange={(e) =>
                        setRascunho({ ...rascunho, valorAtual: e.target.value })
                      }
                    />
                  </Campo>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Campo rotulo="Início do período" id={`${idBase}-ini`}>
                  <Entrada
                    id={`${idBase}-ini`}
                    type="date"
                    value={rascunho.periodoInicio}
                    onChange={(e) =>
                      setRascunho({ ...rascunho, periodoInicio: e.target.value })
                    }
                    required
                  />
                </Campo>
                <Campo rotulo="Fim do período" id={`${idBase}-fim`}>
                  <Entrada
                    id={`${idBase}-fim`}
                    type="date"
                    min={rascunho.periodoInicio}
                    value={rascunho.periodoFim}
                    onChange={(e) =>
                      setRascunho({ ...rascunho, periodoFim: e.target.value })
                    }
                    required
                  />
                </Campo>
              </div>

              {derivada && (
                <p className="rounded-lg bg-tinta-50 px-3 py-2 text-xs leading-relaxed text-tinta-600">
                  O progresso desta meta é lido direto do CRM toda vez que a
                  tela abre — não existe campo para atualizar à mão, e o número
                  nunca fica velho.
                </p>
              )}
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
                onClick={() => setRascunho(null)}
                disabled={salvando}
              >
                Cancelar
              </Button>
              <Button type="submit" tamanho="sm" carregando={salvando}>
                Salvar meta
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
