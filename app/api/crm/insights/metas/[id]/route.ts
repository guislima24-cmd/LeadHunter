import { criarClienteAdmin } from '@/lib/supabase/admin'
import { exigirMembroNaApi } from '@/lib/sessao'
import { validarMeta, respostaApenasAdmin } from '@/lib/validacao-metas'

/** Edita uma meta. Só admin. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessao = await exigirMembroNaApi()
  if ('resposta' in sessao) return sessao.resposta
  if (sessao.membro.papel !== 'admin') return respostaApenasAdmin()

  const { id } = await params
  const corpo = await req.json().catch(() => ({}))

  const admin = criarClienteAdmin()

  // Só mexer no `ativo` (arquivar/reativar) não precisa passar pela validação
  // do corpo inteiro — é um botão de uma coisa só.
  if (
    Object.keys(corpo).length === 1 &&
    typeof corpo.ativo === 'boolean'
  ) {
    const { error } = await admin
      .from('metas')
      .update({ ativo: corpo.ativo, atualizado_em: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      return Response.json(
        { erro: 'falha_ao_atualizar_meta', mensagem: error.message },
        { status: 500 },
      )
    }
    return Response.json({ ok: true })
  }

  const erro = validarMeta(corpo)
  if (erro) return erro

  // `meta_pai_id` apontando para a própria meta faria um ciclo, e a árvore de
  // Objetivo → Resultados-Chave entraria em recursão infinita ao montar.
  if (corpo.metaPaiId && corpo.metaPaiId === id) {
    return Response.json(
      {
        erro: 'meta_pai_invalida',
        mensagem: 'Uma meta não pode ser Resultado-Chave dela mesma.',
      },
      { status: 400 },
    )
  }

  const { error } = await admin
    .from('metas')
    .update({
      meta_pai_id: corpo.metaPaiId || null,
      nome: String(corpo.nome).trim(),
      descricao: corpo.descricao?.trim() || null,
      metrica_fonte: corpo.metricaFonte,
      valor_alvo: Number(corpo.valorAlvo),
      valor_atual:
        corpo.metricaFonte === 'manual' ? Number(corpo.valorAtual ?? 0) : 0,
      unidade: corpo.unidade?.trim() || null,
      periodo_inicio: corpo.periodoInicio,
      periodo_fim: corpo.periodoFim,
      ativo: corpo.ativo ?? true,
      atualizado_em: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    return Response.json(
      { erro: 'falha_ao_atualizar_meta', mensagem: error.message },
      { status: 500 },
    )
  }

  return Response.json({ ok: true })
}

/** Apaga uma meta. Só admin. Os Resultados-Chave dela vão junto (cascade). */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessao = await exigirMembroNaApi()
  if ('resposta' in sessao) return sessao.resposta
  if (sessao.membro.papel !== 'admin') return respostaApenasAdmin()

  const { id } = await params
  const admin = criarClienteAdmin()

  const { error } = await admin.from('metas').delete().eq('id', id)

  if (error) {
    return Response.json(
      { erro: 'falha_ao_apagar_meta', mensagem: error.message },
      { status: 500 },
    )
  }

  return Response.json({ ok: true })
}
