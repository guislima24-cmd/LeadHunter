import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * No Next.js 16 o antigo `middleware.ts` passou a se chamar `proxy.ts`.
 *
 * Duas responsabilidades aqui:
 *  1. renovar o cookie de sessão do Supabase a cada requisição;
 *  2. barrar acesso anônimo às rotas da plataforma (checagem otimista — a
 *     autorização de verdade acontece em cada página/rota via `exigirMembro`).
 */

// `/api/saude` fica aberta de propósito: é como se confere, depois de um
// deploy, que o ambiente subiu configurado — sem precisar de sessão. Ela só
// devolve booleanos, nunca valor de chave nem dado de negócio.
const ROTAS_PUBLICAS = ['/login', '/auth', '/api/saude']

export async function proxy(request: NextRequest) {
  let resposta = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesParaGravar) {
          for (const { name, value } of cookiesParaGravar) {
            request.cookies.set(name, value)
          }
          resposta = NextResponse.next({ request })
          for (const { name, value, options } of cookiesParaGravar) {
            resposta.cookies.set(name, value, options)
          }
        },
      },
    },
  )

  // Renova a sessão. Não remova: sem esta chamada o token expira em aba aberta.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const caminho = request.nextUrl.pathname
  const ehPublica = ROTAS_PUBLICAS.some(
    (rota) => caminho === rota || caminho.startsWith(`${rota}/`),
  )

  if (!user && !ehPublica) {
    // Chamada de API recebe JSON, não redirecionamento: um 307 para /login
    // devolveria HTML no meio de um `fetch`, e o `res.json()` da tela
    // quebraria com erro de parsing em vez de dizer que a sessão expirou.
    if (caminho.startsWith('/api/')) {
      return NextResponse.json(
        {
          erro: 'sessao_expirada',
          mensagem: 'Sua sessão expirou. Entre novamente para continuar.',
        },
        { status: 401 },
      )
    }

    const destino = request.nextUrl.clone()
    destino.pathname = '/login'
    destino.search = caminho === '/' ? '' : `?proximo=${encodeURIComponent(caminho)}`
    return NextResponse.redirect(destino)
  }

  if (user && caminho === '/login') {
    const destino = request.nextUrl.clone()
    destino.pathname = '/'
    destino.search = ''
    return NextResponse.redirect(destino)
  }

  return resposta
}

export const config = {
  matcher: [
    /*
     * Roda em tudo, menos arquivos estáticos e imagens — evita custo de
     * sessão em requisição que não precisa dela.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
