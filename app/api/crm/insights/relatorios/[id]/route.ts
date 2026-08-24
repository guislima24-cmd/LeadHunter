import { criarClienteAdmin } from '@/lib/supabase/admin'
import { exigirMembroNaApi } from '@/lib/sessao'
import { chamarRpcCrm } from '@/lib/crm'

/**
 * Edita ou publica um relatório.
 *
 * `acao: 'publicar'` passa pela função do banco, que garante um publicado por
 * mês. Edição de texto é livre — inclusive depois de publicado: um relatório
 * é documento vivo do time, e travar a correção de um erro de digitação em
 * nome da imutabilidade seria formalidade sem serventia. O que **não** muda é
 * o `metricas_snapshot`: os números que embasaram o texto ficam congelados.
 *
 * Quem publica: qualquer membro. O PRD deixou isso em aberto (Bloqueador 3);
 * a decisão aqui é a menos restritiva porque o relatório já nasce revisado
 * por gente e a EJ é pequena — se virar problema, restringir depois é uma
 * linha, enquanto liberar depois exige convencer alguém.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessao = await exigirMembroNaApi()
  if ('resposta' in sessao) return sessao.resposta

  const { id } = await params
  const corpo = await req.json().catch(() => ({}))

  if (corpo.acao === 'publicar') {
    const resultado = await chamarRpcCrm<null>('crm_publicar_relatorio', {
      p_relatorio_id: id,
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

  const titulo = String(corpo.titulo ?? '').trim()
  const conteudo = String(corpo.conteudo ?? '').trim()

  if (!titulo) {
    return Response.json(
      { erro: 'titulo_obrigatorio', mensagem: 'Dê um título ao relatório.' },
      { status: 400 },
    )
  }
  if (!conteudo) {
    return Response.json(
      { erro: 'conteudo_obrigatorio', mensagem: 'O relatório está vazio.' },
      { status: 400 },
    )
  }

  const admin = criarClienteAdmin()
  const { error } = await admin
    .from('relatorios_mensais')
    .update({ titulo, conteudo, atualizado_em: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    return Response.json(
      { erro: 'falha_ao_salvar_relatorio', mensagem: error.message },
      { status: 500 },
    )
  }

  return Response.json({ ok: true })
}

/** Apaga um relatório. Só rascunho — publicado é registro do mês. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessao = await exigirMembroNaApi()
  if ('resposta' in sessao) return sessao.resposta

  const { id } = await params
  const admin = criarClienteAdmin()

  const { data: relatorio } = await admin
    .from('relatorios_mensais')
    .select('status')
    .eq('id', id)
    .maybeSingle()

  if (!relatorio) {
    return Response.json(
      { erro: 'relatorio_nao_encontrado', mensagem: 'Relatório não encontrado.' },
      { status: 404 },
    )
  }
  if (relatorio.status === 'publicado') {
    return Response.json(
      {
        erro: 'relatorio_publicado',
        mensagem:
          'Um relatório publicado é o registro daquele mês e não pode ser apagado.',
      },
      { status: 409 },
    )
  }

  const { error } = await admin.from('relatorios_mensais').delete().eq('id', id)

  if (error) {
    return Response.json(
      { erro: 'falha_ao_apagar_relatorio', mensagem: error.message },
      { status: 500 },
    )
  }

  return Response.json({ ok: true })
}
