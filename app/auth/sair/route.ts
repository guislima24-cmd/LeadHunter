import { NextResponse, type NextRequest } from 'next/server'
import { criarClienteServidor } from '@/lib/supabase/servidor'

export async function POST(request: NextRequest) {
  const supabase = await criarClienteServidor()
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/login', request.nextUrl.origin), {
    status: 303,
  })
}
