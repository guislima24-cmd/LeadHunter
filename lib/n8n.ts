import 'server-only'

/**
 * Chamadas aos webhooks do n8n.
 *
 * Sempre a partir do servidor, nunca do navegador: assim a URL da instância
 * não vaza, o campo `membro` é injetado a partir da sessão (ninguém dispara
 * automação em nome de outro) e não há CORS no caminho.
 */

const BASE = process.env.N8N_WEBHOOK_BASE ?? 'https://guizo.app.n8n.cloud/webhook'

export const ROTAS_N8N = {
  gerarLista: '/leadhunter/gerar-lista',
  enriquecer: '/leadhunter/enriquecer',
  prospectar: '/leadhunter/prospectar',
  maps: '/apollo/maps',
} as const

export type RespostaN8n<T> =
  | { ok: true; dados: T }
  | { ok: false; status: number; erro: string; detalhe?: string }

/**
 * Os workflows do W1 e do W5 percorrem listas inteiras e podem levar minutos.
 * O padrão do fetch não tem timeout, então um workflow travado deixaria a
 * rota pendurada — daí o AbortSignal explícito.
 */
export async function chamarN8n<T>(
  rota: string,
  corpo: unknown,
  { timeoutMs = 120_000 }: { timeoutMs?: number } = {},
): Promise<RespostaN8n<T>> {
  const cabecalhos: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  const nomeHeader = process.env.N8N_WEBHOOK_HEADER_NOME
  const valorHeader = process.env.N8N_WEBHOOK_HEADER_VALOR
  if (nomeHeader && valorHeader) cabecalhos[nomeHeader] = valorHeader

  try {
    const resposta = await fetch(`${BASE}${rota}`, {
      method: 'POST',
      headers: cabecalhos,
      body: JSON.stringify(corpo),
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    })

    const texto = await resposta.text()

    if (!resposta.ok) {
      return {
        ok: false,
        status: resposta.status,
        erro:
          resposta.status === 404
            ? 'webhook_nao_encontrado'
            : 'falha_no_workflow',
        detalhe: texto.slice(0, 500),
      }
    }

    if (!texto) return { ok: true, dados: {} as T }

    try {
      return { ok: true, dados: JSON.parse(texto) as T }
    } catch {
      return {
        ok: false,
        status: 502,
        erro: 'resposta_invalida',
        detalhe: texto.slice(0, 500),
      }
    }
  } catch (erro) {
    const ehTimeout = erro instanceof Error && erro.name === 'TimeoutError'
    return {
      ok: false,
      status: ehTimeout ? 504 : 502,
      erro: ehTimeout ? 'tempo_esgotado' : 'sem_conexao',
      detalhe:
        erro instanceof Error ? erro.message : 'Falha ao contatar o n8n.',
    }
  }
}

/** Mensagens em português para os erros que o usuário pode ver. */
export const MENSAGENS_ERRO_N8N: Record<string, string> = {
  webhook_nao_encontrado:
    'O workflow correspondente não está publicado no n8n. Publique-o e tente de novo.',
  falha_no_workflow:
    'O workflow foi acionado mas retornou erro. Confira o Monitoramento para o detalhe.',
  resposta_invalida: 'O workflow respondeu em um formato inesperado.',
  tempo_esgotado:
    'O workflow demorou demais para responder. Ele pode ter continuado rodando — confira o resultado antes de disparar de novo.',
  sem_conexao: 'Não foi possível falar com o n8n. Verifique se a instância está no ar.',
}
