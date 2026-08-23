import 'server-only'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import type { Dimensao, ParametrosGlobais } from '@/lib/precificacao'

/**
 * Leitura do módulo de precificação. Schema em n8n/sql/009 e 010.
 *
 * O cálculo em si não mora aqui — está em `lib/precificacao.ts`, que o
 * navegador também importa para dar prévia ao vivo.
 */

export interface ServicoPrecificavel {
  id: string
  nome: string
  consultoresPadrao: number
  semanasPadrao: number
}

export interface PorteEmpresa {
  id: string
  nome: string
  taxaHoraPadrao: number | null
}

export interface FaixaCapacidade {
  id: string
  label: string
  multiplicador: number
}

export interface TicketHistorico {
  amostra: number
  ticketMedio: number | null
  mediana: number | null
  menor: number | null
  maior: number | null
}

export interface CatalogoPrecificacao {
  servicos: ServicoPrecificavel[]
  portes: PorteEmpresa[]
  faixas: FaixaCapacidade[]
  dimensoes: Dimensao[]
  parametros: ParametrosGlobais
  /** produtoServicoId → o que já foi cobrado por esse serviço. */
  historico: Record<string, TicketHistorico>
}

const num = (v: unknown): number => Number(v ?? 0)
const numOuNulo = (v: unknown): number | null => (v == null ? null : Number(v))

/** Tudo o que a tela de orçamento precisa para montar o formulário e calcular. */
export async function obterCatalogoPrecificacao(): Promise<CatalogoPrecificacao> {
  const admin = criarClienteAdmin()

  const [
    { data: servicos },
    { data: portes },
    { data: faixas },
    { data: dimensoes },
    { data: opcoes },
    { data: parametros },
    { data: tickets },
  ] = await Promise.all([
    admin
      .from('produtos_servicos')
      .select('id, nome, consultores_padrao, semanas_padrao')
      .eq('ativo', true)
      .order('ordem', { ascending: true }),
    admin
      .from('portes_empresa')
      .select('id, nome, taxa_hora_padrao')
      .eq('ativo', true)
      .order('ordem', { ascending: true }),
    admin
      .from('precificacao_faixas_capacidade')
      .select('id, label, multiplicador')
      .eq('ativo', true)
      .order('ordem', { ascending: true }),
    admin
      .from('precificacao_dimensoes')
      .select(
        'id, produto_servico_id, nome, tipo, valor_minimo, valor_maximo, incremento_percentual_por_unidade, valor_unitario',
      )
      .eq('ativo', true)
      .order('ordem', { ascending: true }),
    admin
      .from('precificacao_dimensao_opcoes')
      .select('id, dimensao_id, label, pontos_percentuais, padrao')
      .eq('ativo', true)
      .order('ordem', { ascending: true }),
    admin
      .from('precificacao_parametros_globais')
      .select('*')
      .eq('id', true)
      .maybeSingle(),
    admin
      .from('vw_ticket_medio_servico')
      .select('produto_servico_id, amostra, ticket_medio, mediana, menor, maior'),
  ])

  const opcoesPorDimensao = new Map<string, Dimensao['opcoes']>()
  for (const o of opcoes ?? []) {
    const lista = opcoesPorDimensao.get(o.dimensao_id as string) ?? []
    lista.push({
      id: o.id as string,
      label: o.label as string,
      pontosPercentuais: num(o.pontos_percentuais),
      padrao: Boolean(o.padrao),
    })
    opcoesPorDimensao.set(o.dimensao_id as string, lista)
  }

  const historico: Record<string, TicketHistorico> = {}
  for (const t of tickets ?? []) {
    historico[t.produto_servico_id as string] = {
      amostra: num(t.amostra),
      ticketMedio: numOuNulo(t.ticket_medio),
      mediana: numOuNulo(t.mediana),
      menor: numOuNulo(t.menor),
      maior: numOuNulo(t.maior),
    }
  }

  return {
    servicos: (servicos ?? []).map((s) => ({
      id: s.id as string,
      nome: s.nome as string,
      consultoresPadrao: num(s.consultores_padrao) || 1,
      semanasPadrao: num(s.semanas_padrao) || 1,
    })),
    portes: (portes ?? []).map((p) => ({
      id: p.id as string,
      nome: p.nome as string,
      taxaHoraPadrao: numOuNulo(p.taxa_hora_padrao),
    })),
    faixas: (faixas ?? []).map((f) => ({
      id: f.id as string,
      label: f.label as string,
      multiplicador: num(f.multiplicador),
    })),
    dimensoes: (dimensoes ?? []).map((d) => ({
      id: d.id as string,
      produtoServicoId: d.produto_servico_id as string,
      nome: d.nome as string,
      tipo: d.tipo as Dimensao['tipo'],
      valorMinimo: numOuNulo(d.valor_minimo),
      valorMaximo: numOuNulo(d.valor_maximo),
      incrementoPercentualPorUnidade: numOuNulo(d.incremento_percentual_por_unidade),
      valorUnitario: numOuNulo(d.valor_unitario),
      opcoes: opcoesPorDimensao.get(d.id as string) ?? [],
    })),
    parametros: {
      impostoPercentual: num(parametros?.imposto_percentual) || 0,
      percentualMargemAceitavel: num(parametros?.percentual_margem_aceitavel) || 90,
      percentualPontoEquilibrio: num(parametros?.percentual_ponto_equilibrio) || 80,
      limiarDesvioPercentual: num(parametros?.limiar_desvio_percentual) || 40,
    },
    historico,
  }
}

