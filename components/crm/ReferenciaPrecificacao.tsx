'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Card, CardCabecalho } from '@/components/ui/Card'
import { Entrada } from '@/components/ui/Campo'
import { formatarNumero, formatarReais } from '@/lib/formato'
import type { CatalogoPrecificacao } from '@/lib/orcamentos'

/**
 * A régua de preço, editável — o que na calculadora atual é a aba "Referência".
 *
 * Um formulário só, salvo de uma vez: são números que se olham em conjunto
 * (subir a taxa da Média sem olhar a da Grande é como se erra a escada), e um
 * botão por linha convidaria a mexer num sem ver o outro.
 *
 * Mexer aqui muda o preço de todo orçamento novo, mas não os já finalizados —
 * aqueles guardaram o próprio cálculo no momento em que foram fechados.
 */
export function ReferenciaPrecificacao({
  catalogo,
}: {
  catalogo: CatalogoPrecificacao
}) {
  const router = useRouter()
  const [globais, setGlobais] = useState(catalogo.parametros)
  const [portes, setPortes] = useState(catalogo.portes)
  const [faixas, setFaixas] = useState(catalogo.faixas)
  const [dimensoes, setDimensoes] = useState(catalogo.dimensoes)
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const nomeDoServico = new Map(catalogo.servicos.map((s) => [s.id, s.nome]))

  function tocar() {
    setSalvo(false)
  }

  async function salvar() {
    setSalvando(true)
    setErro(null)
    try {
      const res = await fetch('/api/crm/precificacao/parametros', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          globais,
          portes: portes.map((p) => ({ id: p.id, taxaHoraPadrao: p.taxaHoraPadrao })),
          faixas: faixas.map((f) => ({ id: f.id, multiplicador: f.multiplicador })),
          opcoes: dimensoes.flatMap((d) =>
            d.opcoes.map((o) => ({ id: o.id, pontosPercentuais: o.pontosPercentuais })),
          ),
          dimensoes: dimensoes
            .filter((d) => d.tipo === 'contagem_valor_fixo')
            .map((d) => ({ id: d.id, valorUnitario: d.valorUnitario })),
        }),
      })
      const dados = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErro(dados.mensagem ?? 'Não foi possível salvar a referência.')
        return
      }
      setSalvo(true)
      router.refresh()
    } catch {
      setErro('Falha de conexão ao salvar a referência.')
    } finally {
      setSalvando(false)
    }
  }

  const porServico = new Map<string, typeof dimensoes>()
  for (const d of dimensoes) {
    const lista = porServico.get(d.produtoServicoId) ?? []
    lista.push(d)
    porServico.set(d.produtoServicoId, lista)
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardCabecalho
            titulo="Parâmetros globais"
            descricao="Valem para todo orçamento, de qualquer serviço."
          />
          <div className="divide-y divide-tinta-100">
            <LinhaNumero
              rotulo="Imposto sobre o preço"
              apoio="o valor final é dividido por (100 − isto), não somado"
              sufixo="%"
              valor={globais.impostoPercentual}
              aoMudar={(v) => {
                setGlobais({ ...globais, impostoPercentual: v })
                tocar()
              }}
            />
            <LinhaNumero
              rotulo="Margem aceitável"
              apoio="segundo nível de preço, como % do ideal"
              sufixo="%"
              valor={globais.percentualMargemAceitavel}
              aoMudar={(v) => {
                setGlobais({ ...globais, percentualMargemAceitavel: v })
                tocar()
              }}
            />
            <LinhaNumero
              rotulo="Ponto de equilíbrio"
              apoio="piso, como % do ideal"
              sufixo="%"
              valor={globais.percentualPontoEquilibrio}
              aoMudar={(v) => {
                setGlobais({ ...globais, percentualPontoEquilibrio: v })
                tocar()
              }}
            />
            <LinhaNumero
              rotulo="Alerta de desvio"
              apoio="a partir de quanto de diferença para o histórico o orçamento avisa"
              sufixo="%"
              valor={globais.limiarDesvioPercentual}
              aoMudar={(v) => {
                setGlobais({ ...globais, limiarDesvioPercentual: v })
                tocar()
              }}
            />
          </div>
        </Card>

        <Card>
          <CardCabecalho
            titulo="Taxa/hora por porte"
            descricao="Base de tudo: taxa × consultores × semanas."
          />
          <div className="divide-y divide-tinta-100">
            {portes.map((p) => (
              <LinhaNumero
                key={p.id}
                rotulo={p.nome}
                prefixo="R$"
                valor={p.taxaHoraPadrao ?? 0}
                aoMudar={(v) => {
                  setPortes(portes.map((x) => (x.id === p.id ? { ...x, taxaHoraPadrao: v } : x)))
                  tocar()
                }}
              />
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <CardCabecalho
          titulo="Capacidade produtiva"
          descricao="Multiplica o valor de todos os itens. Time ocioso cobra menos; time sobrecarregado cobra mais."
        />
        <div className="divide-y divide-tinta-100">
          {faixas.map((f) => (
            <LinhaNumero
              key={f.id}
              rotulo={f.label}
              sufixo="×"
              passo={0.01}
              valor={f.multiplicador}
              aoMudar={(v) => {
                setFaixas(faixas.map((x) => (x.id === f.id ? { ...x, multiplicador: v } : x)))
                tocar()
              }}
            />
          ))}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        {[...porServico.entries()].map(([servicoId, doServico]) => (
          <Card key={servicoId}>
            <CardCabecalho titulo={nomeDoServico.get(servicoId) ?? 'Serviço'} />
            <div className="divide-y divide-tinta-100">
              {doServico.map((d) => (
                <div key={d.id}>
                  <p className="bg-tinta-50 px-5 py-2 text-[0.65rem] font-bold tracking-wide text-tinta-500 uppercase">
                    {d.nome}
                  </p>
                  {d.tipo === 'selecao_unica' &&
                    d.opcoes.map((o) => (
                      <LinhaNumero
                        key={o.id}
                        rotulo={o.label}
                        sufixo="%"
                        valor={o.pontosPercentuais}
                        aoMudar={(v) => {
                          setDimensoes(
                            dimensoes.map((x) =>
                              x.id !== d.id
                                ? x
                                : {
                                    ...x,
                                    opcoes: x.opcoes.map((y) =>
                                      y.id === o.id ? { ...y, pontosPercentuais: v } : y,
                                    ),
                                  },
                            ),
                          )
                          tocar()
                        }}
                      />
                    ))}
                  {d.tipo === 'contagem_valor_fixo' && (
                    <LinhaNumero
                      rotulo="Valor por unidade"
                      prefixo="R$"
                      valor={d.valorUnitario ?? 0}
                      aoMudar={(v) => {
                        setDimensoes(
                          dimensoes.map((x) => (x.id === d.id ? { ...x, valorUnitario: v } : x)),
                        )
                        tocar()
                      }}
                    />
                  )}
                  {d.tipo === 'contagem_linear' && (
                    <p className="px-5 py-3 text-xs leading-relaxed text-tinta-500">
                      De {formatarNumero(d.valorMinimo ?? 0)} a{' '}
                      {formatarNumero(d.valorMaximo ?? 0)}, somando{' '}
                      {(d.incrementoPercentualPorUnidade ?? 0).toFixed(2)}% por unidade
                      acima do mínimo. A faixa em si se muda no banco — mexer nela
                      recalibra a escala inteira, não é ajuste de rotina.
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <CardCabecalho
          titulo="O que já foi cobrado"
          descricao="Média por serviço nos projetos entregues, para calibrar os números acima. Só conta projeto de um serviço só — num projeto que empacotou vários por um preço não dá para saber quanto coube a cada um."
        />
        <div className="grid gap-x-6 gap-y-2 p-5 sm:grid-cols-2 xl:grid-cols-3">
          {catalogo.servicos
            .filter((s) => (catalogo.historico[s.id]?.amostra ?? 0) > 0)
            .map((s) => {
              const h = catalogo.historico[s.id]
              return (
                <div
                  key={s.id}
                  className="flex items-baseline justify-between gap-3 border-b border-tinta-100 py-1.5 text-xs"
                >
                  <span className="min-w-0 truncate text-tinta-700">{s.nome}</span>
                  <span className="numerico shrink-0 font-semibold text-tinta-900">
                    {formatarReais(h.ticketMedio)}
                  </span>
                  <span className="numerico w-16 shrink-0 text-right text-tinta-400">
                    {formatarNumero(h.amostra)} proj.
                  </span>
                </div>
              )
            })}
        </div>
      </Card>

      {erro && (
        <p role="alert" className="rounded-lg bg-perigo-50 px-3 py-2 text-xs text-perigo-700">
          {erro}
        </p>
      )}

      <div className="sticky bottom-4 flex items-center justify-end gap-3 rounded-cartao border border-tinta-200 bg-white px-5 py-3 shadow-flutuante">
        {salvo && <span className="text-xs font-semibold text-verde-700">Salvo.</span>}
        <p className="mr-auto max-w-lg text-xs leading-relaxed text-tinta-500">
          Vale para orçamentos novos. Os já finalizados guardaram o próprio
          cálculo e não mudam.
        </p>
        <Button onClick={salvar} carregando={salvando}>
          Salvar referência
        </Button>
      </div>
    </div>
  )
}

function LinhaNumero({
  rotulo,
  apoio,
  valor,
  aoMudar,
  prefixo,
  sufixo,
  passo = 1,
}: {
  rotulo: string
  apoio?: string
  valor: number
  aoMudar: (v: number) => void
  prefixo?: string
  sufixo?: string
  passo?: number
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3">
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-tinta-800">{rotulo}</span>
        {apoio && (
          <span className="mt-0.5 block text-xs leading-relaxed text-tinta-500">
            {apoio}
          </span>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        {prefixo && <span className="text-xs font-bold text-tinta-400">{prefixo}</span>}
        <Entrada
          type="number"
          step={passo}
          value={valor}
          onChange={(e) => aoMudar(Number(e.target.value) || 0)}
          className="numerico w-24 text-right"
        />
        {sufixo && <span className="text-xs font-bold text-tinta-400">{sufixo}</span>}
      </span>
    </div>
  )
}
