import 'server-only'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { ROTULO_METRICA } from '@/lib/tipos-insights'
import type {
  ConversaoEtapa,
  DadosDoPainel,
  EtapaProspeccao,
  FechadosNoMes,
  MetaComProgresso,
  MetricaFonte,
  Periodo,
  RelatorioMensal,
  SnapshotDeMetricas,
} from '@/lib/tipos-insights'

// Reexporta para quem já consome tudo de `insights` no servidor. O navegador
// importa de `lib/tipos-insights` direto — este arquivo é server-only.
export * from '@/lib/tipos-insights'

/**
 * Leituras da aba Insights (Seção 5 do PRD de navegação e insights).
 *
 * Tudo aqui aceita um período. O período é sempre explícito — nenhuma função
 * assume "o mês corrente" por conta própria — porque o mesmo número serve ao
 * painel (que filtra) e ao relatório mensal (que congela um mês fechado), e
 * um default escondido faria os dois discordarem sem ninguém perceber.
 */

const num = (v: unknown): number => Number(v ?? 0)

/** O período como instantes, para comparar com colunas `timestamptz`. */
function comoInstantes(periodo: Periodo) {
  const fimExclusivo = new Date(`${periodo.fim}T00:00:00Z`)
  fimExclusivo.setUTCDate(fimExclusivo.getUTCDate() + 1)
  return {
    de: `${periodo.inicio}T00:00:00Z`,
    ate: fimExclusivo.toISOString(),
  }
}

/** O mês corrente, para o painel abrir em algum lugar. */
export function periodoDoMesCorrente(): Periodo {
  const hoje = new Date()
  const inicio = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1))
  const fim = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + 1, 0))
  return {
    inicio: inicio.toISOString().slice(0, 10),
    fim: fim.toISOString().slice(0, 10),
  }
}

/** O mês de uma data de competência (primeiro ao último dia). */
export function periodoDoMes(referencia: string): Periodo {
  const d = new Date(`${referencia.slice(0, 7)}-01T12:00:00Z`)
  const inicio = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
  const fim = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))
  return {
    inicio: inicio.toISOString().slice(0, 10),
    fim: fim.toISOString().slice(0, 10),
  }
}

// ---------------------------------------------------------------------------
// Funil de prospecção (topo de funil)
// ---------------------------------------------------------------------------

/**
 * O funil de prospecção: do email enviado ao contrato.
 *
 * **Separado do funil de negócios de propósito.** Prospecção, aceite e
 * resposta acontecem enquanto o lead ainda é lead — antes de existir negócio
 * algum. Os dois funis se encontram só no fim, em Contratos.
 *
 * Isso significa que os números não fecham entre si, e não deveriam mesmo:
 * "Reuniões" aqui conta reuniões realizadas no período, enquanto o funil de
 * negócios conta negócios parados na etapa Reunião agora. São perguntas
 * diferentes. O PRD registra isso como ponto a revalidar com uso real
 * (Bloqueador 1) — até lá, a tela diz de onde cada número sai.
 */
