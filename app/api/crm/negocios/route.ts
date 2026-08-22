import { exigirMembroNaApi } from '@/lib/sessao'
import { chamarRpcCrm } from '@/lib/crm'

/**
 * Criação avulsa de negócio (Seção 8.2) — para organização/contato que já
 * existe no CRM, sem partir de um lead bruto (ex.: upsell após um negócio
 * anterior fechado).
 */
export async function POST(req: Request) {
  const sessao = await exigirMembroNaApi()
  if ('resposta' in sessao) return sessao.resposta

  const corpo = await req.json().catch(() => ({}))
  const organizacaoId = String(corpo.organizacaoId ?? '').trim()
  const titulo = String(corpo.titulo ?? '').trim()

  if (!organizacaoId || !titulo) {
    return Response.json(
      {
        erro: 'campos_obrigatorios',
        mensagem: 'Informe ao menos organizacaoId e titulo.',
      },
      { status: 400 },
    )
  }

  const resultado = await chamarRpcCrm<string>('crm_criar_negocio_avulso', {
    p_organizacao_id: organizacaoId,
    p_titulo: titulo,
    p_membro_email: sessao.membro.email,
    p_contato_id: corpo.contatoId ?? null,
    p_produto_servico_id: corpo.produtoServicoId ?? null,
    p_valor: corpo.valor ?? null,
    p_previsao_fechamento: corpo.previsaoFechamento ?? null,
  })

  if (!resultado.ok) {
    return Response.json(
      { erro: resultado.erro, mensagem: resultado.mensagem },
      { status: resultado.status ?? 500 },
    )
  }

  return Response.json({ negocioId: resultado.dados }, { status: 201 })
}
