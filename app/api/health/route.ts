import { NextResponse } from 'next/server'
import { getSupabase, describeSupabaseError } from '@/lib/supabase'

// Diagnóstico rápido: env vars + ping leve no Supabase. Use para depurar
// quando a busca falha. Retorna 200 mesmo em erro para o front exibir o motivo.
export async function GET() {
  const cfg = getSupabase()
  if (!cfg.ok) {
    return NextResponse.json({
      ok: false,
      stage: 'env',
      reason: cfg.reason,
      message: cfg.message,
    })
  }

  try {
    // HEAD-like: pega 1 linha apenas para validar conectividade e schema.
    const { error } = await cfg.client.from('leads').select('id').limit(1)
    if (error) {
      return NextResponse.json({
        ok: false,
        stage: 'query',
        message: describeSupabaseError(error),
        code: error.code,
        raw: error.message,
      })
    }
    return NextResponse.json({ ok: true, supabaseUrl: cfg.url })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({
      ok: false,
      stage: 'network',
      message: describeSupabaseError({ message: msg }),
      raw: msg,
    })
  }
}
