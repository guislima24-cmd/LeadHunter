import 'server-only'
import { criarClienteAdmin } from '@/lib/supabase/admin'

/**
 * Leituras das visualizações da aba Negócios — Lista, Funil, Previsão e
 * Reagendados (Seções 3 e 4 do PRD de navegação e insights).
 *
 * O Kanban continua em `lib/crm.ts`, com o resto do funil: são três formas de
 * olhar o mesmo `negocios`, não três fontes de dado. Nada aqui cria tabela
 * nova — Lista e Funil consultam o que o Kanban já consulta, com outro
 * recorte.
 */

const num = (v: unknown): number => Number(v ?? 0)
const numOuNulo = (v: unknown): number | null => (v == null ? null : Number(v))

/** Linha de `vw_quadro_negocios` → cartão da Lista. */
function paraNegocioNaLista(
  n: Record<string, unknown>,
  proxima?: { prazo: string; titulo: string },
): NegocioNaLista {
  return {
    id: n.id as string,
    titulo: n.titulo as string,
    organizacaoNome: n.organizacao_nome as string,
    contatoNome: (n.contato_nome as string | null) ?? null,
    valor: numOuNulo(n.valor),
    previsaoFechamento: (n.previsao_fechamento as string | null) ?? null,
    etapaNome: n.etapa_nome as string,
    etapaOrdem: num(n.etapa_ordem),
    status: n.status as NegocioNaLista['status'],
    donoNome: n.dono_nome as string,
    donoEmail: n.dono_email as string,
    atrasado: Boolean(n.atrasado),
    criadoEm: n.criado_em as string,
    proximaAtividade: proxima?.prazo ?? null,
    proximaAtividadeTitulo: proxima?.titulo ?? null,
  }
}

/** Linha de `vw_negocios_reagendados_pendentes` → plano de retomada. */
function paraReagendado(r: Record<string, unknown>): Reagendado {
  return {
    id: r.id as string,
    negocioId: r.negocio_id as string,
    titulo: r.titulo as string,
    organizacaoNome: r.organizacao_nome as string,
    contatoNome: (r.contato_nome as string | null) ?? null,
    contatoEmail: (r.contato_email as string | null) ?? null,
    contatoTelefone: (r.contato_telefone as string | null) ?? null,
    motivoDetalhado: r.motivo_detalhado as string,
    contextoParaRetomada: r.contexto_para_retomada as string,
    dataRecontato: r.data_recontato as string,
    diasAteRecontato: num(r.dias_ate_recontato),
    donoEmail: r.dono_email as string,
    valor: numOuNulo(r.valor),
    fechadoEm: (r.fechado_em as string | null) ?? null,
    criadoPorEmail: r.criado_por_email as string,
    criadoEm: r.criado_em as string,
    notificadoEm: (r.notificado_em as string | null) ?? null,
  }
}

// ---------------------------------------------------------------------------
// Lista
// ---------------------------------------------------------------------------

export interface NegocioNaLista {
  id: string
  titulo: string
  organizacaoNome: string
  contatoNome: string | null
  valor: number | null
  previsaoFechamento: string | null
  etapaNome: string
  etapaOrdem: number
  status: 'aberto' | 'ganho' | 'perdido'
  donoNome: string
  donoEmail: string
  atrasado: boolean
  criadoEm: string
  /** Prazo da atividade não concluída mais próxima. Null = nada agendado. */
  proximaAtividade: string | null
  proximaAtividadeTitulo: string | null
}

export interface FiltrosLista {
  status?: 'aberto' | 'ganho' | 'perdido' | 'todos'
  etapaId?: string
  donoEmail?: string
  busca?: string
  pagina?: number
  porPagina?: number
}

export interface PaginaDeNegocios {
  negocios: NegocioNaLista[]
  total: number
  pagina: number
  porPagina: number
  totalPaginas: number
}

/**
 * A visualização Lista: tabela paginada e filtrável.
 *
 * A paginação acontece no banco (`range`), não em memória: a lista mostra
 * todos os negócios do time, inclusive fechados, e essa é a única
 * visualização que cresce para sempre — o Kanban só carrega abertos.
 */
