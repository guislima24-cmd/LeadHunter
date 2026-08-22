import { exigirMembroNaApi } from '@/lib/sessao'
import { criarClienteAdmin } from '@/lib/supabase/admin'

const COLUNA_POR_TIPO: Record<string, string> = {
  texto_curto: 'valor_texto',
  numero: 'valor_numero',
  data: 'valor_data',
  booleano: 'valor_booleano',
  selecao_multipla: 'valor_selecao_multipla',
}

/**
 * Grava o valor de um campo dinâmico para um registro (negócio, organização,
 * contato ou atividade) — Seção 8.6. A definição já diz o tipo, então a rota
 * escreve na coluna tipada certa em vez de esperar o cliente saber disso.
 */
export async function PUT(req: Request) {
  const sessao = await exigirMembroNaApi()
  if ('resposta' in sessao) return sessao.resposta

  const corpo = await req.json().catch(() => ({}))
  const definicaoId = String(corpo.definicaoId ?? '').trim()
  const entidadeId = String(corpo.entidadeId ?? '').trim()

  if (!definicaoId || !entidadeId || !('valor' in corpo)) {
    return Response.json(
      {
        erro: 'campos_obrigatorios',
        mensagem: 'Informe definicaoId, entidadeId e valor.',
      },
      { status: 400 },
    )
  }

  const admin = criarClienteAdmin()
  const { data: definicao } = await admin
    .from('campos_dinamicos_definicao')
    .select('id, tipo')
    .eq('id', definicaoId)
    .maybeSingle()

  if (!definicao) {
    return Response.json(
      { erro: 'definicao_nao_encontrada', mensagem: 'Campo dinâmico não encontrado.' },
      { status: 404 },
    )
  }

  const coluna = COLUNA_POR_TIPO[definicao.tipo]

  const { error } = await admin.from('campos_dinamicos_valor').upsert(
    {
      definicao_id: definicaoId,
      entidade_id: entidadeId,
      [coluna]: corpo.valor,
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: 'definicao_id,entidade_id' },
  )

  if (error) {
    return Response.json(
      { erro: 'falha_ao_gravar', mensagem: 'Não foi possível gravar o valor.' },
      { status: 500 },
    )
  }

  return Response.json({ ok: true })
}
