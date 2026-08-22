import { exigirMembroNaApi, exigirAdmin } from '@/lib/sessao'
import { criarClienteAdmin } from '@/lib/supabase/admin'

const CAMPOS_EDITAVEIS = [
  'titulo',
  'valor',
  'produto_servico_id',
  'previsao_fechamento',
  'contato_id',
] as const

/**
 * Edição de campos de um negócio que não mexem em etapa nem em status
 * (isso é PATCH /etapa e PATCH /fechar, que são transacionais).
 *
 * Reatribuir o dono (`dono_email`) é a única ação desta tela restrita a
 * admin — Seção 5 da especificação. Todo o resto qualquer membro edita.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessao = await exigirMembroNaApi()
  if ('resposta' in sessao) return sessao.resposta

  const { id } = await params
  const corpo = await req.json().catch(() => ({}))

  const atualizacao: Record<string, unknown> = {}
  for (const campo of CAMPOS_EDITAVEIS) {
    const chave = campo.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
    if (chave in corpo) atualizacao[campo] = corpo[chave]
  }

  if ('donoEmail' in corpo) {
    const negado = exigirAdmin(sessao.membro)
    if (negado) return negado
    atualizacao.dono_email = corpo.donoEmail
  }

  if (Object.keys(atualizacao).length === 0) {
    return Response.json(
      { erro: 'nada_para_atualizar', mensagem: 'Nenhum campo editável foi informado.' },
      { status: 400 },
    )
  }

  atualizacao.atualizado_em = new Date().toISOString()

  const admin = criarClienteAdmin()
  const { data, error } = await admin
    .from('negocios')
    .update(atualizacao)
    .eq('id', id)
    .select('id')
    .maybeSingle()

  if (error || !data) {
    return Response.json(
      { erro: 'negocio_nao_encontrado', mensagem: 'Negócio não encontrado.' },
      { status: 404 },
    )
  }

  return Response.json({ ok: true })
}
