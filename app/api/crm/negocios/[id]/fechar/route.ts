import { exigirMembroNaApi } from '@/lib/sessao'
import { chamarRpcCrm } from '@/lib/crm'

/** Marca um negócio aberto como ganho ou perdido (Seção 8.4). */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessao = await exigirMembroNaApi()
  if ('resposta' in sessao) return sessao.resposta

  const { id } = await params
  const corpo = await req.json().catch(() => ({}))
  const status = corpo.status

  if (status !== 'ganho' && status !== 'perdido') {
    return Response.json(
      {
        erro: 'status_invalido',
        mensagem: 'status precisa ser "ganho" ou "perdido".',
      },
      { status: 400 },
    )
  }

  const resultado = await chamarRpcCrm<null>('crm_fechar_negocio', {
    p_negocio_id: id,
    p_status: status,
    p_membro_email: sessao.membro.email,
    p_motivo_perda_id: corpo.motivoPerdaId ?? null,
  })

  if (!resultado.ok) {
    return Response.json(
      { erro: resultado.erro, mensagem: resultado.mensagem },
      { status: resultado.status ?? 500 },
    )
  }

  return Response.json({ ok: true })
}
