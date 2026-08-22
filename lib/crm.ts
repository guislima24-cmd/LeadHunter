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
