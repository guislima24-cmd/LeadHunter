import { NextResponse, type NextRequest } from 'next/server'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { DOMINIO_PERMITIDO } from '@/lib/sessao'

/** Troca o código do OAuth por uma sessão e devolve o usuário à plataforma. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const codigo = searchParams.get('code')
  const proximo = searchParams.get('proximo') ?? '/'

  if (!codigo) {
    return NextResponse.redirect(`${origin}/login?motivo=falha`)
  }

  const supabase = await criarClienteServidor()
  const { data, error } = await supabase.auth.exchangeCodeForSession(codigo)

  if (error || !data.user?.email) {
    return NextResponse.redirect(`${origin}/login?motivo=falha`)
  }

  // O parâmetro `hd` do Google é uma dica, não uma garantia: quem trocar a
  // URL na mão consegue entrar com conta pessoal. A checagem real é aqui.
  if (!data.user.email.toLowerCase().endsWith(`@${DOMINIO_PERMITIDO}`)) {
    await supabase.auth.signOut()
    return NextResponse.redirect(`${origin}/login?motivo=dominio`)
  }

  // Só aceita caminho interno — evita redirect aberto para domínio externo.
  const destino = proximo.startsWith('/') && !proximo.startsWith('//') ? proximo : '/'
  return NextResponse.redirect(`${origin}${destino}`)
}
