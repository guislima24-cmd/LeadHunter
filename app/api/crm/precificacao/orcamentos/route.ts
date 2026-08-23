import { exigirMembroNaApi } from '@/lib/sessao'
import { criarClienteAdmin } from '@/lib/supabase/admin'

/**
 * Abre um orçamento para um negócio.
 *
 * Nasce vazio e em rascunho: escolher os módulos é o trabalho da tela
 * seguinte, e obrigar tudo de uma vez faria o vendedor decidir o escopo antes
 * de poder brincar com os números, que é o contrário do que a calculadora
 * serve para fazer.
 */
export async function POST(req: Request) {
  const sessao = await exigirMembroNaApi()
  if ('resposta' in sessao) return sessao.resposta

  const corpo = await req.json().catch(() => ({}))
  const negocioId = String(corpo.negocioId ?? '').trim()
  const porteEmpresaId = String(corpo.porteEmpresaId ?? '').trim()
  const faixaCapacidadeId = String(corpo.faixaCapacidadeId ?? '').trim()

  if (!negocioId || !porteEmpresaId || !faixaCapacidadeId) {
    return Response.json(
      {
        erro: 'campos_obrigatorios',
        mensagem: 'Escolha o negócio, o porte do cliente e a capacidade do time.',
      },
      { status: 400 },
    )
  }

  const admin = criarClienteAdmin()
  const { data, error } = await admin
    .from('negocio_orcamentos')
    .insert({
      negocio_id: negocioId,
      porte_empresa_id: porteEmpresaId,
      faixa_capacidade_id: faixaCapacidadeId,
      criado_por_email: sessao.membro.email,
    })
    .select('id')
    .single()

  if (error || !data) {
    return Response.json(
      {
        erro: 'falha_ao_criar',
        mensagem:
          'Não foi possível abrir o orçamento. Confira se o negócio ainda existe.',
      },
      { status: 400 },
    )
  }

  return Response.json({ orcamentoId: data.id }, { status: 201 })
}
