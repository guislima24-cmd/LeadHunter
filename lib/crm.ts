import 'server-only'
import { criarClienteAdmin } from '@/lib/supabase/admin'

/**
 * Camada de acesso ao CRM (organizações/contatos/negócios) sobre a base de
 * leads brutos. Schema em n8n/sql/003_crm.sql e n8n/sql/004_crm_funcoes.sql.
 *
 * Os quatro fluxos que gravam em mais de uma tabela (promover lead, criar
 * negócio avulso, mover etapa, fechar negócio) são funções Postgres (RPC),
 * não sequências de chamadas daqui — para serem atômicas de verdade, mesmo
 * motivo pelo qual W1/W2/W3 já usam SQL puro em vez do nó Supabase do n8n.
 */

/** Mensagens em português para os erros que as funções RPC devolvem por nome. */
const MENSAGENS_ERRO_RPC: Record<string, { mensagem: string; status: number }> = {
  lead_nao_encontrado: { mensagem: 'Lead não encontrado na base.', status: 404 },
  sem_etapa_inicial_configurada: {
    mensagem: 'Nenhuma etapa de funil ativa está configurada. Peça a um admin para configurar as etapas.',
    status: 409,
  },
  organizacao_nao_encontrada: { mensagem: 'Organização não encontrada.', status: 404 },
  contato_nao_pertence_a_organizacao: {
    mensagem: 'Esse contato não pertence à organização informada.',
    status: 400,
  },
  negocio_nao_encontrado: { mensagem: 'Negócio não encontrado.', status: 404 },
  etapa_invalida: { mensagem: 'Etapa de funil inválida ou desativada.', status: 400 },
  status_invalido: { mensagem: 'Status inválido — use "ganho" ou "perdido".', status: 400 },
  motivo_perda_obrigatorio: {
    mensagem: 'Informe o motivo da perda para fechar o negócio como perdido.',
    status: 400,
  },
  negocio_nao_encontrado_ou_ja_fechado: {
    mensagem: 'Negócio não encontrado ou já está fechado.',
    status: 409,
  },
}

export interface RespostaRpc<T> {
  ok: boolean
  dados?: T
  erro?: string
  mensagem?: string
  status?: number
}

/**
 * Chama uma função RPC do CRM e traduz erro de negócio (`RAISE EXCEPTION` com
 * errcode P0001) para o mesmo formato `{ erro, mensagem }` usado no resto da
 * API — sem isso, o erro chegaria como um 500 genérico do PostgREST.
 */
export async function chamarRpcCrm<T>(
  nome: string,
  parametros: Record<string, unknown>,
): Promise<RespostaRpc<T>> {
  const admin = criarClienteAdmin()
  const { data, error } = await admin.rpc(nome, parametros)

  if (error) {
    const conhecido = MENSAGENS_ERRO_RPC[error.message]
    return {
      ok: false,
      erro: conhecido ? error.message : 'falha_no_banco',
      mensagem: conhecido?.mensagem ?? 'Não foi possível concluir a operação.',
      status: conhecido?.status ?? 500,
    }
  }

  return { ok: true, dados: data as T }
}

export interface EtapaFunil {
  id: string
  nome: string
  ordem: number
  cor: string | null
  ativo: boolean
}

/** Usado para validar `etapa_id` recebido do cliente antes de chamar a RPC. */
export async function listarEtapasAtivas(): Promise<EtapaFunil[]> {
  const admin = criarClienteAdmin()
  const { data } = await admin
    .from('etapas_funil')
    .select('id, nome, ordem, cor, ativo')
    .eq('ativo', true)
    .order('ordem', { ascending: true })
  return data ?? []
}

export interface NegocioNoQuadro {
  id: string
  titulo: string
  etapaId: string
  valor: number | null
  previsaoFechamento: string | null
  donoEmail: string
  donoNome: string
  organizacaoId: string
  organizacaoNome: string
  contatoNome: string | null
  produtoServico: string | null
  criadoEm: string
  /** Previsão de fechamento já venceu e o negócio segue aberto. */
  atrasado: boolean
}

export interface ColunaDoQuadro {
  etapa: EtapaFunil
  negocios: NegocioNoQuadro[]
  valorTotal: number
}

export interface QuadroNegocios {
  colunas: ColunaDoQuadro[]
  totalAbertos: number
  valorTotalAberto: number
  /** Quantos negócios fechados no mês corrente, para dar noção de saída do funil. */
  ganhosNoMes: number
  perdidosNoMes: number
}

