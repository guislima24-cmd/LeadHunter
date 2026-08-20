import 'server-only'
import { criarClienteAdmin } from '@/lib/supabase/admin'

/**
 * Camada de leitura da plataforma.
 *
 * Tudo aqui roda no servidor com a service role — as páginas só chamam
 * depois de `exigirMembro()`, então o recorte por membro é feito com o valor
 * que veio da sessão, nunca de um parâmetro da URL.
 */

export interface ListaGerada {
  id: string
  membro: string | null
  setor: string | null
  cidade: string | null
  criadaEm: string
  quantidadeLeads: number
  leadCnpjs: string[]
}

export interface LeadDaLista {
  cnpj: string
  razaoSocial: string
  nomeFantasia: string | null
  setor: string | null
  porte: string | null
  cidade: string | null
  estado: string | null
  telefone: string | null
  email: string | null
  site: string | null
  decisorNome: string | null
  decisorCargo: string | null
  decisorLinkedin: string | null
  enriquecimentoStatus: string | null
  enriquecidoEm: string | null
  contatadoEm: string | null
  contatadoPor: string | null
}

export interface ResumoInicio {
  leadsNaBase: number
  minhasListas: number
  leadsNasListas: number
  emailsEnviados: number
  reservasAtivas: number
  enriquecidos: number
  pendentesEnriquecimento: number
  ultimasListas: ListaGerada[]
}

function mapearLista(linha: Record<string, unknown>): ListaGerada {
  return {
    id: String(linha.id),
    membro: (linha.membro as string) ?? null,
    setor: (linha.setor as string) ?? null,
    cidade: (linha.cidade as string) ?? null,
    criadaEm: String(linha.criada_em),
    quantidadeLeads: Number(linha.quantidade_leads ?? 0),
    leadCnpjs: (linha.lead_cnpjs as string[]) ?? [],
  }
}

export async function obterResumoInicio(membro: string | null): Promise<ResumoInicio> {
  const db = criarClienteAdmin()

  // `head: true` traz só o total — nenhuma linha trafega.
  const contar = (tabela: string) =>
    db.from(tabela).select('*', { count: 'exact', head: true })

  const [leadsNaBase, listasDoMembro, emails, reservas, enriquecidos, pendentes, ultimas] =
    await Promise.all([
      contar('leads'),
      membro
        ? contar('listas_geradas').eq('membro', membro)
        : Promise.resolve({ count: 0 }),
      membro
        ? contar('emails_enviados').eq('membro', membro).eq('status', 'enviado')
        : Promise.resolve({ count: 0 }),
      membro
        ? contar('lead_reservas').eq('membro', membro).gt('expira_em', new Date().toISOString())
        : Promise.resolve({ count: 0 }),
      contar('leads').eq('enriquecimento_status', 'ok'),
      contar('leads').eq('enriquecimento_status', 'pendente'),
      membro
        ? db
            .from('listas_geradas')
            .select('id, membro, setor, cidade, criada_em, quantidade_leads, lead_cnpjs')
            .eq('membro', membro)
            .order('criada_em', { ascending: false })
            .limit(5)
        : Promise.resolve({ data: [] }),
    ])

  const listas = ((ultimas as { data?: Record<string, unknown>[] }).data ?? []).map(
    mapearLista,
  )

  return {
    leadsNaBase: leadsNaBase.count ?? 0,
    minhasListas: listasDoMembro.count ?? 0,
    leadsNasListas: listas.reduce((soma, l) => soma + l.quantidadeLeads, 0),
    emailsEnviados: emails.count ?? 0,
    reservasAtivas: reservas.count ?? 0,
    enriquecidos: enriquecidos.count ?? 0,
    pendentesEnriquecimento: pendentes.count ?? 0,
    ultimasListas: listas,
  }
}

export async function listarListas(membro: string): Promise<ListaGerada[]> {
  const db = criarClienteAdmin()
  const { data } = await db
    .from('listas_geradas')
    .select('id, membro, setor, cidade, criada_em, quantidade_leads, lead_cnpjs')
    .eq('membro', membro)
    .order('criada_em', { ascending: false })
    .limit(100)

  return (data ?? []).map(mapearLista)
}

