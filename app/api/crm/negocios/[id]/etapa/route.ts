import { exigirMembroNaApi } from '@/lib/sessao'
import { chamarRpcCrm } from '@/lib/crm'

/**
 * Move um negócio para outra etapa do funil (Seção 8.3).
 *
 * Livre em qualquer direção — sem trava de "não pode voltar etapa" nesta
 * fase, decisão já registrada na especificação.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessao = await exigirMembroNaApi()
  if ('resposta' in sessao) return sessao.resposta

  const { id } = await params
  const corpo = await req.json().catch(() => ({}))
  const etapaId = String(corpo.etapaId ?? '').trim()

  if (!etapaId) {
    return Response.json(
      { erro: 'etapa_obrigatoria', mensagem: 'Informe etapaId.' },
      { status: 400 },
    )
  }

  const resultado = await chamarRpcCrm<null>('crm_mover_etapa', {
    p_negocio_id: id,
    p_etapa_id: etapaId,
    p_membro_email: sessao.membro.email,
  })

  if (!resultado.ok) {
    return Response.json(
      { erro: resultado.erro, mensagem: resultado.mensagem },
      { status: resultado.status ?? 500 },
    )
  }

  return Response.json({ ok: true })
}
