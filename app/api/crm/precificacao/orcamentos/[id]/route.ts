import { exigirMembroNaApi } from '@/lib/sessao'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { obterCatalogoPrecificacao } from '@/lib/orcamentos'
import { calcularOrcamento, type EntradaItem } from '@/lib/precificacao'

/**
 * Salva o orçamento inteiro de uma vez: cabeçalho, itens e respostas às
 * dimensões.
 *
 * Salva tudo em vez de um endpoint por item porque um item sozinho não tem
 * valor definido — o total depende do porte e da capacidade, que estão no
 * cabeçalho, e o navegador estaria sempre a um round-trip de exibir um número
 * que o banco ainda não tem.
 *
 * O valor gravado é sempre recalculado aqui, do zero, a partir dos parâmetros
 * do banco. O que o cliente manda são as *entradas* (consultores, semanas,
 * dimensões escolhidas); os reais vêm da mesma função que a tela usa para a
 * prévia, mas com a taxa/hora e os multiplicadores lidos do servidor. Aceitar
 * o valor calculado pelo navegador seria deixar o preço de uma proposta
 * depender do que chegou no corpo da requisição.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessao = await exigirMembroNaApi()
  if ('resposta' in sessao) return sessao.resposta

  const { id } = await params
  const corpo = await req.json().catch(() => ({}))
  const admin = criarClienteAdmin()

  const { data: orcamento } = await admin
    .from('negocio_orcamentos')
    .select('id, negocio_id, porte_empresa_id, faixa_capacidade_id, status')
    .eq('id', id)
    .maybeSingle()

  if (!orcamento) {
    return Response.json(
      { erro: 'orcamento_nao_encontrado', mensagem: 'Orçamento não encontrado.' },
      { status: 404 },
    )
  }
  if (orcamento.status === 'finalizado') {
    return Response.json(
      {
        erro: 'orcamento_finalizado',
        mensagem:
          'Este orçamento já foi finalizado. Abra um novo para propor outro valor.',
      },
      { status: 409 },
    )
  }

  const porteEmpresaId =
    String(corpo.porteEmpresaId ?? '').trim() || (orcamento.porte_empresa_id as string)
  const faixaCapacidadeId =
    String(corpo.faixaCapacidadeId ?? '').trim() ||
    (orcamento.faixa_capacidade_id as string)

  const catalogo = await obterCatalogoPrecificacao()
  const porte = catalogo.portes.find((p) => p.id === porteEmpresaId)
  const faixa = catalogo.faixas.find((f) => f.id === faixaCapacidadeId)

  if (!porte || !faixa) {
    return Response.json(
      { erro: 'parametro_invalido', mensagem: 'Porte ou faixa de capacidade inválidos.' },
      { status: 400 },
    )
  }
  if (porte.taxaHoraPadrao == null) {
    return Response.json(
      {
        erro: 'porte_sem_taxa',
        mensagem: `O porte "${porte.nome}" ainda não tem taxa/hora definida. Um admin precisa preenchê-la na tela de referência.`,
      },
      { status: 409 },
    )
  }

  const idsDeServico = new Set(catalogo.servicos.map((s) => s.id))
  const entradas: EntradaItem[] = []
  for (const bruto of Array.isArray(corpo.itens) ? corpo.itens : []) {
    const produtoServicoId = String(bruto?.produtoServicoId ?? '')
    if (!idsDeServico.has(produtoServicoId)) {
      return Response.json(
        { erro: 'servico_invalido', mensagem: 'Um dos serviços do orçamento não existe.' },
        { status: 400 },
      )
    }
    entradas.push({
      produtoServicoId,
      consultores: Math.max(1, Math.floor(Number(bruto?.consultores) || 1)),
      semanas: Math.max(1, Math.floor(Number(bruto?.semanas) || 1)),
      custosExtras: Math.max(0, Number(bruto?.custosExtras) || 0),
      respostas: sanearRespostas(bruto?.respostas, produtoServicoId, catalogo.dimensoes),
    })
  }

  const resultado = calcularOrcamento(
    entradas,
    catalogo.dimensoes,
    porte.taxaHoraPadrao,
    faixa.multiplicador,
    catalogo.parametros,
  )

  // Substitui os itens em bloco. O `delete` leva junto as respostas às
  // dimensões (on delete cascade), então não sobra valor órfão de um item que
  // o vendedor tirou do orçamento.
  await admin.from('negocio_orcamento_itens').delete().eq('orcamento_id', id)

  if (entradas.length > 0) {
    const { data: inseridos, error: erroItens } = await admin
      .from('negocio_orcamento_itens')
      .insert(
        entradas.map((e, i) => ({
          orcamento_id: id,
          produto_servico_id: e.produtoServicoId,
          consultores: e.consultores,
          semanas: e.semanas,
          custos_extras: e.custosExtras,
          valor_base: arredondar(resultado.itens[i].valorBase),
          markup_complexidade: Number(resultado.itens[i].markupComplexidade.toFixed(4)),
          valor_com_markups: arredondar(resultado.itens[i].valorComMarkups),
          extra_fixo: arredondar(resultado.itens[i].extraFixo),
          subtotal: arredondar(resultado.itens[i].subtotal),
          valor_final: arredondar(resultado.itens[i].valorFinal),
          ordem: i,
        })),
      )
      .select('id')

    if (erroItens || !inseridos) {
      return Response.json(
        { erro: 'falha_ao_salvar', mensagem: 'Não foi possível salvar os itens.' },
        { status: 500 },
      )
    }

    const valores = inseridos.flatMap((item, i) =>
      Object.entries(entradas[i].respostas).map(([dimensaoId, r]) => ({
        item_id: item.id as string,
        dimensao_id: dimensaoId,
        opcao_id: r.opcaoId ?? null,
        valor_numerico: r.valorNumerico ?? null,
      })),
    )
    if (valores.length > 0) {
      await admin.from('negocio_orcamento_item_valores').insert(valores)
    }
  }

  await admin
    .from('negocio_orcamentos')
    .update({
      porte_empresa_id: porteEmpresaId,
      faixa_capacidade_id: faixaCapacidadeId,
      valor_ideal: arredondar(resultado.valorIdeal),
      valor_aceitavel: arredondar(resultado.valorAceitavel),
      valor_ponto_equilibrio: arredondar(resultado.valorPontoEquilibrio),
      atualizado_em: new Date().toISOString(),
    })
    .eq('id', id)

  return Response.json({
    valorIdeal: arredondar(resultado.valorIdeal),
    valorAceitavel: arredondar(resultado.valorAceitavel),
    valorPontoEquilibrio: arredondar(resultado.valorPontoEquilibrio),
  })
}

/**
 * Finaliza: congela o orçamento e leva o valor escolhido para o negócio.
 *
 * `negocios.valor` continua sendo o campo único que o resto do CRM lê (kanban,
 * gráficos do funil) — o orçamento é o "como cheguei nesse número", não um
 * segundo lugar onde o valor mora.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessao = await exigirMembroNaApi()
  if ('resposta' in sessao) return sessao.resposta

  const { id } = await params
  const corpo = await req.json().catch(() => ({}))
  const nivel = String(corpo.nivelProposto ?? '')

  if (!['ideal', 'aceitavel', 'ponto_equilibrio'].includes(nivel)) {
    return Response.json(
      { erro: 'nivel_invalido', mensagem: 'Escolha qual dos três valores propor.' },
      { status: 400 },
    )
  }

  const admin = criarClienteAdmin()
  const { data: orcamento } = await admin
    .from('negocio_orcamentos')
    .select('id, negocio_id, status, valor_ideal, valor_aceitavel, valor_ponto_equilibrio')
    .eq('id', id)
    .maybeSingle()

  if (!orcamento) {
    return Response.json(
      { erro: 'orcamento_nao_encontrado', mensagem: 'Orçamento não encontrado.' },
      { status: 404 },
    )
  }
  if (orcamento.status === 'finalizado') {
    return Response.json(
      { erro: 'orcamento_finalizado', mensagem: 'Este orçamento já foi finalizado.' },
      { status: 409 },
    )
  }

  const { count } = await admin
    .from('negocio_orcamento_itens')
    .select('*', { count: 'exact', head: true })
    .eq('orcamento_id', id)

  if (!count) {
    return Response.json(
      {
        erro: 'orcamento_vazio',
        mensagem: 'Adicione ao menos um serviço antes de finalizar.',
      },
      { status: 409 },
    )
  }

  const valor = Number(
    nivel === 'ideal'
      ? orcamento.valor_ideal
      : nivel === 'aceitavel'
        ? orcamento.valor_aceitavel
        : orcamento.valor_ponto_equilibrio,
  )

  await admin
    .from('negocio_orcamentos')
    .update({
      status: 'finalizado',
      nivel_proposto: nivel,
      atualizado_em: new Date().toISOString(),
    })
    .eq('id', id)

  // O serviço de maior peso vira o do negócio: é o que o cartão do funil e os
  // relatórios mostram, e deixá-lo desatualizado depois do orçamento faria a
  // etiqueta do kanban contradizer a proposta.
  const { data: dominante } = await admin
    .from('negocio_orcamento_itens')
    .select('produto_servico_id')
    .eq('orcamento_id', id)
    .order('valor_final', { ascending: false })
    .limit(1)
    .maybeSingle()

  await admin
    .from('negocios')
    .update({
      valor,
      ...(dominante
        ? { produto_servico_id: dominante.produto_servico_id as string }
        : {}),
      atualizado_em: new Date().toISOString(),
    })
    .eq('id', orcamento.negocio_id as string)

  return Response.json({ ok: true, valor })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessao = await exigirMembroNaApi()
  if ('resposta' in sessao) return sessao.resposta

  const { id } = await params
  const admin = criarClienteAdmin()

  const { data } = await admin
    .from('negocio_orcamentos')
    .delete()
    .eq('id', id)
    .eq('status', 'rascunho')
    .select('id')
    .maybeSingle()

  if (!data) {
    return Response.json(
      {
        erro: 'nao_removido',
        mensagem:
          'Só rascunho pode ser apagado — um orçamento finalizado é o registro de uma proposta que saiu.',
      },
      { status: 409 },
    )
  }

  return Response.json({ ok: true })
}

function arredondar(v: number): number {
  return Math.round(v * 100) / 100
}

/**
 * Deixa passar só resposta que corresponde a uma dimensão real do serviço, no
 * formato certo para o tipo dela. Sem isso, um corpo malformado viraria linha
 * no banco apontando para dimensão de outro serviço.
 */
function sanearRespostas(
  bruto: unknown,
  produtoServicoId: string,
  dimensoes: Awaited<ReturnType<typeof obterCatalogoPrecificacao>>['dimensoes'],
): EntradaItem['respostas'] {
  const respostas: EntradaItem['respostas'] = {}
  if (!bruto || typeof bruto !== 'object') return respostas

  for (const d of dimensoes.filter((x) => x.produtoServicoId === produtoServicoId)) {
    const r = (bruto as Record<string, unknown>)[d.id]
    if (!r || typeof r !== 'object') continue

    if (d.tipo === 'selecao_unica') {
      const opcaoId = (r as { opcaoId?: unknown }).opcaoId
      if (typeof opcaoId === 'string' && d.opcoes.some((o) => o.id === opcaoId)) {
        respostas[d.id] = { opcaoId }
      }
      continue
    }

    const valor = Number((r as { valorNumerico?: unknown }).valorNumerico)
    if (!Number.isFinite(valor)) continue
    const minimo = d.valorMinimo ?? 0
    const maximo = d.valorMaximo ?? Number.MAX_SAFE_INTEGER
    respostas[d.id] = { valorNumerico: Math.min(maximo, Math.max(minimo, valor)) }
  }

  return respostas
}