export async function obterLista(
  id: string,
  membro: string,
): Promise<{ lista: ListaGerada; leads: LeadDaLista[] } | null> {
  const db = criarClienteAdmin()

  const { data: linha } = await db
    .from('listas_geradas')
    .select('id, membro, setor, cidade, criada_em, quantidade_leads, lead_cnpjs')
    .eq('id', id)
    .maybeSingle()

  // Uma lista só é visível para quem a gerou.
  if (!linha || linha.membro !== membro) return null

  const lista = mapearLista(linha)
  if (lista.leadCnpjs.length === 0) return { lista, leads: [] }

  const { data: leads } = await db
    .from('leads')
    // Uma string literal só: o parser de tipos do supabase-js não entende
    // seleção montada por concatenação e cai em `GenericStringError`.
    .select('cnpj, razao_social, nome_fantasia, setor, porte, cidade, estado, telefone, email, site_confirmado, decisor_nome, decisor_cargo, decisor_linkedin_url, enriquecimento_status, enriquecido_em, contatado_em, contatado_por')
    .in('cnpj', lista.leadCnpjs)

  return {
    lista,
    leads: (leads ?? []).map((l: Record<string, unknown>) => ({
      cnpj: String(l.cnpj ?? ''),
      razaoSocial: String(l.razao_social ?? 'Empresa sem nome'),
      nomeFantasia: (l.nome_fantasia as string) || null,
      setor: (l.setor as string) || null,
      porte: (l.porte as string) || null,
      cidade: (l.cidade as string) || null,
      estado: (l.estado as string) || null,
      telefone: (l.telefone as string) || null,
      email: (l.email as string) || null,
      site: (l.site_confirmado as string) || null,
      decisorNome: (l.decisor_nome as string) || null,
      decisorCargo: (l.decisor_cargo as string) || null,
      decisorLinkedin: (l.decisor_linkedin_url as string) || null,
      enriquecimentoStatus: (l.enriquecimento_status as string) || null,
      enriquecidoEm: (l.enriquecido_em as string) || null,
      contatadoEm: (l.contatado_em as string) || null,
      contatadoPor: (l.contatado_por as string) || null,
    })),
  }
}

export interface EtapaFunil {
  chave: string
  rotulo: string
  descricao: string
  quantidade: number
}

export interface MetricaFunilW7 {
  etapa: string
  ordem: number
  quantidadeAtual: number
  taxaConversao: number | null
  tempoMedioDias: number | null
  totalLeads: number
  observacoesIa: string | null
}

/** Funil que a própria plataforma movimenta, do lead gerado ao email enviado. */
export async function obterFunilDoMembro(membro: string | null): Promise<EtapaFunil[]> {
  if (!membro) return []

  const db = criarClienteAdmin()
  const { data } = await db.rpc('funil_do_membro', { p_membro: membro })
  const linha = (Array.isArray(data) ? data[0] : data) as
    | Record<string, number>
    | undefined

  return [
    {
      chave: 'gerados',
      rotulo: 'Leads gerados',
      descricao: 'Entraram em alguma lista sua, já sem duplicados',
      quantidade: Number(linha?.leads_gerados ?? 0),
    },
    {
      chave: 'reservados',
      rotulo: 'Reservados agora',
      descricao: 'Travados no seu nome, dentro da janela de 24 h',
      quantidade: Number(linha?.reservas_ativas ?? 0),
    },
    {
      chave: 'enriquecidos',
      rotulo: 'Enriquecidos pela IA',
      descricao: 'Com decisor, site e contexto da web confirmados',
      quantidade: Number(linha?.enriquecidos ?? 0),
    },
    {
      chave: 'emails',
      rotulo: 'Emails enviados',
      descricao: 'Prospecção disparada pela plataforma',
      quantidade: Number(linha?.emails_enviados ?? 0),
    },
    {
      chave: 'contatados',
      rotulo: 'Leads contatados',
      descricao: 'Marcados como contatados na base',
      quantidade: Number(linha?.contatados ?? 0),
    },
  ]
}

