import { createClient, SupabaseClient } from '@supabase/supabase-js'

export type SupabaseConfigError =
  | { ok: false; reason: 'missing_url'; message: string }
  | { ok: false; reason: 'missing_key'; message: string }

export type SupabaseConfigResult =
  | { ok: true; client: SupabaseClient; url: string }
  | SupabaseConfigError

// Aceita NEXT_PUBLIC_* (legado/cliente) ou as variáveis server-only equivalentes.
function readEnv(): { url?: string; key?: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY
  return { url, key }
}

export function getSupabase(): SupabaseConfigResult {
  const { url, key } = readEnv()

  if (!url) {
    return {
      ok: false,
      reason: 'missing_url',
      message:
        'Variável NEXT_PUBLIC_SUPABASE_URL não está configurada. Adicione no .env.local (dev) ou nas variáveis de ambiente do deploy.',
    }
  }

  if (!key) {
    return {
      ok: false,
      reason: 'missing_key',
      message:
        'Variável NEXT_PUBLIC_SUPABASE_ANON_KEY não está configurada. Adicione no .env.local (dev) ou nas variáveis de ambiente do deploy.',
    }
  }

  return { ok: true, client: createClient(url, key), url }
}

// Mapeia erros do Supabase para mensagens humanas com hint acionável.
export function describeSupabaseError(err: { message?: string; code?: string; details?: string } | null): string {
  if (!err) return 'Erro desconhecido do Supabase'
  const msg = err.message || ''

  if (/fetch failed|ENOTFOUND|ECONNREFUSED|getaddrinfo/i.test(msg)) {
    return 'Não foi possível alcançar o Supabase. Verifique sua conexão e a URL do projeto.'
  }
  if (/JWT|invalid api key|401|unauthorized/i.test(msg)) {
    return 'Chave do Supabase inválida ou expirada. Gere uma nova ANON KEY no painel e atualize a env var.'
  }
  if (/project paused|paused|503/i.test(msg)) {
    return 'Projeto Supabase pausado por inatividade (free tier). Acesse o painel do Supabase e clique em "Restore project".'
  }
  if (/timeout|timed out/i.test(msg)) {
    return 'Timeout no Supabase. Tente reduzir a quantidade ou simplificar os filtros.'
  }
  if (err.code === '42P01' || /relation .* does not exist/i.test(msg)) {
    return 'Tabela "leads" não existe no Supabase. Verifique se o schema foi criado.'
  }
  return msg
}
