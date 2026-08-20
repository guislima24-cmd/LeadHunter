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

async function checarBanco(): Promise<Checagem> {
  try {
    const db = criarClienteAdmin()
    // `head: true` + limite 1: confirma que a chave autentica e que o
    // PostgREST responde, sem trazer linha nenhuma.
    const { error } = await db
      .from('member_profiles')
      .select('email', { count: 'exact', head: true })
      .limit(1)

    if (error) return { ok: false, detalhe: error.message }
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

  const variaveis = {
    NEXT_PUBLIC_SUPABASE_URL: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    N8N_WEBHOOK_BASE: Boolean(process.env.N8N_WEBHOOK_BASE),
  }

  const tudoOk =
    banco.ok && google.ok && Object.values(variaveis).every(Boolean)

  return Response.json(
    { ok: tudoOk, variaveis, banco, google, verificadoEm: new Date().toISOString() },
    { status: tudoOk ? 200 : 503 },
  )
}
