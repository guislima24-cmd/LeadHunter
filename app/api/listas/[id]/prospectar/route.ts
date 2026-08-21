import { exigirMembroNaApi, exigirAbaPlanilha } from '@/lib/sessao'
import { chamarN8n, ROTAS_N8N, MENSAGENS_ERRO_N8N } from '@/lib/n8n'
import { criarClienteAdmin } from '@/lib/supabase/admin'

interface RespostaW3 {
  enviados?: number
  erros?: number
  pulados_ja_contatados_ou_sem_email?: number
  total_processado?: number
}

/**
 * O W3 pode levar minutos: cada lead passa por uma pausa de ritmo, pelo agente
 * redator e pelo Gmail. O padrão de 120 s de `chamarN8n` corta uma lista média
 * no meio do caminho e o time acha que falhou.
 */
const TEMPO_LIMITE_MS = 240_000

/** Teto do lado da Vercel, que precisa cobrir o timeout acima. */
export const maxDuration = 300

/** Dispara o W3: envia os emails de prospecção dos leads da lista. */
export async function POST(
  _req: Request,
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

  const resultado = await chamarN8n<RespostaW3>(
    ROTAS_N8N.prospectar,
    {
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
    },
    { timeoutMs: TEMPO_LIMITE_MS },
  )

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

  // Sem resumo no corpo, o workflow morreu antes de responder — o webhook fica
  // sem `Respond to Webhook` e o n8n devolve 200 vazio. Preencher com zero aqui
  // era o pior desfecho possível: a tela dizia "concluída · 0 enviados" para uma
  // execução que na verdade abortou, e ninguém ia olhar o Monitoramento.
  const temResumo =
    typeof resultado.dados.enviados === 'number' ||
    typeof resultado.dados.total_processado === 'number'

  if (!temResumo) {
    return Response.json(
      {
        erro: 'workflow_sem_resumo',
        mensagem:
          'A prospecção foi disparada mas o workflow não devolveu o resultado — ele provavelmente parou no meio. Confira o Monitoramento antes de disparar de novo: alguns emails podem ter saído.',
      },
      { status: 502 },
    )
  }

  return Response.json({
    enviados: resultado.dados.enviados ?? 0,
    erros: resultado.dados.erros ?? 0,
    pulados: resultado.dados.pulados_ja_contatados_ou_sem_email ?? 0,
    totalProcessado: resultado.dados.total_processado ?? 0,
  })
}
