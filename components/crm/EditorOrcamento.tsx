'use client'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardCabecalho } from '@/components/ui/Card'
import { Campo, Entrada, Selecao } from '@/components/ui/Campo'
import { cn } from '@/lib/cn'
import { formatarReais, formatarNumero, formatarPercentual } from '@/lib/formato'
import {
  calcularOrcamento,
  compararComHistorico,
  respostasIniciais,
  type Dimensao,
  type EntradaItem,
  type ParametrosGlobais,
} from '@/lib/precificacao'
import type {
  CatalogoPrecificacao,
  OrcamentoCompleto,
} from '@/lib/orcamentos'

/**
 * A calculadora de orçamento.
 *
 * Recalcula tudo a cada tecla com a mesma função que o servidor usa ao salvar
 * (`lib/precificacao.ts`) — a prévia e o valor gravado não podem divergir, e
 * duas implementações da mesma conta é exatamente como divergem. O que o
 * servidor não aceita é o *resultado* vindo daqui: ele recalcula com os
 * parâmetros dele.
 *
 * O formulário de cada serviço é montado a partir das dimensões cadastradas,
 * não de um componente por módulo. É o que faz um serviço novo com regra
 * própria aparecer aqui por cadastro, sem deploy.
 */

interface ItemLocal extends EntradaItem {
  chave: string
}

