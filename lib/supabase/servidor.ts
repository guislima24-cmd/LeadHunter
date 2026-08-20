import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Cliente de servidor ligado aos cookies da requisição — é ele que sabe
 * quem está logado. Usa a chave anon: serve para ler a sessão, não para
 * acessar dados privilegiados.
 */
export async function criarClienteServidor() {
  const armazemCookies = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return armazemCookies.getAll()
        },
        setAll(cookiesParaGravar) {
          try {
            for (const { name, value, options } of cookiesParaGravar) {
              armazemCookies.set(name, value, options)
            }
          } catch {
            // Server Components não podem gravar cookies. O proxy.ts renova a
            // sessão antes da renderização, então ignorar aqui é seguro.
          }
        },
      },
    },
  )
}