export interface OrcamentoNaLista {
  id: string
  negocioId: string
  negocioTitulo: string
  organizacaoNome: string
  porteNome: string
  status: 'rascunho' | 'finalizado'
  nivelProposto: string | null
  valorIdeal: number | null
  quantidadeItens: number
  criadoPorEmail: string
  criadoEm: string
  atualizadoEm: string
}

export async function listarOrcamentos(): Promise<OrcamentoNaLista[]> {
  const admin = criarClienteAdmin()

  const { data: orcamentos } = await admin
    .from('negocio_orcamentos')
    .select(
      'id, negocio_id, porte_empresa_id, status, nivel_proposto, valor_ideal, criado_por_email, criado_em, atualizado_em',
    )
    .order('atualizado_em', { ascending: false })

  if (!orcamentos?.length) return []

  // Resolve os nomes em consultas próprias em vez de embed do PostgREST: o
  // formato do embed varia com a cardinalidade inferida, e aqui o contrato
  // precisa ser previsível (mesma razão de vw_quadro_negocios).
  const [{ data: negocios }, { data: portes }, { data: contagens }] = await Promise.all([
    admin
      .from('vw_quadro_negocios')
      .select('id, titulo, organizacao_nome')
      .in('id', [...new Set(orcamentos.map((o) => o.negocio_id as string))]),
    admin.from('portes_empresa').select('id, nome'),
    admin
      .from('negocio_orcamento_itens')
      .select('orcamento_id')
      .in('orcamento_id', orcamentos.map((o) => o.id as string)),
  ])

  const negocioPorId = new Map((negocios ?? []).map((n) => [n.id as string, n]))
  const portePorId = new Map((portes ?? []).map((p) => [p.id as string, p.nome as string]))
  const itensPorOrcamento = new Map<string, number>()
  for (const i of contagens ?? []) {
    const k = i.orcamento_id as string
    itensPorOrcamento.set(k, (itensPorOrcamento.get(k) ?? 0) + 1)
  }

  return orcamentos.map((o) => {
    const negocio = negocioPorId.get(o.negocio_id as string)
    return {
      id: o.id as string,
      negocioId: o.negocio_id as string,
      negocioTitulo: (negocio?.titulo as string) ?? 'Negócio removido',
      organizacaoNome: (negocio?.organizacao_nome as string) ?? '—',
      porteNome: portePorId.get(o.porte_empresa_id as string) ?? '—',
      status: o.status as 'rascunho' | 'finalizado',
      nivelProposto: (o.nivel_proposto as string | null) ?? null,
      valorIdeal: numOuNulo(o.valor_ideal),
      quantidadeItens: itensPorOrcamento.get(o.id as string) ?? 0,
      criadoPorEmail: o.criado_por_email as string,
      criadoEm: o.criado_em as string,
      atualizadoEm: o.atualizado_em as string,
    }
  })
}

export interface ItemDoOrcamento {
  id: string
  produtoServicoId: string
  consultores: number
  semanas: number
  custosExtras: number
  ordem: number
  respostas: Record<string, { opcaoId?: string | null; valorNumerico?: number | null }>
}

export interface OrcamentoCompleto {
  id: string
  negocioId: string
  negocioTitulo: string
  organizacaoNome: string
  porteEmpresaId: string
  faixaCapacidadeId: string
  status: 'rascunho' | 'finalizado'
  nivelProposto: 'ideal' | 'aceitavel' | 'ponto_equilibrio' | null
  valorIdeal: number | null
  criadoPorEmail: string
  criadoEm: string
  itens: ItemDoOrcamento[]
}

