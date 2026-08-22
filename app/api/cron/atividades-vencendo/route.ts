import { criarClienteAdmin } from '@/lib/supabase/admin'

/**
 * Gera notificação in-app para atividades vencidas ou vencendo nas próximas
 * 24h (Seção 8.5 da especificação do CRM). Agendado no `vercel.json`.
 *
 * Só cria a notificação em `notificacoes` — **não envia email**. A
 * especificação pede o mesmo padrão de alerta do W9 (email com contexto
 * direto), mas isso é um novo fluxo de envio dentro do n8n, fora do que esta
 * rota (backend da aplicação Next.js) pode fazer sozinha; fica registrado
 * como próximo passo, não implementado silenciosamente pela metade.
 */
export async function GET(req: Request) {
  const segredo = process.env.CRON_SECRET
  if (segredo && req.headers.get('authorization') !== `Bearer ${segredo}`) {
    return new Response('Não autorizado', { status: 401 })
  }

  const admin = criarClienteAdmin()
  const daqui24h = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  const { data: atividades, error } = await admin
    .from('atividades')
    .select('id, titulo, data_prazo, responsavel_email')
    .eq('concluida', false)
    .not('data_prazo', 'is', null)
    .lte('data_prazo', daqui24h)

  if (error) {
    return Response.json(
      { erro: 'falha_ao_ler_atividades', mensagem: error.message },
      { status: 500 },
    )
  }

  if (!atividades || atividades.length === 0) {
    return Response.json({ notificacoesCriadas: 0 })
  }

  // Não duplica notificação para a mesma atividade enquanto a anterior
  // seguir não lida.
  const { data: existentes } = await admin
    .from('notificacoes')
    .select('referencia_id')
    .eq('tipo', 'atividade_vencendo')
    .eq('lida', false)
    .in(
      'referencia_id',
      atividades.map((a) => a.id),
    )

  const jaNotificadas = new Set((existentes ?? []).map((n) => n.referencia_id))
  const pendentes = atividades.filter((a) => !jaNotificadas.has(a.id))

  if (pendentes.length === 0) {
    return Response.json({ notificacoesCriadas: 0 })
  }

  const { error: erroInsercao } = await admin.from('notificacoes').insert(
    pendentes.map((a) => ({
      membro_email: a.responsavel_email,
      tipo: 'atividade_vencendo',
      referencia_tipo: 'atividade',
      referencia_id: a.id,
      titulo: `Prazo próximo: ${a.titulo}`,
    })),
  )

  if (erroInsercao) {
    return Response.json(
      { erro: 'falha_ao_notificar', mensagem: erroInsercao.message },
      { status: 500 },
    )
  }

  return Response.json({ notificacoesCriadas: pendentes.length })
}
