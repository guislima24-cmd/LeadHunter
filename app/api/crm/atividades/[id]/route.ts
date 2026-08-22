import { exigirMembroNaApi } from '@/lib/sessao'
import { criarClienteAdmin } from '@/lib/supabase/admin'

/** Marca uma atividade como concluída (ou reabre) e/ou edita seus campos. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessao = await exigirMembroNaApi()
  if ('resposta' in sessao) return sessao.resposta

  const { id } = await params
  const corpo = await req.json().catch(() => ({}))

  const atualizacao: Record<string, unknown> = {}
  if ('titulo' in corpo) atualizacao.titulo = corpo.titulo
  if ('descricao' in corpo) atualizacao.descricao = corpo.descricao
  if ('dataPrazo' in corpo) atualizacao.data_prazo = corpo.dataPrazo
  if ('concluida' in corpo) {
    atualizacao.concluida = Boolean(corpo.concluida)
    atualizacao.concluida_em = corpo.concluida ? new Date().toISOString() : null
  }

  if (Object.keys(atualizacao).length === 0) {
    return Response.json(
      { erro: 'nada_para_atualizar', mensagem: 'Nenhum campo foi informado.' },
      { status: 400 },
    )
  }

  const admin = criarClienteAdmin()
  const { data, error } = await admin
    .from('atividades')
    .update(atualizacao)
    .eq('id', id)
    .select('id')
    .maybeSingle()

  if (error || !data) {
    return Response.json(
      { erro: 'atividade_nao_encontrada', mensagem: 'Atividade não encontrada.' },
      { status: 404 },
    )
  }

  return Response.json({ ok: true })
}