export async function obterFunilProspeccao(
  periodo: Periodo,
): Promise<EtapaProspeccao[]> {
  const admin = criarClienteAdmin()
  const { de, ate } = comoInstantes(periodo)

  const [
    { data: emails },
    { data: eventos },
    { data: tipos },
    { count: contratos },
  ] = await Promise.all([
    admin
      .from('emails_enviados')
      .select('lead_cnpj')
      .gte('enviado_em', de)
      .lt('enviado_em', ate),
    admin
      .from('funil_prospeccao_eventos')
      .select('tipo_evento')
      .gte('ocorrido_em', de)
      .lt('ocorrido_em', ate),
    admin.from('tipos_atividade').select('id, nome'),
    admin
      .from('negocios')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'ganho')
      .gte('fechado_em', de)
      .lt('fechado_em', ate),
  ])

  // Prospecção conta lead distinto, não email: reenviar para o mesmo lead é
  // insistência, não alcance novo.
  const leadsProspectados = new Set(
    (emails ?? []).map((e) => e.lead_cnpj as string),
  ).size

  const aceites = (eventos ?? []).filter((e) => e.tipo_evento === 'aceite').length
  const respostas = (eventos ?? []).filter(
    (e) => e.tipo_evento === 'resposta',
  ).length

  const idPorNome = new Map(
    (tipos ?? []).map((t) => [t.nome as string, t.id as string]),
  )

  async function contarAtividades(nomeTipo: string): Promise<number> {
    const id = idPorNome.get(nomeTipo)
    if (!id) return 0
    const { count } = await admin
      .from('atividades')
      .select('id', { count: 'exact', head: true })
      .eq('tipo_id', id)
      .eq('concluida', true)
      .gte('concluida_em', de)
      .lt('concluida_em', ate)
    return count ?? 0
  }

  const [reunioes, diagnosticas, propostas] = await Promise.all([
    contarAtividades('Reunião'),
    contarAtividades('Reunião Diagnóstica'),
    contarAtividades('Reunião de Proposta'),
  ])

  const bruto: Array<Omit<EtapaProspeccao, 'conversao'>> = [
    { chave: 'prospeccao', rotulo: 'Prospecção', quantidade: leadsProspectados, fonte: 'automatica' },
    { chave: 'aceite', rotulo: 'Aceite', quantidade: aceites, fonte: 'manual' },
    { chave: 'resposta', rotulo: 'Respostas', quantidade: respostas, fonte: 'manual' },
    { chave: 'reunioes', rotulo: 'Reuniões', quantidade: reunioes, fonte: 'automatica' },
    { chave: 'rd', rotulo: 'Diagnósticas (RD)', quantidade: diagnosticas, fonte: 'automatica' },
    { chave: 'rp', rotulo: 'Propostas (RP)', quantidade: propostas, fonte: 'automatica' },
    { chave: 'contratos', rotulo: 'Contratos', quantidade: contratos ?? 0, fonte: 'automatica' },
  ]

  return bruto.map((etapa, i) => {
    const anterior = i === 0 ? null : bruto[i - 1]
    return {
      ...etapa,
      conversao:
        anterior == null || anterior.quantidade === 0
          ? null
          : Math.round((etapa.quantidade / anterior.quantidade) * 100),
    }
  })
}

// ---------------------------------------------------------------------------
// Painel
// ---------------------------------------------------------------------------


