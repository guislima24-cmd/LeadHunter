import { createBrowserClient } from '@supabase/ssr'

/**
 * Cliente do navegador — usado **somente** para autenticação
 * (login com Google, logout, leitura da sessão).
 *
 * Nenhuma leitura de dado de negócio passa por aqui: tudo vem das rotas
 * server-side, que usam a service role e checam a sessão antes de responder.
 */
export function criarClienteNavegador() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
