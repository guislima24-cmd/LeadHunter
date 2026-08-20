import 'server-only'
import { createClient } from '@supabase/supabase-js'

/**
 * Cliente privilegiado (service role). **Nunca** chegue perto do navegador:
 * o import de `server-only` faz o build quebrar se alguém tentar.
 *
 * Toda leitura e escrita de dado de negócio da plataforma passa por aqui,
 * sempre depois de a rota confirmar quem é o membro logado.
 */
export function criarClienteAdmin() {
  // `.trim()` de propósito: chave colada em painel web costuma vir com
  // espaço ou quebra de linha na ponta, e o PostgREST devolve só
  // "Invalid API key", sem dizer que o problema é whitespace.
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!chave) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY não configurada. Veja .env.example.',
    )
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, chave, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
