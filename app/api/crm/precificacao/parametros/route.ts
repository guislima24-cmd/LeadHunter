import { exigirMembroNaApi, exigirAdmin } from '@/lib/sessao'
import { criarClienteAdmin } from '@/lib/supabase/admin'

/**
 * Tela de referência: taxa/hora por porte, multiplicadores de capacidade,
 * pontos das opções e os parâmetros globais.
 *
 * Tudo restrito a admin — são os números que definem quanto a empresa cobra, e
 * mexer neles muda o preço de todo orçamento novo. Orçamento já finalizado não
 * se mexe: os valores dele ficaram gravados no item (ver comentário da tabela).
 */
export async function PATCH(req: Request) {
  const sessao = await exigirMembroNaApi()
  if ('resposta' in sessao) return sessao.resposta
  const negado = exigirAdmin(sessao.membro)
  if (negado) return negado

  const corpo = await req.json().catch(() => ({}))
  const admin = criarClienteAdmin()

  if (corpo.globais && typeof corpo.globais === 'object') {
    const g = corpo.globais as Record<string, unknown>
    const atualizacao: Record<string, unknown> = {}
    for (const [chave, coluna] of [
      ['impostoPercentual', 'imposto_percentual'],
      ['percentualMargemAceitavel', 'percentual_margem_aceitavel'],
      ['percentualPontoEquilibrio', 'percentual_ponto_equilibrio'],
      ['limiarDesvioPercentual', 'limiar_desvio_percentual'],
    ] as const) {
      if (!(chave in g)) continue
      const valor = Number(g[chave])
      if (!Number.isFinite(valor) || valor < 0 || valor > 100) {
        return Response.json(
          { erro: 'valor_invalido', mensagem: `"${chave}" precisa ser um percentual entre 0 e 100.` },
          { status: 400 },
        )
      }
      atualizacao[coluna] = valor
    }
    if (Object.keys(atualizacao).length > 0) {
      atualizacao.atualizado_por_email = sessao.membro.email
      atualizacao.atualizado_em = new Date().toISOString()
      await admin.from('precificacao_parametros_globais').update(atualizacao).eq('id', true)
    }
  }

  for (const p of Array.isArray(corpo.portes) ? corpo.portes : []) {
    const taxa = p?.taxaHoraPadrao === null ? null : Number(p?.taxaHoraPadrao)
    if (taxa !== null && (!Number.isFinite(taxa) || taxa < 0)) {
      return Response.json(
        { erro: 'taxa_invalida', mensagem: 'A taxa/hora precisa ser um número positivo.' },
        { status: 400 },
      )
    }
    await admin
      .from('portes_empresa')
      .update({ taxa_hora_padrao: taxa })
      .eq('id', String(p?.id ?? ''))
  }

  for (const f of Array.isArray(corpo.faixas) ? corpo.faixas : []) {
    const m = Number(f?.multiplicador)
    if (!Number.isFinite(m) || m <= 0) {
      return Response.json(
        { erro: 'multiplicador_invalido', mensagem: 'O multiplicador precisa ser maior que zero.' },
        { status: 400 },
      )
    }
    await admin
      .from('precificacao_faixas_capacidade')
      .update({ multiplicador: m })
      .eq('id', String(f?.id ?? ''))
  }

  for (const o of Array.isArray(corpo.opcoes) ? corpo.opcoes : []) {
    const pontos = Number(o?.pontosPercentuais)
    if (!Number.isFinite(pontos)) {
      return Response.json(
        { erro: 'pontos_invalidos', mensagem: 'Os pontos precisam ser um número.' },
        { status: 400 },
      )
    }
    await admin
      .from('precificacao_dimensao_opcoes')
      .update({ pontos_percentuais: pontos })
      .eq('id', String(o?.id ?? ''))
  }

  for (const d of Array.isArray(corpo.dimensoes) ? corpo.dimensoes : []) {
    const unitario = d?.valorUnitario === null ? null : Number(d?.valorUnitario)
    if (unitario !== null && (!Number.isFinite(unitario) || unitario < 0)) {
      return Response.json(
        { erro: 'valor_unitario_invalido', mensagem: 'O valor unitário precisa ser positivo.' },
        { status: 400 },
      )
    }
    await admin
      .from('precificacao_dimensoes')
      .update({ valor_unitario: unitario })
      .eq('id', String(d?.id ?? ''))
  }

  return Response.json({ ok: true })
}
