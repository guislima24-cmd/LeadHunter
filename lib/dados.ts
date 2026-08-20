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
      contar('leads').eq('enriquecimento_status', 'concluido'),
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