export async function obterOrcamento(id: string): Promise<OrcamentoCompleto | null> {
  const admin = criarClienteAdmin()

  const { data: o } = await admin
    .from('negocio_orcamentos')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (!o) return null

  const [{ data: negocio }, { data: itens }] = await Promise.all([
    admin
      .from('vw_quadro_negocios')
      .select('titulo, organizacao_nome')
      .eq('id', o.negocio_id as string)
      .maybeSingle(),
    admin
      .from('negocio_orcamento_itens')
      .select('id, produto_servico_id, consultores, semanas, custos_extras, ordem')
      .eq('orcamento_id', id)
      .order('ordem', { ascending: true }),
  ])

  const idsItens = (itens ?? []).map((i) => i.id as string)
  const { data: valores } = idsItens.length
    ? await admin
        .from('negocio_orcamento_item_valores')
        .select('item_id, dimensao_id, opcao_id, valor_numerico')
        .in('item_id', idsItens)
    : { data: [] }

  const respostasPorItem = new Map<string, ItemDoOrcamento['respostas']>()
  for (const v of valores ?? []) {
    const k = v.item_id as string
    const atual = respostasPorItem.get(k) ?? {}
    atual[v.dimensao_id as string] = {
      opcaoId: (v.opcao_id as string | null) ?? null,
      valorNumerico: numOuNulo(v.valor_numerico),
    }
    respostasPorItem.set(k, atual)
  }

  return {
    id: o.id as string,
    negocioId: o.negocio_id as string,
    negocioTitulo: (negocio?.titulo as string) ?? 'Negócio removido',
    organizacaoNome: (negocio?.organizacao_nome as string) ?? '—',
    porteEmpresaId: o.porte_empresa_id as string,
    faixaCapacidadeId: o.faixa_capacidade_id as string,
    status: o.status as 'rascunho' | 'finalizado',
    nivelProposto: (o.nivel_proposto as OrcamentoCompleto['nivelProposto']) ?? null,
    valorIdeal: numOuNulo(o.valor_ideal),
    criadoPorEmail: o.criado_por_email as string,
    criadoEm: o.criado_em as string,
    itens: (itens ?? []).map((i, indice) => ({
      id: i.id as string,
      produtoServicoId: i.produto_servico_id as string,
      consultores: num(i.consultores) || 1,
      semanas: num(i.semanas) || 1,
      custosExtras: num(i.custos_extras),
      ordem: i.ordem == null ? indice : num(i.ordem),
      respostas: respostasPorItem.get(i.id as string) ?? {},
    })),
  }
}

export interface NegocioParaOrcamento {
  id: string
  titulo: string
  organizacaoNome: string
  porteEmpresaId: string | null
}

/** Negócios abertos, para o seletor de "para qual negócio é este orçamento". */
export async function listarNegociosParaOrcamento(): Promise<NegocioParaOrcamento[]> {
  const admin = criarClienteAdmin()
  const { data } = await admin
    .from('vw_quadro_negocios')
    .select('id, titulo, organizacao_nome, organizacao_id')
    .eq('status', 'aberto')
    .order('criado_em', { ascending: false })

  if (!data?.length) return []

  const { data: orgs } = await admin
    .from('organizacoes')
    .select('id, porte_empresa_id')
    .in('id', [...new Set(data.map((n) => n.organizacao_id as string))])
  const portePorOrg = new Map(
    (orgs ?? []).map((o) => [o.id as string, (o.porte_empresa_id as string | null) ?? null]),
  )

  return data.map((n) => ({
    id: n.id as string,
    titulo: n.titulo as string,
    organizacaoNome: n.organizacao_nome as string,
    porteEmpresaId: portePorOrg.get(n.organizacao_id as string) ?? null,
  }))
}

export interface OrcamentoDoNegocio {
  id: string
  status: 'rascunho' | 'finalizado'
  nivelProposto: string | null
  valorIdeal: number | null
  quantidadeItens: number
  atualizadoEm: string
}

/** Os orçamentos de um negócio, para a ficha dele. */
export async function listarOrcamentosDoNegocio(
  negocioId: string,
): Promise<OrcamentoDoNegocio[]> {
  const admin = criarClienteAdmin()
  const { data } = await admin
    .from('negocio_orcamentos')
    .select('id, status, nivel_proposto, valor_ideal, atualizado_em')
    .eq('negocio_id', negocioId)
    .order('atualizado_em', { ascending: false })

  if (!data?.length) return []

  const { data: itens } = await admin
    .from('negocio_orcamento_itens')
    .select('orcamento_id')
    .in('orcamento_id', data.map((o) => o.id as string))

  const contagem = new Map<string, number>()
  for (const i of itens ?? []) {
    const k = i.orcamento_id as string
    contagem.set(k, (contagem.get(k) ?? 0) + 1)
  }

  return data.map((o) => ({
    id: o.id as string,
    status: o.status as 'rascunho' | 'finalizado',
    nivelProposto: (o.nivel_proposto as string | null) ?? null,
    valorIdeal: numOuNulo(o.valor_ideal),
    quantidadeItens: contagem.get(o.id as string) ?? 0,
    atualizadoEm: o.atualizado_em as string,
  }))
}
