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

  // Os três campos do plano de retomada seguem sempre, mesmo vazios: quem
  // decide se eles são obrigatórios é a função no banco, olhando o motivo
  // escolhido (`motivos_perda.exige_reagendamento`). Replicar essa checagem
  // aqui só criaria uma segunda regra para discordar da primeira.
  const resultado = await chamarRpcCrm<null>('crm_fechar_negocio', {
    p_negocio_id: id,
    p_status: status,
    p_membro_email: sessao.membro.email,
    p_motivo_perda_id: corpo.motivoPerdaId ?? null,
    p_motivo_detalhado: corpo.motivoDetalhado ?? null,
    p_contexto_para_retomada: corpo.contextoParaRetomada ?? null,
    p_data_recontato: corpo.dataRecontato || null,
  })

  if (!resultado.ok) {
    return Response.json(
      { erro: resultado.erro, mensagem: resultado.mensagem },
      { status: resultado.status ?? 500 },
    )
  }

  return Response.json({ ok: true })
}
