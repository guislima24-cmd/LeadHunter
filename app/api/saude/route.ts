import { criarClienteAdmin } from '@/lib/supabase/admin'

/**
 * Verificação de configuração do ambiente.
 *
 * Serve para confirmar, depois de um deploy, que as variáveis e integrações
 * estão de pé — sem precisar logar. Responde **apenas** com booleanos e
 * mensagens de erro do próprio serviço: nenhum valor de chave, nenhum dado
 * de negócio e nenhuma contagem real saem por aqui.
 */
export const dynamic = 'force-dynamic'

interface Checagem {
  ok: boolean
  detalhe?: string
}

/**
 * Identifica **que tipo** de chave foi configurada, sem revelar o valor.
 *
 * O engano mais comum é colar a chave `anon` (ou uma `publishable`) no lugar
 * da `service_role`. As duas parecem iguais a olho nu, e a mensagem de erro
 * do PostgREST não diz qual veio.
 */
function diagnosticarChave(): {
  formato: string
  papelDeclarado: string | null
  tinhaEspacos: boolean
  segmentos: number
} {
  const bruta = process.env.SUPABASE_SERVICE_ROLE_KEY
  const chave = bruta?.trim()
  const base = {
    tinhaEspacos: Boolean(bruta && bruta !== chave),
    segmentos: chave ? chave.split('.').length : 0,
  }
  if (!chave) return { formato: 'ausente', papelDeclarado: null, ...base }

  if (chave.startsWith('sb_secret_'))
    return { formato: 'sb_secret', papelDeclarado: 'service_role', ...base }
  if (chave.startsWith('sb_publishable_'))
    return { formato: 'sb_publishable', papelDeclarado: 'anon', ...base }

  // Chave legada: é um JWT, e o payload traz o papel em claro.
  const partes = chave.split('.')
  if (partes.length !== 3) {
    return { formato: 'irreconhecivel', papelDeclarado: null, ...base }
  }

  try {
    const payload = JSON.parse(
      Buffer.from(partes[1], 'base64url').toString('utf8'),
    ) as { role?: string }
    return { formato: 'jwt', papelDeclarado: payload.role ?? null, ...base }
  } catch {
    return { formato: 'jwt_ilegivel', papelDeclarado: null, ...base }
  }
}

async function checarBanco(): Promise<Checagem> {
  try {
    const db = criarClienteAdmin()
    // Sem `head: true` de propósito: numa requisição HEAD o corpo vem vazio,
    // então o motivo da falha (chave inválida, tabela ausente) se perde e o
    // erro chega com `message` em branco. O dado lido não sai desta função.
    const { error } = await db.from('member_profiles').select('papel').limit(1)

    if (error) {
      const partes = [error.message, error.hint, error.code].filter(Boolean)
      const detalhe = partes.join(' · ') || 'erro sem detalhe'
      // Também no log da Vercel: é por onde se investiga quando a resposta
      // da rota não está acessível (proteção de deployment ligada, p. ex.).
      console.error('[saude] falha no banco:', detalhe, diagnosticarChave())
      return { ok: false, detalhe }
    }
    return { ok: true }
  } catch (erro) {
    return {
      ok: false,
      detalhe: erro instanceof Error ? erro.message : 'falha desconhecida',
    }
  }
}

async function checarProvedorGoogle(): Promise<Checagem> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) return { ok: false, detalhe: 'supabase não configurado' }

  try {
    // Endpoint público do GoTrue: lista quais provedores estão ligados.
    const resposta = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: anon },
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    })

    if (!resposta.ok) {
      return { ok: false, detalhe: `settings respondeu ${resposta.status}` }
    }

    const dados = (await resposta.json()) as {
      external?: Record<string, boolean>
    }

    return dados.external?.google
      ? { ok: true }
      : { ok: false, detalhe: 'provedor google desligado no supabase' }
  } catch (erro) {
    return {
      ok: false,
      detalhe: erro instanceof Error ? erro.message : 'falha desconhecida',
    }
  }
}

export async function GET() {
  const [banco, google] = await Promise.all([
    checarBanco(),
    checarProvedorGoogle(),
  ])

  const obrigatorias = {
    NEXT_PUBLIC_SUPABASE_URL: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  }

  // `lib/n8n.ts` já cai na instância padrão quando esta não existe, então a
  // ausência é informação, não falha.
  const opcionais = {
    N8N_WEBHOOK_BASE: Boolean(process.env.N8N_WEBHOOK_BASE),
  }

  const tudoOk =
    banco.ok && google.ok && Object.values(obrigatorias).every(Boolean)

  return Response.json(
    {
      ok: tudoOk,
      obrigatorias,
      opcionais,
      banco,
      google,
      chaveServico: diagnosticarChave(),
      verificadoEm: new Date().toISOString(),
    },
    { status: tudoOk ? 200 : 503 },
  )
}
