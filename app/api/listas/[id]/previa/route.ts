import { NextRequest } from 'next/server'
import { exigirMembroNaApi, exigirAbaPlanilha } from '@/lib/sessao'
import { chamarN8n, ROTAS_N8N, MENSAGENS_ERRO_N8N } from '@/lib/n8n'
import { criarClienteAdmin } from '@/lib/supabase/admin'

interface RespostaPreviaW3 {
  assunto?: string
  corpo?: string
  para?: string
  empresa?: string
  /** O n8n às vezes devolve o payload do agente aninhado em `output`. */
  output?: { assunto?: string; corpo?: string }
  /** Preenchido quando o redator falha (cota do modelo, timeout do provedor). */
  erro?: string
  mensagem?: string
}

/**
 * Redige o email de um lead **sem enviar**.
 *
 * Usa o mesmo W3 do envio real, em modo `previa`, para que o texto exibido
 * venha do mesmo prompt e do mesmo modelo. Um workflow separado poderia
 * divergir do que o cliente recebe, que é justamente o que a prévia existe
 * para evitar.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessao = await exigirMembroNaApi()
  if ('resposta' in sessao) return sessao.resposta

  const aba = exigirAbaPlanilha(sessao.membro)
  if (aba instanceof Response) return aba

  const { id } = await params
  const corpo = await req.json().catch(() => ({}))
  const cnpj = String(corpo.cnpj ?? '').trim()

  if (!cnpj) {
    return Response.json(
      { erro: 'cnpj_obrigatorio', mensagem: 'Informe o lead da prévia.' },
      { status: 400 },
    )
  }

  // A lista é do membro? O id vem da URL e não é segredo.
  const db = criarClienteAdmin()
  const { data: lista } = await db
    .from('listas_geradas')
    .select('id, membro')
    .eq('id', id)
    .maybeSingle()

  if (!lista || lista.membro !== aba) {
    return Response.json(
      { erro: 'lista_nao_encontrada', mensagem: 'Lista não encontrada.' },
      { status: 404 },
    )
  }

  const resultado = await chamarN8n<RespostaPreviaW3>(ROTAS_N8N.prospectar, {
    lista_id: id,
    membro: aba,
    previa: true,
    cnpj,
  })

  if (!resultado.ok) {
    return Response.json(
      {
        erro: resultado.erro,
        mensagem:
          MENSAGENS_ERRO_N8N[resultado.erro] ?? 'Falha ao gerar a prévia.',
        detalhe: resultado.detalhe,
      },
      { status: resultado.status },
    )
  }

  // O W3 responde com `erro` quando o redator nao conseguiu escrever — em geral
  // cota do Gemini estourada. E uma falha temporaria, e nao um lead invalido:
  // vale repetir a mensagem do workflow em vez de inventar um diagnostico.
  if (resultado.dados.erro) {
    return Response.json(
      {
        erro: resultado.dados.erro,
        mensagem:
          resultado.dados.mensagem ??
          'A IA não conseguiu redigir o email agora. Tente de novo em alguns minutos.',
      },
      { status: 503 },
    )
  }

  const assunto = resultado.dados.assunto ?? resultado.dados.output?.assunto ?? ''
  const corpoEmail = resultado.dados.corpo ?? resultado.dados.output?.corpo ?? ''

  if (!assunto && !corpoEmail) {
    return Response.json(
      {
        erro: 'previa_vazia',
        mensagem:
          'O workflow respondeu sem texto. O lead pode já ter sido contatado ou estar sem email.',
      },
      { status: 422 },
    )
  }

  return Response.json({
    assunto,
    corpo: corpoEmail,
    para: resultado.dados.para ?? '',
    empresa: resultado.dados.empresa ?? '',
  })
}