export async function listarNegocios(
  filtros: FiltrosLista = {},
): Promise<PaginaDeNegocios> {
  const admin = criarClienteAdmin()

  const pagina = Math.max(1, filtros.pagina ?? 1)
  const porPagina = Math.min(100, Math.max(10, filtros.porPagina ?? 25))
  const de = (pagina - 1) * porPagina

  let consulta = admin
    .from('vw_quadro_negocios')
    .select('*', { count: 'exact' })
    .order('atualizado_em', { ascending: false })
    .range(de, de + porPagina - 1)

  if (filtros.status && filtros.status !== 'todos') {
    consulta = consulta.eq('status', filtros.status)
  }
  if (filtros.etapaId) consulta = consulta.eq('etapa_id', filtros.etapaId)
  if (filtros.donoEmail) consulta = consulta.eq('dono_email', filtros.donoEmail)
  if (filtros.busca?.trim()) {
    const termo = filtros.busca.trim().replace(/[%,()]/g, ' ')
    consulta = consulta.or(
      `titulo.ilike.%${termo}%,organizacao_nome.ilike.%${termo}%,contato_nome.ilike.%${termo}%`,
    )
  }

  const { data: linhas, count } = await consulta

  // A próxima atividade vem numa consulta à parte, só para os negócios desta
  // página: um embed do PostgREST traria todas as atividades de cada negócio
  // para descartar tudo menos a primeira.
  const ids = (linhas ?? []).map((n) => n.id as string)
  const proximaPorNegocio = new Map<string, { prazo: string; titulo: string }>()

  if (ids.length > 0) {
    const { data: atividades } = await admin
      .from('atividades')
      .select('negocio_id, titulo, data_prazo')
      .in('negocio_id', ids)
      .eq('concluida', false)
      .not('data_prazo', 'is', null)
      .order('data_prazo', { ascending: true })

    // Ordenado por prazo crescente: a primeira que aparece de cada negócio já
    // é a mais próxima, então só entra quem ainda não tem uma registrada.
    for (const a of atividades ?? []) {
      const chave = a.negocio_id as string
      if (!proximaPorNegocio.has(chave)) {
        proximaPorNegocio.set(chave, {
          prazo: a.data_prazo as string,
          titulo: a.titulo as string,
        })
      }
    }
  }

  const total = count ?? 0

  return {
    negocios: (linhas ?? []).map((n) =>
      paraNegocioNaLista(n, proximaPorNegocio.get(n.id as string)),
    ),
    total,
    pagina,
    porPagina,
    totalPaginas: Math.max(1, Math.ceil(total / porPagina)),
  }
}

// ---------------------------------------------------------------------------
// Funil visual
// ---------------------------------------------------------------------------

export interface EtapaDoFunilVisual {
  etapaId: string
  etapaNome: string
  ordem: number
  negociosAbertos: number
  valorTotalAberto: number
  /** Largura da faixa, 0–100, proporcional à etapa mais cheia. */
  larguraPercentual: number
  /** Quantos sobreviveram da etapa anterior, em %. Null na primeira. */
  conversaoDaAnterior: number | null
  /** Dias médios que um negócio passa nesta etapa. Null sem histórico. */
  tempoMedioDias: number | null
}

/**
 * O funil em formato de funil: cada etapa é uma faixa cuja largura é
 * proporcional à quantidade de negócios nela.
 *
 * Consome `vw_funil_resumo` — a mesma view do Kanban. A largura é relativa à
 * etapa mais cheia, não ao total: como um negócio ocupa uma etapa só, dividir
 * pelo total daria faixas de 15% cada e um funil que parece um cilindro.
 */
