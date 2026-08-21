import { NextRequest } from 'next/server'
import { exigirMembroNaApi, exigirAbaPlanilha } from '@/lib/sessao'
import { chamarN8n, ROTAS_N8N, MENSAGENS_ERRO_N8N } from '@/lib/n8n'
import { criarClienteAdmin } from '@/lib/supabase/admin'

interface RespostaW3 {
  enviados: number
  erros: number
  pulados_ja_contatados_ou_sem_email: number
  total_processado: number
}

/** Dispara o W3: envia os emails de prospecção dos leads da lista. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessao = await exigirMembroNaApi()
  if ('resposta' in sessao) return sessao.resposta

  const aba = exigirAbaPlanilha(sessao.membro)
  if (aba instanceof Response) return aba

  const { id } = await params

  // Confere a posse da lista antes de disparar: o id vem da URL e não é segredo.
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

  const corpo = await req.json().catch(() => ({}))

  const resultado = await chamarN8n<RespostaW3>(ROTAS_N8N.prospectar, {
    lista_id: id,
    membro: aba,
    // Registra qual conta enviou. Hoje todos saem pela institucional, então
    // vem do ambiente; quando um membro tiver `email_remetente` preenchido,
    // passa a ser o dele, e o W3 pode rotear por esse valor.
    ...(sessao.membro.emailRemetente || process.env.GMAIL_REMETENTE
      ? {
          conta_gmail:
            sessao.membro.emailRemetente ?? process.env.GMAIL_REMETENTE,
        }
      : {}),
  })

  if (!resultado.ok) {
    return Response.json(
      {
        erro: resultado.erro,
        mensagem:
          MENSAGENS_ERRO_N8N[resultado.erro] ?? 'Falha ao disparar a prospecção.',
        detalhe: resultado.detalhe,
      },
      { status: resultado.status },
    )
  }

  return Response.json({
    enviados: resultado.dados.enviados ?? 0,
    erros: resultado.dados.erros ?? 0,
    pulados: resultado.dados.pulados_ja_contatados_ou_sem_email ?? 0,
    totalProcessado: resultado.dados.total_processado ?? 0,
  })
}