/**
 * Monta o quadro (kanban) de negócios abertos, uma coluna por etapa ativa.
 *
 * Só negócios `aberto`: ganho e perdido saem do quadro, senão a coluna
 * "Contrato" viraria um cemitério que cresce para sempre. Os fechados do mês
 * aparecem como contador no topo.
 *
 * Traz todos os negócios da equipe, não só os do membro logado — a
 * visibilidade total entre membros é decisão registrada na especificação
 * (Seção 6). O recorte "só os meus" é filtro de tela, não de consulta.
 *
 * Lê de `vw_quadro_negocios` em vez de montar joins embedados do PostgREST:
 * o formato que o PostgREST devolve num embed varia com a cardinalidade que
 * ele infere, e o ambiente de desenvolvimento não alcança a API REST para
 * verificar isso. Em SQL o contrato é explícito e testável.
 */
export async function obterQuadroDeNegocios(): Promise<QuadroNegocios> {
  const admin = criarClienteAdmin()

  const [{ data: etapas }, { data: linhas }, { data: fechados }] =
    await Promise.all([
      admin
        .from('etapas_funil')
        .select('id, nome, ordem, cor, ativo')
        .eq('ativo', true)
        .order('ordem', { ascending: true }),
      admin
        .from('vw_quadro_negocios')
        .select('*')
        .eq('status', 'aberto')
        .order('criado_em', { ascending: false }),
      admin
        .from('negocios')
        .select('status')
        .in('status', ['ganho', 'perdido'])
        .gte('fechado_em', inicioDoMesCorrente()),
    ])

  const cartoes: NegocioNoQuadro[] = (linhas ?? []).map((n) => ({
    id: n.id as string,
    titulo: n.titulo as string,
    etapaId: n.etapa_id as string,
    // `numeric` do Postgres chega como string no PostgREST.
    valor: n.valor == null ? null : Number(n.valor),
    previsaoFechamento: (n.previsao_fechamento as string | null) ?? null,
    donoEmail: n.dono_email as string,
    donoNome: n.dono_nome as string,
    organizacaoId: n.organizacao_id as string,
    organizacaoNome: n.organizacao_nome as string,
    contatoNome: (n.contato_nome as string | null) ?? null,
    produtoServico: (n.produto_servico as string | null) ?? null,
    criadoEm: n.criado_em as string,
    atrasado: Boolean(n.atrasado),
  }))

  const colunas: ColunaDoQuadro[] = (etapas ?? []).map((etapa) => {
    const daEtapa = cartoes.filter((c) => c.etapaId === etapa.id)
    return {
      etapa: etapa as EtapaFunil,
      negocios: daEtapa,
      valorTotal: daEtapa.reduce((soma, c) => soma + (c.valor ?? 0), 0),
    }
  })

  return {
    colunas,
    totalAbertos: cartoes.length,
    valorTotalAberto: cartoes.reduce((soma, c) => soma + (c.valor ?? 0), 0),
    ganhosNoMes: (fechados ?? []).filter((f) => f.status === 'ganho').length,
    perdidosNoMes: (fechados ?? []).filter((f) => f.status === 'perdido').length,
  }
}

function inicioDoMesCorrente(): string {
  const d = new Date()
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export interface NegocioDoLead {
  negocioId: string
  titulo: string
  etapaNome: string
  status: string
}

/**
 * Para os leads de uma lista, quais já viraram negócio.
 *
 * A tela usa isto para não oferecer "Iniciar negócio" duas vezes para a mesma
 * empresa — a RPC é idempotente por CNPJ, mas oferecer o botão de novo dá a
 * impressão errada de que nada aconteceu da primeira vez.
 */
export async function obterNegociosPorCnpj(
  cnpjs: string[],
): Promise<Map<string, NegocioDoLead>> {
  if (cnpjs.length === 0) return new Map()

  const admin = criarClienteAdmin()
  const { data } = await admin
    .from('vw_quadro_negocios')
    .select('id, titulo, status, lead_origem_cnpj, etapa_nome')
    .in('lead_origem_cnpj', cnpjs)
    .order('criado_em', { ascending: false })

  const porCnpj = new Map<string, NegocioDoLead>()
  for (const n of data ?? []) {
    const cnpj = n.lead_origem_cnpj as string | null
    if (!cnpj || porCnpj.has(cnpj)) continue
    porCnpj.set(cnpj, {
      negocioId: n.id as string,
      titulo: n.titulo as string,
      etapaNome: (n.etapa_nome as string) ?? 'Sem etapa',
      status: n.status as string,
    })
  }
  return porCnpj
}

export interface MotivoPerda {
  id: string
  nome: string
}

export async function listarMotivosPerda(): Promise<MotivoPerda[]> {
  const admin = criarClienteAdmin()
  const { data } = await admin
    .from('motivos_perda')
    .select('id, nome')
    .eq('ativo', true)
    .order('ordem', { ascending: true })
  return data ?? []
}