export async function obterFunilVisual(): Promise<EtapaDoFunilVisual[]> {
  const admin = criarClienteAdmin()

  const [{ data: resumo }, { data: tempos }] = await Promise.all([
    admin
      .from('vw_funil_resumo')
      .select('etapa_id, etapa_nome, ordem, negocios_abertos, valor_total_aberto')
      .order('ordem', { ascending: true }),
    admin.from('vw_funil_tempo_medio_etapa').select('etapa_id, tempo_medio'),
  ])

  const tempoPorEtapa = new Map(
    (tempos ?? []).map((t) => [t.etapa_id as string, t.tempo_medio]),
  )

  const linhas = (resumo ?? []).map((r) => ({
    etapaId: r.etapa_id as string,
    etapaNome: r.etapa_nome as string,
    ordem: num(r.ordem),
    negociosAbertos: num(r.negocios_abertos),
    valorTotalAberto: num(r.valor_total_aberto),
  }))

  const maior = Math.max(1, ...linhas.map((l) => l.negociosAbertos))

  return linhas.map((l, i) => {
    const anterior = i === 0 ? null : linhas[i - 1]
    // `tempo_medio` vem como interval do Postgres; o PostgREST serializa
    // como string ISO-8601 ou objeto — só o número de dias interessa aqui.
    const bruto = tempoPorEtapa.get(l.etapaId)
    const dias = extrairDias(bruto)

    return {
      ...l,
      // Piso de 6%: uma etapa com 1 negócio ao lado de outra com 40 viraria
      // uma linha invisível, e "vazio" e "quase vazio" precisam se distinguir.
      larguraPercentual:
        l.negociosAbertos === 0
          ? 0
          : Math.max(6, Math.round((l.negociosAbertos / maior) * 100)),
      conversaoDaAnterior:
        anterior == null || anterior.negociosAbertos === 0
          ? null
          : Math.round((l.negociosAbertos / anterior.negociosAbertos) * 100),
      tempoMedioDias: dias,
    }
  })
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

// ---------------------------------------------------------------------------
// Previsão
// ---------------------------------------------------------------------------

export interface MesDePrevisao {
  mes: string
  quantidade: number
  valorTotal: number
  /** Negócios do mês sem valor preenchido — o total está subestimado. */
  semValor: number
}

/**
 * Negócios abertos agrupados pelo mês em que se espera fechá-los.
 *
 * Só entra quem tem previsão preenchida. Negócio sem previsão não é
 * "previsto para hoje" nem para o mês que vem — não é previsto, e forçá-lo
 * para algum mês inventaria compromisso que ninguém assumiu. A tela mostra
 * quantos ficaram de fora.
 */
export async function obterPrevisaoMensal(): Promise<{
  meses: MesDePrevisao[]
  semPrevisao: number
  valorSemPrevisao: number
}> {
  const admin = criarClienteAdmin()

  const [{ data: meses }, { data: soltos }] = await Promise.all([
    admin
      .from('vw_negocios_previsao_mensal')
      .select('mes, quantidade, valor_total, sem_valor')
      .order('mes', { ascending: true }),
    admin
      .from('negocios')
      .select('valor')
      .eq('status', 'aberto')
      .is('previsao_fechamento', null),
  ])

  return {
    meses: (meses ?? []).map((m) => ({
      mes: m.mes as string,
      quantidade: num(m.quantidade),
      valorTotal: num(m.valor_total),
      semValor: num(m.sem_valor),
    })),
    semPrevisao: (soltos ?? []).length,
    valorSemPrevisao: (soltos ?? []).reduce((s, n) => s + num(n.valor), 0),
  }
}

/** Os negócios de um mês da previsão, para a tela poder abrir a faixa. */
export async function listarNegociosDoMes(
  mes: string,
): Promise<NegocioNaLista[]> {
  const admin = criarClienteAdmin()

  const inicio = new Date(`${mes}T00:00:00Z`)
  const fim = new Date(inicio)
  fim.setUTCMonth(fim.getUTCMonth() + 1)

  const { data } = await admin
    .from('vw_quadro_negocios')
    .select('*')
    .eq('status', 'aberto')
    .gte('previsao_fechamento', inicio.toISOString().slice(0, 10))
    .lt('previsao_fechamento', fim.toISOString().slice(0, 10))
    .order('previsao_fechamento', { ascending: true })

  return (data ?? []).map((n) => paraNegocioNaLista(n))
}

// ---------------------------------------------------------------------------
// Reagendados
// ---------------------------------------------------------------------------

export interface Reagendado {
  id: string
  negocioId: string
  titulo: string
  organizacaoNome: string
  contatoNome: string | null
  contatoEmail: string | null
  contatoTelefone: string | null
  motivoDetalhado: string
  contextoParaRetomada: string
  dataRecontato: string
  diasAteRecontato: number
  donoEmail: string
  valor: number | null
  fechadoEm: string | null
  criadoPorEmail: string
  criadoEm: string
  notificadoEm: string | null
}

/**
 * Negócios perdidos por timing que ainda aguardam recontato.
 *
 * Ordenado pela data de retomada, do mais urgente ao mais distante — quem
 * abre esta tela quer saber com quem falar esta semana, não a ordem em que
 * as perdas aconteceram.
 */
export async function listarReagendadosPendentes(): Promise<Reagendado[]> {
  const admin = criarClienteAdmin()

  const { data } = await admin
    .from('vw_negocios_reagendados_pendentes')
    .select('*')
    .order('data_recontato', { ascending: true })

  return (data ?? []).map(paraReagendado)
}

/**
 * Só quantos aguardam recontato — para o contador da aba.
 *
 * `head: true` faz o Postgres contar sem transportar linha nenhuma: as
 * outras visualizações da aba precisam do número, não do conteúdo.
 */
export async function contarReagendadosPendentes(): Promise<number> {
  const admin = criarClienteAdmin()
  const { count } = await admin
    .from('negocio_reagendamentos')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'aguardando')
  return count ?? 0
}

/** O plano de retomada de um negócio, para mostrar na ficha dele. */
export async function obterReagendamentoDoNegocio(
  negocioId: string,
): Promise<Reagendado | null> {
  const admin = criarClienteAdmin()
  const { data } = await admin
    .from('vw_negocios_reagendados_pendentes')
    .select('*')
    .eq('negocio_id', negocioId)
    .maybeSingle()

  return data ? paraReagendado(data) : null
}