export function EditorOrcamento({
  orcamento,
  catalogo,
}: {
  orcamento: OrcamentoCompleto
  catalogo: CatalogoPrecificacao
}) {
  const router = useRouter()
  const somenteLeitura = orcamento.status === 'finalizado'

  const [porteId, setPorteId] = useState(orcamento.porteEmpresaId)
  const [faixaId, setFaixaId] = useState(orcamento.faixaCapacidadeId)
  const [itens, setItens] = useState<ItemLocal[]>(() =>
    orcamento.itens.map((i, n) => ({
      chave: `${i.id}-${n}`,
      produtoServicoId: i.produtoServicoId,
      consultores: i.consultores,
      semanas: i.semanas,
      custosExtras: i.custosExtras,
      respostas: i.respostas,
    })),
  )
  const [servicoParaAdicionar, setServicoParaAdicionar] = useState(
    catalogo.servicos[0]?.id ?? '',
  )
  const [salvando, setSalvando] = useState(false)
  const [finalizando, setFinalizando] = useState(false)
  const [nivel, setNivel] = useState<'ideal' | 'aceitavel' | 'ponto_equilibrio'>(
    orcamento.nivelProposto ?? 'ideal',
  )
  const [erro, setErro] = useState<string | null>(null)
  const [salvo, setSalvo] = useState(false)

  const porte = catalogo.portes.find((p) => p.id === porteId)
  const faixa = catalogo.faixas.find((f) => f.id === faixaId)
  const taxaHora = porte?.taxaHoraPadrao ?? 0

  const resultado = useMemo(
    () =>
      calcularOrcamento(
        itens,
        catalogo.dimensoes,
        taxaHora,
        faixa?.multiplicador ?? 1,
        catalogo.parametros,
      ),
    [itens, catalogo.dimensoes, catalogo.parametros, taxaHora, faixa],
  )

  function alterarItem(chave: string, mudanca: Partial<EntradaItem>) {
    setSalvo(false)
    setItens((atual) =>
      atual.map((i) => (i.chave === chave ? { ...i, ...mudanca } : i)),
    )
  }

  function adicionar() {
    const servico = catalogo.servicos.find((s) => s.id === servicoParaAdicionar)
    if (!servico) return
    setSalvo(false)
    setItens((atual) => [
      ...atual,
      {
        chave: `novo-${Date.now()}-${atual.length}`,
        produtoServicoId: servico.id,
        consultores: servico.consultoresPadrao,
        semanas: servico.semanasPadrao,
        custosExtras: 0,
        respostas: respostasIniciais(servico.id, catalogo.dimensoes),
      },
    ])
  }

  async function salvar() {
    setSalvando(true)
    setErro(null)
    try {
      const res = await fetch(`/api/crm/precificacao/orcamentos/${orcamento.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          porteEmpresaId: porteId,
          faixaCapacidadeId: faixaId,
          itens: itens.map((i) => ({
            produtoServicoId: i.produtoServicoId,
            consultores: i.consultores,
            semanas: i.semanas,
            custosExtras: i.custosExtras,
            respostas: i.respostas,
          })),
        }),
      })
      const dados = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErro(dados.mensagem ?? 'Não foi possível salvar o orçamento.')
        return
      }
      setSalvo(true)
      router.refresh()
    } catch {
      setErro('Falha de conexão ao salvar o orçamento.')
    } finally {
      setSalvando(false)
    }
  }

  async function finalizar() {
    setFinalizando(true)
    setErro(null)
    try {
      // Salva antes: finalizar leva o valor para o negócio, e seria péssimo
      // levar um número diferente do que está na tela.
      await salvar()
      const res = await fetch(`/api/crm/precificacao/orcamentos/${orcamento.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nivelProposto: nivel }),
      })
      const dados = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErro(dados.mensagem ?? 'Não foi possível finalizar o orçamento.')
        return
      }
      router.refresh()
    } catch {
      setErro('Falha de conexão ao finalizar o orçamento.')
    } finally {
      setFinalizando(false)
    }
  }

  const semTaxa = porte != null && porte.taxaHoraPadrao == null

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
      <div className="space-y-6">
        <Card>
          <CardCabecalho
            titulo="Cabeçalho"
            descricao="Valem para o orçamento inteiro: a taxa/hora sai do porte, e a capacidade multiplica todos os itens."
          />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Campo
              rotulo="Porte do cliente"
              id="orc-porte"
              dica={porte?.taxaHoraPadrao != null ? `${formatarReais(porte.taxaHoraPadrao)}/h` : undefined}
            >
              <Selecao
                id="orc-porte"
                value={porteId}
                disabled={somenteLeitura}
                onChange={(e) => {
                  setPorteId(e.target.value)
                  setSalvo(false)
                }}
              >
                {catalogo.portes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </Selecao>
            </Campo>
            <Campo
              rotulo="Capacidade do time"
              id="orc-faixa"
              dica={faixa ? `${faixa.multiplicador.toFixed(2)}×` : undefined}
            >
              <Selecao
                id="orc-faixa"
                value={faixaId}
                disabled={somenteLeitura}
                onChange={(e) => {
                  setFaixaId(e.target.value)
                  setSalvo(false)
                }}
              >
                {catalogo.faixas.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </Selecao>
            </Campo>
          </div>
          {semTaxa && (
            <p className="mx-5 mb-5 rounded-lg bg-amarelo-50 px-3 py-2 text-xs text-amarelo-700">
              Este porte não tem taxa/hora definida — o orçamento sai zerado até
              um admin preenchê-la na tela de referência.
            </p>
          )}
        </Card>

        {itens.map((item, indice) => (
          <ItemDoOrcamento
            key={item.chave}
            item={item}
            indice={indice}
            catalogo={catalogo}
            resultado={resultado.itens[indice]}
            somenteLeitura={somenteLeitura}
            aoAlterar={(m) => alterarItem(item.chave, m)}
            aoRemover={() => {
              setSalvo(false)
              setItens((a) => a.filter((i) => i.chave !== item.chave))
            }}
          />
        ))}

        {!somenteLeitura && (
          <Card>
            <div className="flex flex-wrap items-end gap-3 p-5">
              <Campo rotulo="Adicionar serviço ao orçamento" id="orc-add" >
                <Selecao
                  id="orc-add"
                  value={servicoParaAdicionar}
                  onChange={(e) => setServicoParaAdicionar(e.target.value)}
                  className="min-w-64"
                >
                  {catalogo.servicos.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome}
                    </option>
                  ))}
                </Selecao>
              </Campo>
              <Button variante="secundario" onClick={adicionar}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="size-3.5">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Incluir
              </Button>
              <p className="ml-auto max-w-md text-xs leading-relaxed text-tinta-500">
                O mesmo serviço pode entrar duas vezes com configurações
                diferentes — dois mapeamentos de escopos distintos, por exemplo.
              </p>
            </div>
          </Card>
        )}

        {itens.length === 0 && (
          <p className="rounded-cartao border border-dashed border-tinta-200 px-5 py-10 text-center text-sm text-tinta-500">
            Nenhum serviço no orçamento ainda.
          </p>
        )}
      </div>

      <Resumo
        resultado={resultado}
        itens={itens}
        catalogo={catalogo}
        parametros={catalogo.parametros}
        nivel={nivel}
        aoEscolherNivel={setNivel}
        somenteLeitura={somenteLeitura}
        nivelFinalizado={orcamento.nivelProposto}
        salvando={salvando}
        finalizando={finalizando}
        salvo={salvo}
        erro={erro}
        aoSalvar={salvar}
        aoFinalizar={finalizar}
      />
    </div>
  )
}