export async function obterDadosDoPainel(
  periodo: Periodo,
): Promise<DadosDoPainel> {
  const admin = criarClienteAdmin()
  const { de, ate } = comoInstantes(periodo)

  const [
    funilProspeccao,
    { data: etapas },
    { data: conversao },
    { data: tempos },
    { data: resumoFunil },
    { data: fechados },
    { data: emails },
    metas,
  ] = await Promise.all([
    obterFunilProspeccao(periodo),
    admin
      .from('etapas_funil')
      .select('id, nome, ordem')
      .eq('ativo', true)
      .order('ordem', { ascending: true }),
    admin.from('vw_funil_conversao').select('etapa_id, total_passou, total_avancou'),
    admin.from('vw_funil_tempo_medio_etapa').select('etapa_id, tempo_medio'),
    admin
      .from('vw_funil_resumo')
      .select('etapa_id, etapa_nome, ordem, negocios_abertos, valor_total_aberto')
      .order('ordem', { ascending: true }),
    admin
      .from('vw_quadro_negocios')
      .select('status, valor, fechado_em, motivo_perda')
      .in('status', ['ganho', 'perdido'])
      .gte('fechado_em', de)
      .lt('fechado_em', ate),
    admin
      .from('emails_enviados')
      .select('membro')
      .gte('enviado_em', de)
      .lt('enviado_em', ate),
    listarMetasComProgresso({ apenasAtivasEm: periodo }),
  ])

  const conversaoPorEtapaId = new Map(
    (conversao ?? []).map((c) => [c.etapa_id as string, c]),
  )
  const tempoPorEtapaId = new Map(
    (tempos ?? []).map((t) => [t.etapa_id as string, t.tempo_medio]),
  )

  const conversaoPorEtapa: ConversaoEtapa[] = (etapas ?? []).map((e) => {
    const c = conversaoPorEtapaId.get(e.id as string)
    const passou = num(c?.total_passou)
    const avancou = num(c?.total_avancou)
    return {
      etapaNome: e.nome as string,
      ordem: num(e.ordem),
      passou,
      avancou,
      percentual: passou === 0 ? null : Math.round((avancou / passou) * 100),
      tempoMedioDias: extrairDias(tempoPorEtapaId.get(e.id as string)),
    }
  })

  const ganhos = (fechados ?? []).filter((f) => f.status === 'ganho')
  const perdidos = (fechados ?? []).filter((f) => f.status === 'perdido')
  const valorGanho = ganhos.reduce((s, g) => s + num(g.valor), 0)
  const ganhosComValor = ganhos.filter((g) => g.valor != null)

  // Fechados por mês: doze meses para trás a partir do fim do período, para
  // o gráfico de tendência ter contexto além da janela filtrada.
  const dozeMesesAtras = new Date(`${periodo.fim}T00:00:00Z`)
  dozeMesesAtras.setUTCMonth(dozeMesesAtras.getUTCMonth() - 11)
  dozeMesesAtras.setUTCDate(1)

  const { data: fechadosLongos } = await admin
    .from('negocios')
    .select('status, valor, fechado_em')
    .in('status', ['ganho', 'perdido'])
    .gte('fechado_em', dozeMesesAtras.toISOString())
    .lt('fechado_em', ate)

  const porMes = new Map<string, FechadosNoMes>()
  for (const f of fechadosLongos ?? []) {
    const mes = (f.fechado_em as string).slice(0, 7)
    const atual = porMes.get(mes) ?? {
      mes,
      ganhos: 0,
      perdidos: 0,
      valorGanho: 0,
    }
    if (f.status === 'ganho') {
      atual.ganhos += 1
      atual.valorGanho += num(f.valor)
    } else {
      atual.perdidos += 1
    }
    porMes.set(mes, atual)
  }

  const contagemPorMembro = new Map<string, number>()
  for (const e of emails ?? []) {
    const membro = (e.membro as string | null) || 'Sem membro'
    contagemPorMembro.set(membro, (contagemPorMembro.get(membro) ?? 0) + 1)
  }

  const contagemPorMotivo = new Map<string, number>()
  for (const p of perdidos) {
    const motivo = (p.motivo_perda as string | null) || 'Sem motivo'
    contagemPorMotivo.set(motivo, (contagemPorMotivo.get(motivo) ?? 0) + 1)
  }

  return {
    periodo,
    funilProspeccao,
    conversaoPorEtapa,
    valorPorEtapa: (resumoFunil ?? []).map((r) => ({
      etapaNome: r.etapa_nome as string,
      valor: num(r.valor_total_aberto),
      quantidade: num(r.negocios_abertos),
    })),
    fechadosPorMes: [...porMes.values()].sort((a, b) => a.mes.localeCompare(b.mes)),
    rankingProspeccao: [...contagemPorMembro.entries()]
      .map(([membro, prospeccoes]) => ({ membro, prospeccoes }))
      .sort((a, b) => b.prospeccoes - a.prospeccoes),
    motivosDePerda: [...contagemPorMotivo.entries()]
      .map(([motivo, quantidade]) => ({ motivo, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade),
    metas,
    resumo: {
      ganhos: ganhos.length,
      perdidos: perdidos.length,
      valorGanho,
      ticketMedio:
        ganhosComValor.length === 0 ? null : valorGanho / ganhosComValor.length,
      taxaGanho:
        fechados == null || fechados.length === 0
          ? null
          : Math.round((ganhos.length / fechados.length) * 100),
    },
  }
}

/** Dias de um `interval` do Postgres, venha ele como string ou objeto. */
function extrairDias(bruto: unknown): number | null {
  if (bruto == null) return null
  if (typeof bruto === 'number') return Math.round(bruto)
  if (typeof bruto === 'object') {
    const o = bruto as { days?: number; hours?: number; months?: number }
    const dias = (o.months ?? 0) * 30 + (o.days ?? 0) + (o.hours ?? 0) / 24
    return dias > 0 ? Math.round(dias) : null
  }
  if (typeof bruto === 'string') {
    const dias = /(\d+)\s*days?/.exec(bruto)
    if (dias) return Number(dias[1])
    const horas = /^(\d+):/.exec(bruto)
    if (horas) return Math.round(Number(horas[1]) / 24)
  }
  return null
}

/**
 * Quais leads já foram marcados como tendo aceitado ou respondido.
 *
 * Uma consulta só para a lista inteira, chaveada por CNPJ — a tela mostra
 * dezenas de leads por vez, e um `select` por linha seria dezenas de idas ao
 * banco para preencher dois botões.
 */
export async function obterEventosDeProspeccao(
  cnpjs: string[],
): Promise<Map<string, { aceite: boolean; resposta: boolean }>> {
  const mapa = new Map<string, { aceite: boolean; resposta: boolean }>()
  if (cnpjs.length === 0) return mapa

  const admin = criarClienteAdmin()
  const { data } = await admin
    .from('funil_prospeccao_eventos')
    .select('lead_cnpj, tipo_evento')
    .in('lead_cnpj', cnpjs)

  for (const evento of data ?? []) {
    const chave = evento.lead_cnpj as string
    const atual = mapa.get(chave) ?? { aceite: false, resposta: false }
    if (evento.tipo_evento === 'aceite') atual.aceite = true
    if (evento.tipo_evento === 'resposta') atual.resposta = true
    mapa.set(chave, atual)
  }

  return mapa
}

// ---------------------------------------------------------------------------
// Metas
// ---------------------------------------------------------------------------


/**
 * As metas com o progresso já calculado.
 *
 * Para tudo que não é `manual`, `valor_atual` é **calculado agora**, não lido
 * da coluna. O PRD previa um job periódico atualizando a coluna; um número
 * gravado por job fica errado entre uma execução e a próxima, e uma meta que
 * mostra progresso velho é pior que uma que não mostra — ninguém desconfia de
 * um número que está ali. O custo é um count por meta sobre índice existente.
 */
export async function listarMetasComProgresso(
  opcoes: { apenasAtivasEm?: Periodo; incluirInativas?: boolean } = {},
): Promise<MetaComProgresso[]> {
  const admin = criarClienteAdmin()

  let consulta = admin
    .from('metas')
    .select('*')
    .order('periodo_inicio', { ascending: false })
    .order('criado_em', { ascending: true })

  if (!opcoes.incluirInativas) consulta = consulta.eq('ativo', true)
  if (opcoes.apenasAtivasEm) {
    // Uma meta "do período" é qualquer uma que se sobreponha a ele — uma meta
    // trimestral não some do painel só porque o filtro é de um mês.
    consulta = consulta
      .lte('periodo_inicio', opcoes.apenasAtivasEm.fim)
      .gte('periodo_fim', opcoes.apenasAtivasEm.inicio)
  }

  const { data } = await consulta
  if (!data?.length) return []

  const comValor = await Promise.all(
    data.map(async (m) => {
      const fonte = m.metrica_fonte as MetricaFonte
      const valorAtual =
        fonte === 'manual'
          ? num(m.valor_atual)
          : await calcularMetrica(fonte, {
              inicio: m.periodo_inicio as string,
              fim: m.periodo_fim as string,
            })

      const alvo = num(m.valor_alvo)
      const percentualReal = alvo === 0 ? 0 : (valorAtual / alvo) * 100
      const esperado = percentualEsperadoDoPeriodo(
        m.periodo_inicio as string,
        m.periodo_fim as string,
      )

      return {
        id: m.id as string,
        metaPaiId: (m.meta_pai_id as string | null) ?? null,
        nome: m.nome as string,
        descricao: (m.descricao as string | null) ?? null,
        metricaFonte: fonte,
        valorAlvo: alvo,
        valorAtual,
        unidade: (m.unidade as string | null) ?? null,
        periodoInicio: m.periodo_inicio as string,
        periodoFim: m.periodo_fim as string,
        ativo: Boolean(m.ativo),
        criadoPorEmail: m.criado_por_email as string,
        percentual: Math.min(100, Math.round(percentualReal)),
        percentualReal: Math.round(percentualReal),
        percentualEsperado: esperado,
        estado: classificar(percentualReal, esperado),
        filhas: [] as MetaComProgresso[],
      }
    }),
  )

  // Objetivo → Resultados-Chave. Uma meta com pai vira filha dele; sem pai,
  // fica na raiz.
  const porId = new Map(comValor.map((m) => [m.id, m]))
  const raizes: MetaComProgresso[] = []
  for (const meta of comValor) {
    const pai = meta.metaPaiId ? porId.get(meta.metaPaiId) : null
    if (pai) pai.filhas.push(meta)
    else raizes.push(meta)
  }

  return raizes
}

/** Quanto do período já passou, em % — a régua do "está no ritmo?". */
function percentualEsperadoDoPeriodo(
  inicio: string,
  fim: string,
): number | null {
  const i = new Date(`${inicio}T00:00:00Z`).getTime()
  const f = new Date(`${fim}T23:59:59Z`).getTime()
  const agora = Date.now()
  if (agora < i || f <= i) return null
  if (agora > f) return 100
  return Math.round(((agora - i) / (f - i)) * 100)
}

function classificar(
  real: number,
  esperado: number | null,
): MetaComProgresso['estado'] {
  if (real >= 100) return 'concluida'
  // Sem régua de tempo (período futuro), não há como dizer que está atrasada.
  if (esperado == null) return 'no_ritmo'
  if (real >= esperado) return 'no_ritmo'
  // 15 pontos de folga: uma meta 3% abaixo do ritmo no dia 12 não é notícia,
  // e pintar tudo de vermelho no primeiro tropeço faz o alerta virar ruído.
  if (real >= esperado - 15) return 'atencao'
  return 'atrasada'
}

/** O valor real de uma métrica derivada, no período da meta. */
async function calcularMetrica(
  fonte: Exclude<MetricaFonte, 'manual'>,
  periodo: Periodo,
): Promise<number> {
  const admin = criarClienteAdmin()
  const { de, ate } = comoInstantes(periodo)

  if (fonte === 'contratos_fechados') {
    const { count } = await admin
      .from('negocios')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'ganho')
      .gte('fechado_em', de)
      .lt('fechado_em', ate)
    return count ?? 0
  }

  if (fonte === 'faturamento_ganho') {
    const { data } = await admin
      .from('negocios')
      .select('valor')
      .eq('status', 'ganho')
      .gte('fechado_em', de)
      .lt('fechado_em', ate)
    return (data ?? []).reduce((s, n) => s + num(n.valor), 0)
  }

  if (fonte === 'negocios_criados') {
    const { count } = await admin
      .from('negocios')
      .select('id', { count: 'exact', head: true })
      .gte('criado_em', de)
      .lt('criado_em', ate)
    return count ?? 0
  }

  if (fonte === 'prospeccoes_realizadas') {
    const { data } = await admin
      .from('emails_enviados')
      .select('lead_cnpj')
      .gte('enviado_em', de)
      .lt('enviado_em', ate)
    return new Set((data ?? []).map((e) => e.lead_cnpj as string)).size
  }

  // reunioes_realizadas — as três variedades de reunião contam junto: quem
  // define "20 reuniões no trimestre" não está separando diagnóstica de
  // proposta.
  const { data: tipos } = await admin
    .from('tipos_atividade')
    .select('id, nome')
    .in('nome', ['Reunião', 'Reunião Diagnóstica', 'Reunião de Proposta'])

  const ids = (tipos ?? []).map((t) => t.id as string)
  if (ids.length === 0) return 0

  const { count } = await admin
    .from('atividades')
    .select('id', { count: 'exact', head: true })
    .in('tipo_id', ids)
    .eq('concluida', true)
    .gte('concluida_em', de)
    .lt('concluida_em', ate)
  return count ?? 0
}

// ---------------------------------------------------------------------------
// Relatórios
// ---------------------------------------------------------------------------


function paraRelatorio(r: Record<string, unknown>): RelatorioMensal {
  return {
    id: r.id as string,
    periodoReferencia: r.periodo_referencia as string,
    titulo: r.titulo as string,
    conteudo: r.conteudo as string,
    geradoPorIa: Boolean(r.gerado_por_ia),
    status: r.status as 'rascunho' | 'publicado',
    metricasSnapshot:
      (r.metricas_snapshot as Record<string, unknown> | null) ?? null,
    criadoPorEmail: (r.criado_por_email as string | null) ?? null,
    publicadoPorEmail: (r.publicado_por_email as string | null) ?? null,
    criadoEm: r.criado_em as string,
    atualizadoEm: r.atualizado_em as string,
    publicadoEm: (r.publicado_em as string | null) ?? null,
  }
}

export async function listarRelatorios(): Promise<RelatorioMensal[]> {
  const admin = criarClienteAdmin()
  const { data } = await admin
    .from('relatorios_mensais')
    .select('*')
    .order('periodo_referencia', { ascending: false })
    .order('criado_em', { ascending: false })
  return (data ?? []).map(paraRelatorio)
}

export async function obterRelatorio(
  id: string,
): Promise<RelatorioMensal | null> {
  const admin = criarClienteAdmin()
  const { data } = await admin
    .from('relatorios_mensais')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  return data ? paraRelatorio(data) : null
}

// ---------------------------------------------------------------------------
// Snapshot para o relatório
// ---------------------------------------------------------------------------


/**
 * Congela os números de um período.
 *
 * É o que o relatório guarda em `metricas_snapshot` e o que a IA recebe — ela
 * nunca fala com o banco. Assim o texto de um mês fechado continua batendo com
 * os próprios números daqui a um ano, mesmo que alguém reclassifique um
 * negócio antigo no meio tempo.
 */
export async function montarSnapshot(
  periodo: Periodo,
): Promise<SnapshotDeMetricas> {
  const painel = await obterDadosDoPainel(periodo)

  function achatar(metas: MetaComProgresso[]): MetaComProgresso[] {
    return metas.flatMap((m) => [m, ...achatar(m.filhas)])
  }

  return {
    periodo,
    geradoEm: new Date().toISOString(),
    funilProspeccao: painel.funilProspeccao,
    funilNegocios: painel.conversaoPorEtapa,
    valorPorEtapa: painel.valorPorEtapa,
    resumo: painel.resumo,
    motivosDePerda: painel.motivosDePerda,
    rankingProspeccao: painel.rankingProspeccao,
    metas: achatar(painel.metas).map((m) => ({
      nome: m.nome,
      metrica: ROTULO_METRICA[m.metricaFonte],
      alvo: m.valorAlvo,
      atual: m.valorAtual,
      percentual: m.percentualReal,
      unidade: m.unidade,
    })),
  }
}
