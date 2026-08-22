import { exigirMembroNaApi } from '@/lib/sessao'
import { chamarRpcCrm } from '@/lib/crm'

/**
 * Criação de negócio fora da promoção de lead. Dois caminhos, escolhidos pelo
 * corpo da requisição:
 *
 *  - `organizacaoId` → Seção 8.2: a empresa já está no CRM (ex.: upsell depois
 *    de um negócio fechado). Não cria nem mexe em organização/contato.
 *  - `organizacaoNome` → botão "Novo negócio" do quadro: a empresa pode nem
 *    existir ainda. A RPC cria organização e contato junto, numa transação.
 *
 * O primeiro tem precedência quando os dois vêm: é o mais específico, já
 * aponta para uma linha existente.
 */
export async function POST(req: Request) {
  const sessao = await exigirMembroNaApi()
  if ('resposta' in sessao) return sessao.resposta

  const corpo = await req.json().catch(() => ({}))
  const organizacaoId = String(corpo.organizacaoId ?? '').trim()
  const organizacaoNome = String(corpo.organizacaoNome ?? '').trim()
  const titulo = String(corpo.titulo ?? '').trim()

  if (!titulo || (!organizacaoId && !organizacaoNome)) {
    return Response.json(
      {
        erro: 'campos_obrigatorios',
        mensagem: 'Informe o título e a empresa do negócio.',
      },
      { status: 400 },
    )
  }

  // `valor` chega como string do formulário; string vazia vira null em vez de
  // 0 — negócio sem valor definido não é negócio de R$ 0.
  const valor = numeroOuNulo(corpo.valor)
  if (valor === 'invalido') {
    return Response.json(
      { erro: 'valor_invalido', mensagem: 'O valor precisa ser um número.' },
      { status: 400 },
    )
  }

  const resultado = organizacaoId
    ? await chamarRpcCrm<string>('crm_criar_negocio_avulso', {
        p_organizacao_id: organizacaoId,
        p_titulo: titulo,
        p_membro_email: sessao.membro.email,
        p_contato_id: vazioVirandoNulo(corpo.contatoId),
        p_produto_servico_id: vazioVirandoNulo(corpo.produtoServicoId),
        p_valor: valor,
        p_previsao_fechamento: vazioVirandoNulo(corpo.previsaoFechamento),
      })
    : await chamarRpcCrm<string>('crm_criar_negocio_manual', {
        p_membro_email: sessao.membro.email,
        p_organizacao_nome: organizacaoNome,
        p_titulo: titulo,
        p_cnpj: vazioVirandoNulo(corpo.cnpj),
        p_contato_nome: vazioVirandoNulo(corpo.contatoNome),
        p_contato_email: vazioVirandoNulo(corpo.contatoEmail),
        p_contato_telefone: vazioVirandoNulo(corpo.contatoTelefone),
        p_produto_servico_id: vazioVirandoNulo(corpo.produtoServicoId),
        p_valor: valor,
        p_previsao_fechamento: vazioVirandoNulo(corpo.previsaoFechamento),
      })

  if (!resultado.ok) {
    return Response.json(
      { erro: resultado.erro, mensagem: resultado.mensagem },
      { status: resultado.status ?? 500 },
    )
  }

  return Response.json({ negocioId: resultado.dados }, { status: 201 })
}

function vazioVirandoNulo(valor: unknown): string | null {
  if (valor == null) return null
  const texto = String(valor).trim()
  return texto === '' ? null : texto
}

function numeroOuNulo(valor: unknown): number | null | 'invalido' {
  if (valor == null || valor === '') return null
  const numero = Number(valor)
  return Number.isFinite(numero) ? numero : 'invalido'
}