function ItemDoOrcamento({
  item,
  indice,
  catalogo,
  resultado,
  somenteLeitura,
  aoAlterar,
  aoRemover,
}: {
  item: ItemLocal
  indice: number
  catalogo: CatalogoPrecificacao
  resultado: ReturnType<typeof calcularOrcamento>['itens'][number]
  somenteLeitura: boolean
  aoAlterar: (m: Partial<EntradaItem>) => void
  aoRemover: () => void
}) {
  const servico = catalogo.servicos.find((s) => s.id === item.produtoServicoId)
  const dimensoes = catalogo.dimensoes.filter(
    (d) => d.produtoServicoId === item.produtoServicoId,
  )
  const historico = catalogo.historico[item.produtoServicoId]
  const comparacao = compararComHistorico(
    resultado?.valorFinal ?? 0,
    historico?.ticketMedio ?? null,
    historico?.amostra ?? 0,
    catalogo.parametros.limiarDesvioPercentual,
  )

  function responder(dimensaoId: string, resposta: { opcaoId?: string; valorNumerico?: number }) {
    aoAlterar({ respostas: { ...item.respostas, [dimensaoId]: resposta } })
  }

  return (
    <Card>
      <CardCabecalho
        titulo={servico?.nome ?? 'Serviço removido'}
        descricao={
          dimensoes.length === 0
            ? 'Sem regra de complexidade cadastrada — o valor é consultores × semanas × taxa/hora.'
            : undefined
        }
        acao={
          <div className="flex items-center gap-3">
            <span className="numerico font-titulo text-lg font-extrabold text-verde-700">
              {formatarReais(resultado?.valorFinal ?? 0)}
            </span>
            {!somenteLeitura && (
              <button
                onClick={aoRemover}
                aria-label={`Remover ${servico?.nome ?? 'item'}`}
                className="rounded-lg p-1.5 text-tinta-400 transition-colors hover:bg-perigo-50 hover:text-perigo-600"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="size-4">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        }
      />

      <div className="space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo rotulo="Consultores" id={`c-${indice}`}>
            <Entrada
              id={`c-${indice}`}
              type="number"
              min="1"
              value={item.consultores}
              disabled={somenteLeitura}
              onChange={(e) =>
                aoAlterar({ consultores: Math.max(1, Number(e.target.value) || 1) })
              }
            />
          </Campo>
          <Campo rotulo="Semanas" id={`s-${indice}`}>
            <Entrada
              id={`s-${indice}`}
              type="number"
              min="1"
              value={item.semanas}
              disabled={somenteLeitura}
              onChange={(e) =>
                aoAlterar({ semanas: Math.max(1, Number(e.target.value) || 1) })
              }
            />
          </Campo>
          <Campo rotulo="Custos extras (R$)" id={`e-${indice}`} dica="softwares, viagens">
            <Entrada
              id={`e-${indice}`}
              type="number"
              min="0"
              step="0.01"
              value={item.custosExtras}
              disabled={somenteLeitura}
              onChange={(e) =>
                aoAlterar({ custosExtras: Math.max(0, Number(e.target.value) || 0) })
              }
            />
          </Campo>
        </div>

        {dimensoes.map((d) => (
          <ControleDimensao
            key={d.id}
            dimensao={d}
            resposta={item.respostas[d.id]}
            somenteLeitura={somenteLeitura}
            aoResponder={(r) => responder(d.id, r)}
          />
        ))}

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-tinta-100 pt-3 text-xs text-tinta-500">
          <span>
            Base{' '}
            <strong className="numerico font-semibold text-tinta-800">
              {formatarReais(resultado?.valorBase ?? 0)}
            </strong>
          </span>
          <span>
            Complexidade{' '}
            <strong className="numerico font-semibold text-tinta-800">
              {(resultado?.markupComplexidade ?? 1).toFixed(2)}×
            </strong>
          </span>
          {(resultado?.extraFixo ?? 0) > 0 && (
            <span>
              Custos fixos{' '}
              <strong className="numerico font-semibold text-tinta-800">
                {formatarReais(resultado.extraFixo)}
              </strong>
            </span>
          )}
        </div>

        {comparacao && (
          <p
            className={cn(
              'rounded-lg px-3 py-2 text-xs leading-relaxed',
              comparacao.destoa
                ? 'bg-amarelo-50 text-amarelo-700'
                : 'bg-tinta-50 text-tinta-600',
            )}
          >
            {comparacao.destoa ? (
              <>
                Está{' '}
                <strong>
                  {formatarPercentual(Math.abs(comparacao.desvioPercentual))}{' '}
                  {comparacao.desvioPercentual > 0 ? 'acima' : 'abaixo'}
                </strong>{' '}
                da média histórica deste serviço ({formatarReais(comparacao.ticketMedio)}).
              </>
            ) : (
              <>
                Em linha com o histórico deste serviço (média{' '}
                {formatarReais(comparacao.ticketMedio)}).
              </>
            )}{' '}
            {comparacao.amostra <= 2
              ? `Atenção: a média vem de ${formatarNumero(comparacao.amostra)} projeto${comparacao.amostra === 1 ? '' : 's'} só.`
              : `Base: ${formatarNumero(comparacao.amostra)} projetos entregues.`}
          </p>
        )}
      </div>
    </Card>
  )
}

function ControleDimensao({
  dimensao,
  resposta,
  somenteLeitura,
  aoResponder,
}: {
  dimensao: Dimensao
  resposta: { opcaoId?: string | null; valorNumerico?: number | null } | undefined
  somenteLeitura: boolean
  aoResponder: (r: { opcaoId?: string; valorNumerico?: number }) => void
}) {
  if (dimensao.tipo === 'selecao_unica') {
    return (
      <div>
        <p className="mb-2 text-xs font-semibold text-tinta-700">{dimensao.nome}</p>
        <div className="flex flex-wrap gap-2">
          {dimensao.opcoes.map((o) => {
            const ativo = resposta?.opcaoId === o.id
            return (
              <button
                key={o.id}
                type="button"
                disabled={somenteLeitura}
                onClick={() => aoResponder({ opcaoId: o.id })}
                aria-pressed={ativo}
                className={cn(
                  'flex flex-col items-center gap-0.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors disabled:cursor-default',
                  ativo
                    ? 'border-verde-500 bg-verde-50 text-verde-800'
                    : 'border-tinta-200 bg-white text-tinta-600 hover:border-verde-300 hover:bg-verde-50/50',
                )}
              >
                {o.label}
                <span
                  className={cn(
                    'numerico rounded-full px-1.5 text-[0.65rem]',
                    ativo ? 'bg-verde-100 text-verde-700' : 'bg-tinta-100 text-tinta-500',
                  )}
                >
                  {(1 + o.pontosPercentuais / 100).toFixed(2)}×
                </span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  const valor = resposta?.valorNumerico ?? dimensao.valorMinimo ?? 0
  const impacto =
    dimensao.tipo === 'contagem_linear'
      ? `${(1 + ((valor - (dimensao.valorMinimo ?? 0)) * (dimensao.incrementoPercentualPorUnidade ?? 0)) / 100).toFixed(2)}×`
      : formatarReais(valor * (dimensao.valorUnitario ?? 0))

  return (
    <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg bg-tinta-50 px-3.5 py-3">
      <Campo
        rotulo={dimensao.nome}
        id={`d-${dimensao.id}`}
        dica={
          dimensao.tipo === 'contagem_linear' && dimensao.valorMaximo != null
            ? `${formatarNumero(dimensao.valorMinimo ?? 0)} a ${formatarNumero(dimensao.valorMaximo)}`
            : dimensao.valorUnitario != null
              ? `${formatarReais(dimensao.valorUnitario)} cada`
              : undefined
        }
      >
        <Entrada
          id={`d-${dimensao.id}`}
          type="number"
          min={dimensao.valorMinimo ?? 0}
          max={dimensao.valorMaximo ?? undefined}
          value={valor}
          disabled={somenteLeitura}
          onChange={(e) => aoResponder({ valorNumerico: Number(e.target.value) || 0 })}
          className="w-28"
        />
      </Campo>
      <span className="numerico pb-2.5 text-xs font-semibold text-verde-700">
        {impacto}
      </span>
    </div>
  )
}

function Resumo({
  resultado,
  itens,
  catalogo,
  parametros,
  nivel,
  aoEscolherNivel,
  somenteLeitura,
  nivelFinalizado,
  salvando,
  finalizando,
  salvo,
  erro,
  aoSalvar,
  aoFinalizar,
}: {
  resultado: ReturnType<typeof calcularOrcamento>
  itens: ItemLocal[]
  catalogo: CatalogoPrecificacao
  parametros: ParametrosGlobais
  nivel: 'ideal' | 'aceitavel' | 'ponto_equilibrio'
  aoEscolherNivel: (n: 'ideal' | 'aceitavel' | 'ponto_equilibrio') => void
  somenteLeitura: boolean
  nivelFinalizado: string | null
  salvando: boolean
  finalizando: boolean
  salvo: boolean
  erro: string | null
  aoSalvar: () => void
  aoFinalizar: () => void
}) {
  const niveis = [
    { chave: 'ideal' as const, rotulo: 'Ideal', valor: resultado.valorIdeal, apoio: 'preço cheio' },
    {
      chave: 'aceitavel' as const,
      rotulo: 'Aceitável',
      valor: resultado.valorAceitavel,
      apoio: `−${formatarPercentual(100 - parametros.percentualMargemAceitavel)}`,
    },
    {
      chave: 'ponto_equilibrio' as const,
      rotulo: 'Ponto de equilíbrio',
      valor: resultado.valorPontoEquilibrio,
      apoio: `−${formatarPercentual(100 - parametros.percentualPontoEquilibrio)}`,
    },
  ]

  return (
    <Card className="lg:sticky lg:top-6">
      <CardCabecalho titulo="Orçamento" descricao="Soma de todos os serviços." />
      <div className="space-y-4 p-5">
        <ul className="space-y-2">
          {itens.map((i, n) => (
            <li key={i.chave} className="flex items-baseline justify-between gap-3 text-xs">
              <span className="min-w-0 truncate text-tinta-600">
                {catalogo.servicos.find((s) => s.id === i.produtoServicoId)?.nome ?? '—'}
              </span>
              <span className="numerico shrink-0 font-semibold text-tinta-900">
                {formatarReais(resultado.itens[n]?.valorFinal ?? 0)}
              </span>
            </li>
          ))}
          {itens.length === 0 && (
            <li className="py-6 text-center text-xs text-tinta-400">
              Nenhum serviço incluído.
            </li>
          )}
        </ul>

        <div className="space-y-2 border-t border-tinta-100 pt-4">
          {niveis.map((n) => {
            const escolhido = nivel === n.chave
            return (
              <button
                key={n.chave}
                type="button"
                disabled={somenteLeitura}
                onClick={() => aoEscolherNivel(n.chave)}
                aria-pressed={escolhido}
                className={cn(
                  'flex w-full items-center justify-between gap-3 rounded-lg border px-3.5 py-3 text-left transition-colors disabled:cursor-default',
                  escolhido
                    ? 'border-verde-500 bg-verde-50'
                    : 'border-tinta-200 bg-white hover:bg-tinta-50',
                )}
              >
                <span>
                  <span className="block text-xs font-semibold text-tinta-800">
                    {n.rotulo}
                  </span>
                  <span className="block text-[0.7rem] text-tinta-500">{n.apoio}</span>
                </span>
                <span
                  className={cn(
                    'numerico font-titulo text-base font-extrabold',
                    escolhido ? 'text-verde-700' : 'text-tinta-700',
                  )}
                >
                  {formatarReais(n.valor)}
                </span>
              </button>
            )
          })}
        </div>

        {erro && (
          <p role="alert" className="rounded-lg bg-perigo-50 px-3 py-2 text-xs text-perigo-700">
            {erro}
          </p>
        )}

        {somenteLeitura ? (
          <div className="rounded-lg bg-verde-50 px-3 py-2.5 text-xs leading-relaxed text-verde-800">
            <Badge tom="verde">Finalizado</Badge>
            <p className="mt-2">
              Proposto no valor{' '}
              <strong>
                {niveis.find((n) => n.chave === nivelFinalizado)?.rotulo.toLowerCase() ??
                  'ideal'}
              </strong>
              . O valor foi gravado no negócio. Para propor outro, abra um
              orçamento novo.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <Button larguraTotal variante="secundario" onClick={aoSalvar} carregando={salvando}>
              {salvo ? 'Salvo' : 'Salvar rascunho'}
            </Button>
            <Button
              larguraTotal
              onClick={aoFinalizar}
              carregando={finalizando}
              disabled={itens.length === 0}
            >
              Finalizar e levar ao negócio
            </Button>
            <p className="text-[0.7rem] leading-relaxed text-tinta-500">
              Finalizar congela o orçamento e grava o valor escolhido no negócio,
              que é o que o funil e os gráficos leem.
            </p>
          </div>
        )}
      </div>
    </Card>
  )
}