/** Última fotografia do funil comercial calculada pelo W7. */
export async function obterMetricasW7(): Promise<{
  calculadoEm: string | null
  metricas: MetricaFunilW7[]
}> {
  const db = criarClienteAdmin()

  const { data: maisRecente } = await db
    .from('funil_metricas')
    .select('calculado_em')
    .order('calculado_em', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!maisRecente?.calculado_em) return { calculadoEm: null, metricas: [] }

  const { data } = await db
    .from('funil_metricas')
    .select('etapa, ordem, quantidade_atual, taxa_conversao, tempo_medio_dias, total_leads, observacoes_ia')
    .eq('calculado_em', maisRecente.calculado_em)
    .order('ordem', { ascending: true })

  return {
    calculadoEm: maisRecente.calculado_em,
    metricas: (data ?? []).map((m) => ({
      etapa: String(m.etapa),
      ordem: Number(m.ordem ?? 0),
      quantidadeAtual: Number(m.quantidade_atual ?? 0),
      taxaConversao: m.taxa_conversao == null ? null : Number(m.taxa_conversao),
      tempoMedioDias:
        m.tempo_medio_dias == null ? null : Number(m.tempo_medio_dias),
      totalLeads: Number(m.total_leads ?? 0),
      observacoesIa: (m.observacoes_ia as string) || null,
    })),
  }
}

export interface FalhaWorkflow {
  id: string
  workflowNome: string | null
  execucaoId: string | null
  noComErro: string | null
  mensagem: string | null
  ocorridoEm: string
}

export interface PainelMonitoramento {
  falhas: FalhaWorkflow[]
  falhasNoMes: number
  falhasPorWorkflow: Array<{ workflow: string; total: number }>
  tavilyCreditosMes: number
  tavilyLeadsMes: number
}

export async function obterMonitoramento(): Promise<PainelMonitoramento> {
  const db = criarClienteAdmin()
  const inicioDoMes = new Date()
  inicioDoMes.setDate(1)
  inicioDoMes.setHours(0, 0, 0, 0)
  const desde = inicioDoMes.toISOString()

  const [falhasRecentes, totalMes, usoTavily] = await Promise.all([
    db
      .from('n8n_erros')
      .select('id, workflow_nome, execucao_id, no_com_erro, mensagem, ocorrido_em')
      .order('ocorrido_em', { ascending: false })
      .limit(40),
    db
      .from('n8n_erros')
      .select('*', { count: 'exact', head: true })
      .gte('ocorrido_em', desde),
    db
      .from('tavily_uso')
      .select('creditos_estimados')
      .gte('criado_em', desde),
  ])

  const falhas: FalhaWorkflow[] = (falhasRecentes.data ?? []).map((f) => ({
    id: String(f.id),
    workflowNome: (f.workflow_nome as string) || null,
    execucaoId: (f.execucao_id as string) || null,
    noComErro: (f.no_com_erro as string) || null,
    mensagem: (f.mensagem as string) || null,
    ocorridoEm: String(f.ocorrido_em),
  }))

  const porWorkflow = new Map<string, number>()
  for (const falha of falhas) {
    const nome = falha.workflowNome ?? 'Desconhecido'
    porWorkflow.set(nome, (porWorkflow.get(nome) ?? 0) + 1)
  }

  const linhasTavily = usoTavily.data ?? []

  return {
    falhas,
    falhasNoMes: totalMes.count ?? 0,
    falhasPorWorkflow: [...porWorkflow.entries()]
      .map(([workflow, total]) => ({ workflow, total }))
      .sort((a, b) => b.total - a.total),
    tavilyCreditosMes: linhasTavily.reduce(
      (soma, l) => soma + Number(l.creditos_estimados ?? 0),
      0,
    ),
    tavilyLeadsMes: linhasTavily.length,
  }
}
