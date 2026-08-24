import { criarClienteAdmin } from '@/lib/supabase/admin'
import { exigirMembroNaApi } from '@/lib/sessao'
import { montarSnapshot, periodoDoMes } from '@/lib/insights'

/**
 * Cria um relatório escrito à mão.
 *
 * Qualquer membro pode. O snapshot é montado aqui também, mesmo num relatório
 * humano: o valor dele é congelar os números do mês, e isso vale igual para
 * quem escreveu o texto sozinho.
 */
export async function POST(req: Request) {
  const sessao = await exigirMembroNaApi()
  if ('resposta' in sessao) return sessao.resposta

  const corpo = await req.json().catch(() => ({}))

  const referencia = String(corpo.periodoReferencia ?? '')
  if (!/^\d{4}-\d{2}(-\d{2})?$/.test(referencia)) {
    return Response.json(
      {
        erro: 'periodo_invalido',
        mensagem: 'Informe o mês de referência do relatório.',
      },
      { status: 400 },
    )
  }
  if (!String(corpo.titulo ?? '').trim()) {
    return Response.json(
      { erro: 'titulo_obrigatorio', mensagem: 'Dê um título ao relatório.' },
      { status: 400 },
    )
  }
  if (!String(corpo.conteudo ?? '').trim()) {
    return Response.json(
      { erro: 'conteudo_obrigatorio', mensagem: 'O relatório está vazio.' },
      { status: 400 },
    )
  }

  const periodo = periodoDoMes(referencia)
  const snapshot = await montarSnapshot(periodo)

  const admin = criarClienteAdmin()
  const { data, error } = await admin
    .from('relatorios_mensais')
    .insert({
      periodo_referencia: periodo.inicio,
      titulo: String(corpo.titulo).trim(),
      conteudo: String(corpo.conteudo).trim(),
      gerado_por_ia: false,
      status: 'rascunho',
      metricas_snapshot: snapshot,
      criado_por_email: sessao.membro.email,
    })
    .select('id')
    .single()

  if (error) {
    return Response.json(
      { erro: 'falha_ao_criar_relatorio', mensagem: error.message },
      { status: 500 },
    )
  }

  return Response.json({ ok: true, relatorioId: data.id })
}
