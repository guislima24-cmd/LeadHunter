/**
 * Tipos e rótulos do módulo de Insights — a parte que o navegador também usa.
 *
 * Mora fora de `lib/insights.ts` porque aquele arquivo importa `server-only`:
 * as telas de metas e do painel são componentes de cliente e precisam de
 * `ROTULO_METRICA` em tempo de execução (não só dos tipos, que se apagam na
 * compilação). Importar de lá arrastaria o `server-only` para o pacote do
 * navegador e o build falha — que é exatamente para isso que ele existe.
 *
 * Aqui só entra coisa sem segredo e sem acesso a banco: nomes, formatos e
 * constantes de apresentação.
 */

export type MetricaFonte =
  | 'manual'
  | 'contratos_fechados'
  | 'faturamento_ganho'
  | 'reunioes_realizadas'
  | 'prospeccoes_realizadas'
  | 'negocios_criados'

export const ROTULO_METRICA: Record<MetricaFonte, string> = {
  manual: 'Atualizada à mão',
  contratos_fechados: 'Negócios ganhos',
  faturamento_ganho: 'Faturamento ganho',
  reunioes_realizadas: 'Reuniões realizadas',
  prospeccoes_realizadas: 'Leads prospectados',
  negocios_criados: 'Negócios criados',
}

export interface Periodo {
  /** Data ISO (YYYY-MM-DD), inclusiva. */
  inicio: string
  /** Data ISO (YYYY-MM-DD), inclusiva. */
  fim: string
}

export interface MetaComProgresso {
  id: string
  metaPaiId: string | null
  nome: string
  descricao: string | null
  metricaFonte: MetricaFonte
  valorAlvo: number
  valorAtual: number
  unidade: string | null
  periodoInicio: string
  periodoFim: string
  ativo: boolean
  criadoPorEmail: string
  /** 0–100, limitado a 100 mesmo quando o alvo é superado. */
  percentual: number
  /** Sem limite — para mostrar "132% do alvo". */
  percentualReal: number
  /**
   * Onde a meta deveria estar hoje, pelo tempo decorrido do período. Null se
   * o período ainda não começou.
   */
  percentualEsperado: number | null
  estado: 'no_ritmo' | 'atencao' | 'atrasada' | 'concluida'
  filhas: MetaComProgresso[]
}

export interface EtapaProspeccao {
  chave: string
  rotulo: string
  quantidade: number
  /** % em relação à etapa anterior. Null na primeira. */
  conversao: number | null
  /** De onde o número vem — a tela avisa o que é registro manual. */
  fonte: 'automatica' | 'manual'
}

export interface FechadosNoMes {
  mes: string
  ganhos: number
  perdidos: number
  valorGanho: number
}

export interface RankingMembro {
  membro: string
  prospeccoes: number
}

export interface MotivoDePerda {
  motivo: string
  quantidade: number
}

export interface ConversaoEtapa {
  etapaNome: string
  ordem: number
  passou: number
  avancou: number
  percentual: number | null
  tempoMedioDias: number | null
}

export interface ResumoDoPeriodo {
  ganhos: number
  perdidos: number
  valorGanho: number
  ticketMedio: number | null
  taxaGanho: number | null
}

export interface DadosDoPainel {
  periodo: Periodo
  funilProspeccao: EtapaProspeccao[]
  conversaoPorEtapa: ConversaoEtapa[]
  valorPorEtapa: Array<{ etapaNome: string; valor: number; quantidade: number }>
  fechadosPorMes: FechadosNoMes[]
  rankingProspeccao: RankingMembro[]
  motivosDePerda: MotivoDePerda[]
  metas: MetaComProgresso[]
  resumo: ResumoDoPeriodo
}

export interface SnapshotDeMetricas {
  periodo: Periodo
  geradoEm: string
  funilProspeccao: EtapaProspeccao[]
  funilNegocios: ConversaoEtapa[]
  valorPorEtapa: Array<{ etapaNome: string; valor: number; quantidade: number }>
  resumo: ResumoDoPeriodo
  motivosDePerda: MotivoDePerda[]
  rankingProspeccao: RankingMembro[]
  metas: Array<{
    nome: string
    metrica: string
    alvo: number
    atual: number
    percentual: number
    unidade: string | null
  }>
}

export interface RelatorioMensal {
  id: string
  periodoReferencia: string
  titulo: string
  conteudo: string
  geradoPorIa: boolean
  status: 'rascunho' | 'publicado'
  metricasSnapshot: Record<string, unknown> | null
  criadoPorEmail: string | null
  publicadoPorEmail: string | null
  criadoEm: string
  atualizadoEm: string
  publicadoEm: string | null
}
