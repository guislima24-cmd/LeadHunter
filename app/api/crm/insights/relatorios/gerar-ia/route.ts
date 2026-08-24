import { criarClienteAdmin } from '@/lib/supabase/admin'
import { exigirMembroNaApi } from '@/lib/sessao'
import { montarSnapshot, periodoDoMes } from '@/lib/insights'
import { redigirRelatorio } from '@/lib/relatorio-ia'
import { formatarMesAno } from '@/lib/formato'

/**
 * Gera o relatório do mês com IA (Seção 5.5 do PRD).
 *
 * O fluxo inteiro: monta o snapshot a partir do banco, manda **só o
 * snapshot** para a IA (ela nunca fala com o banco), grava o texto como
 * rascunho. Publicar é outra rota, e é ação humana.
 *
 * A resposta pode demorar — é uma redação inteira. Por isso `maxDuration`
 * acima do padrão; sem ele a função é cortada no meio e o rascunho se perde
 * depois de a chamada à IA já ter sido paga.
 */
export const maxDuration = 120

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

  const periodo = periodoDoMes(referencia)
  const snapshot = await montarSnapshot(periodo)

  const redacao = await redigirRelatorio(snapshot)
  if (!redacao.ok) {
    return Response.json(
      { erro: redacao.erro, mensagem: redacao.mensagem },
      { status: redacao.erro === 'ia_nao_configurada' ? 503 : 502 },
    )
  }

  const admin = criarClienteAdmin()
  const { data, error } = await admin
    .from('relatorios_mensais')
    .insert({
      periodo_referencia: periodo.inicio,
      titulo: `Relatório comercial — ${formatarMesAno(periodo.inicio)}`,
      conteudo: redacao.conteudo,
      // Sempre rascunho. O texto foi escrito por uma máquina a partir de
      // números reais, o que é bem diferente de estar revisado.
      gerado_por_ia: true,
      status: 'rascunho',
      metricas_snapshot: snapshot,
      criado_por_email: sessao.membro.email,
    })
    .select('id')
    .single()

  if (error) {
    return Response.json(
      { erro: 'falha_ao_gravar_relatorio', mensagem: error.message },
      { status: 500 },
    )
  }

  return Response.json({ ok: true, relatorioId: data.id })
}
