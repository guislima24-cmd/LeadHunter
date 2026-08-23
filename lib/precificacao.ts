/**
 * A fórmula de precificação (Seção 4 do PRD).
 *
 * Fica num módulo sem `server-only` de propósito: a tela precisa recalcular a
 * cada tecla para o vendedor ver o preço mexendo, e o servidor precisa
 * recalcular de novo ao salvar, porque o valor que vai para o banco não pode
 * depender do que o navegador mandou. Duas implementações da mesma conta é
 * como o número da tela e o número salvo passam a divergir; esta é uma só.
 *
 * A conta reproduz item a item o que a calculadora "Precificação UFABC Júnior
 * 2026" já faz — o que mudou é de onde vêm os números: lá estão fixos no
 * código, aqui saem das tabelas de precificação.
 */

export type TipoDimensao = 'selecao_unica' | 'contagem_linear' | 'contagem_valor_fixo'

export interface OpcaoDimensao {
  id: string
  label: string
  pontosPercentuais: number
  padrao: boolean
}

export interface Dimensao {
  id: string
  produtoServicoId: string
  nome: string
  tipo: TipoDimensao
  valorMinimo: number | null
  valorMaximo: number | null
  incrementoPercentualPorUnidade: number | null
  valorUnitario: number | null
  opcoes: OpcaoDimensao[]
}

export interface ParametrosGlobais {
  impostoPercentual: number
  percentualMargemAceitavel: number
  percentualPontoEquilibrio: number
  limiarDesvioPercentual: number
}

/** O que o vendedor preencheu num item, antes de virar dinheiro. */
export interface EntradaItem {
  produtoServicoId: string
  consultores: number
  semanas: number
  custosExtras: number
  /** dimensaoId → id da opção escolhida (seleção) ou número informado (contagem). */
  respostas: Record<string, { opcaoId?: string | null; valorNumerico?: number | null }>
}

export interface ResultadoItem {
  valorBase: number
  markupComplexidade: number
  valorComMarkups: number
  extraFixo: number
  subtotal: number
  valorFinal: number
}

export interface ResultadoOrcamento {
  itens: ResultadoItem[]
  valorIdeal: number
  valorAceitavel: number
  valorPontoEquilibrio: number
}

/**
 * Calcula um item.
 *
 * Os três tipos de dimensão entram em lugares diferentes da conta, e não é
 * intercambiável: `selecao_unica` soma pontos que viram um multiplicador,
 * `contagem_linear` multiplica, `contagem_valor_fixo` é dinheiro somado
 * depois de todos os multiplicadores — um POP a mais custa R$ 200, não R$ 200
 * corrigidos pela capacidade do time.
 */
export function calcularItem(
  entrada: EntradaItem,
  dimensoes: Dimensao[],
  taxaHora: number,
  multiplicadorCapacidade: number,
  parametros: ParametrosGlobais,
): ResultadoItem {
  const doServico = dimensoes.filter(
    (d) => d.produtoServicoId === entrada.produtoServicoId,
  )

  const valorBase = taxaHora * entrada.consultores * entrada.semanas

  // (2) seleções: soma de pontos percentuais → um multiplicador só
  let pontos = 0
  for (const d of doServico) {
    if (d.tipo !== 'selecao_unica') continue
    const escolhido = entrada.respostas[d.id]?.opcaoId
    const opcao = d.opcoes.find((o) => o.id === escolhido)
    if (opcao) pontos += opcao.pontosPercentuais
  }
  const multiplicadorSelecao = 1 + pontos / 100

  // (3) contagens lineares: multiplicam entre si
  let multiplicadorContagem = 1
  for (const d of doServico) {
    if (d.tipo !== 'contagem_linear') continue
    const valor = entrada.respostas[d.id]?.valorNumerico
    if (valor == null) continue
    const minimo = d.valorMinimo ?? 0
    const incremento = d.incrementoPercentualPorUnidade ?? 0
    multiplicadorContagem *= 1 + ((valor - minimo) * incremento) / 100
  }

  const markupComplexidade = multiplicadorSelecao * multiplicadorContagem
  const valorComMarkups = valorBase * markupComplexidade * multiplicadorCapacidade

  // (6) custo fixo: entra depois dos multiplicadores, não antes
  let extraFixo = entrada.custosExtras
  for (const d of doServico) {
    if (d.tipo !== 'contagem_valor_fixo') continue
    const valor = entrada.respostas[d.id]?.valorNumerico
    if (valor == null) continue
    extraFixo += valor * (d.valorUnitario ?? 0)
  }

  const subtotal = valorComMarkups + extraFixo
  // O imposto é uma divisão, não uma soma: o preço precisa sobrar o subtotal
  // depois de descontado, e somar 3% deixaria menos que isso.
  const valorFinal = subtotal / ((100 - parametros.impostoPercentual) / 100)

  return {
    valorBase,
    markupComplexidade,
    valorComMarkups,
    extraFixo,
    subtotal,
    valorFinal,
  }
}

export function calcularOrcamento(
  entradas: EntradaItem[],
  dimensoes: Dimensao[],
  taxaHora: number,
  multiplicadorCapacidade: number,
  parametros: ParametrosGlobais,
): ResultadoOrcamento {
  const itens = entradas.map((e) =>
    calcularItem(e, dimensoes, taxaHora, multiplicadorCapacidade, parametros),
  )
  const valorIdeal = itens.reduce((s, i) => s + i.valorFinal, 0)
  return {
    itens,
    valorIdeal,
    valorAceitavel: valorIdeal * (parametros.percentualMargemAceitavel / 100),
    valorPontoEquilibrio: valorIdeal * (parametros.percentualPontoEquilibrio / 100),
  }
}

/** Preenche cada dimensão de seleção com a opção marcada como padrão. */
export function respostasIniciais(
  produtoServicoId: string,
  dimensoes: Dimensao[],
): EntradaItem['respostas'] {
  const respostas: EntradaItem['respostas'] = {}
  for (const d of dimensoes.filter((x) => x.produtoServicoId === produtoServicoId)) {
    if (d.tipo === 'selecao_unica') {
      const padrao = d.opcoes.find((o) => o.padrao) ?? d.opcoes[0]
      respostas[d.id] = { opcaoId: padrao?.id ?? null }
    } else {
      respostas[d.id] = { valorNumerico: d.valorMinimo ?? 0 }
    }
  }
  return respostas
}

export interface ComparacaoHistorico {
  amostra: number
  ticketMedio: number
  desvioPercentual: number
  /** Passou do limiar configurado — a tela avisa, mas não impede. */
  destoa: boolean
}

/**
 * Compara o valor de um item com o que já foi cobrado por esse serviço.
 *
 * Devolve `null` quando não há histórico: um alerta calculado sobre zero
 * projeto seria pior que alerta nenhum. Quem consome ainda precisa mostrar a
 * amostra — dizer "40% acima da média" sem dizer que a média é de dois
 * projetos passa uma confiança que o dado não tem.
 */
export function compararComHistorico(
  valorFinal: number,
  ticketMedio: number | null,
  amostra: number,
  limiarPercentual: number,
): ComparacaoHistorico | null {
  if (!ticketMedio || amostra === 0) return null
  const desvioPercentual = ((valorFinal - ticketMedio) / ticketMedio) * 100
  return {
    amostra,
    ticketMedio,
    desvioPercentual,
    destoa: Math.abs(desvioPercentual) >= limiarPercentual,
  }
}
