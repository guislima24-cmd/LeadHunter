import { criarClienteAdmin } from '@/lib/supabase/admin'
import { exigirMembroNaApi } from '@/lib/sessao'

/**
 * Registra que um lead aceitou o contato ou respondeu o email (Seção 5.1.1).
 *
 * Manual porque nenhum workflow lê a caixa de entrada institucional hoje — o
 * W3 grava que o email saiu e o que acontece depois só quem conversou sabe.
 * O trade-off está registrado no PRD: mais simples de entregar agora, ao
 * custo de depender de o vendedor lembrar de marcar.
 *
 * Idempotente por (lead, tipo): dois cliques no mesmo botão não inflam a taxa
 * de aceite do mês. O índice único no banco é quem garante isso; aqui só se
 * traduz o conflito para uma resposta que a tela entende.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ cnpj: string }> },
) {
  const sessao = await exigirMembroNaApi()
  if ('resposta' in sessao) return sessao.resposta

  const { cnpj } = await params
  const corpo = await req.json().catch(() => ({}))
  const tipo = corpo.tipoEvento

  if (tipo !== 'aceite' && tipo !== 'resposta') {
    return Response.json(
      {
        erro: 'tipo_invalido',
        mensagem: 'O evento precisa ser "aceite" ou "resposta".',
      },
      { status: 400 },
    )
  }

  const admin = criarClienteAdmin()

  const { error } = await admin.from('funil_prospeccao_eventos').insert({
    lead_cnpj: decodeURIComponent(cnpj),
    tipo_evento: tipo,
    registrado_por_email: sessao.membro.email,
    observacao: corpo.observacao?.trim() || null,
  })

  if (error) {
    // 23505 = violação de unicidade: já registrado, o que é sucesso do ponto
    // de vista de quem clicou.
    if (error.code === '23505') {
      return Response.json({ ok: true, jaRegistrado: true })
    }
    return Response.json(
      { erro: 'falha_ao_registrar_evento', mensagem: error.message },
      { status: 500 },
    )
  }

  return Response.json({ ok: true, jaRegistrado: false })
}

/** Desfaz o registro — o botão marca e desmarca. */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ cnpj: string }> },
) {
  const sessao = await exigirMembroNaApi()
  if ('resposta' in sessao) return sessao.resposta

  const { cnpj } = await params
  const url = new URL(req.url)
  const tipo = url.searchParams.get('tipoEvento')

  if (tipo !== 'aceite' && tipo !== 'resposta') {
    return Response.json(
      {
        erro: 'tipo_invalido',
        mensagem: 'O evento precisa ser "aceite" ou "resposta".',
      },
      { status: 400 },
    )
  }

  const admin = criarClienteAdmin()
  const { error } = await admin
    .from('funil_prospeccao_eventos')
    .delete()
    .eq('lead_cnpj', decodeURIComponent(cnpj))
    .eq('tipo_evento', tipo)

  if (error) {
    return Response.json(
      { erro: 'falha_ao_remover_evento', mensagem: error.message },
      { status: 500 },
    )
  }

  return Response.json({ ok: true })
}
