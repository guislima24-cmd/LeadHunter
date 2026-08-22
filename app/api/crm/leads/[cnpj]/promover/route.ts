import { exigirMembroNaApi } from '@/lib/sessao'
import { chamarRpcCrm } from '@/lib/crm'

/**
 * Promove um lead bruto (base de Receita Federal/Maps) a negócio no CRM.
 *
 * Ação manual e explícita do membro — nenhuma automação faz isso sozinha
 * (Seção 1 da especificação). Idempotente por CNPJ: chamar duas vezes para
 * o mesmo lead reaproveita a organização/contato já criados na primeira vez,
 * em vez de duplicar.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ cnpj: string }> },
) {
  const sessao = await exigirMembroNaApi()
  if ('resposta' in sessao) return sessao.resposta

  const { cnpj } = await params
  const corpo = await req.json().catch(() => ({}))
  const titulo = typeof corpo.titulo === 'string' ? corpo.titulo.trim() : undefined

  const resultado = await chamarRpcCrm<string>('crm_promover_lead', {
    p_cnpj: cnpj,
    p_membro_email: sessao.membro.email,
    p_titulo: titulo || null,
  })

  if (!resultado.ok) {
    return Response.json(
      { erro: resultado.erro, mensagem: resultado.mensagem },
      { status: resultado.status ?? 500 },
    )
  }

  return Response.json({ negocioId: resultado.dados }, { status: 201 })
}
