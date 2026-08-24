import { exigirMembroNaApi } from '@/lib/sessao'
import { chamarRpcCrm } from '@/lib/crm'

/**
 * Marca que o contato de uma retomada foi feito (Seção 4.3 do PRD).
 *
 * O negócio original continua perdido: se a conversa reaberta virar
 * oportunidade, ela nasce como negócio novo. Ressuscitar o fechado faria o
 * mesmo negócio contar duas vezes na conversão do funil.
 */
export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessao = await exigirMembroNaApi()
  if ('resposta' in sessao) return sessao.resposta

  const { id } = await params

  const resultado = await chamarRpcCrm<null>('crm_marcar_recontatado', {
    p_reagendamento_id: id,
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
