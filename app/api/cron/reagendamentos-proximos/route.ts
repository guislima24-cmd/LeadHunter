import { criarClienteAdmin } from '@/lib/supabase/admin'

/** Quantos dias antes da data do recontato o alerta dispara. */
const ANTECEDENCIA_DIAS = 5

/**
 * Avisa os administradores sobre retomadas que vencem em até 5 dias
 * (Seção 4.3 do PRD de navegação e insights). Agendado no `vercel.json`.
 *
 * Vai para **todos os administradores**, não para quem registrou a perda: o
 * ponto do reagendamento é que a retomada não dependa da memória — nem da
 * presença — de uma pessoa só. Quem perdeu o negócio pode ter saído da EJ
 * entre a perda e a data de voltar.
 *
 * `notificado_em` marca o que já foi avisado, então uma execução no dia
 * seguinte não repete o alerta. É por isso que a coluna existe em vez de a
 * rota conferir `notificacoes`: a notificação é por admin, o aviso é por
 * retomada, e contar linhas de uma para decidir a outra erraria assim que o
 * time mudasse de tamanho.
 *
 * Só cria a notificação in-app — **não envia email**. Mesma limitação já
 * registrada na rota de atividades vencendo: o envio é um fluxo do n8n, não
 * algo que uma rota Next.js resolve sozinha.
 */
export async function GET(req: Request) {
  const segredo = process.env.CRON_SECRET
  if (segredo && req.headers.get('authorization') !== `Bearer ${segredo}`) {
    return new Response('Não autorizado', { status: 401 })
  }

  const admin = criarClienteAdmin()

  const limite = new Date()
  limite.setDate(limite.getDate() + ANTECEDENCIA_DIAS)
  const limiteISO = limite.toISOString().slice(0, 10)

  const { data: pendentes, error } = await admin
    .from('vw_negocios_reagendados_pendentes')
    .select('id, negocio_id, titulo, organizacao_nome, data_recontato')
    .is('notificado_em', null)
    .lte('data_recontato', limiteISO)

  if (error) {
    return Response.json(
      { erro: 'falha_ao_ler_reagendamentos', mensagem: error.message },
      { status: 500 },
    )
  }

  if (!pendentes || pendentes.length === 0) {
    return Response.json({ alertados: 0, notificacoesCriadas: 0 })
  }

  const { data: admins } = await admin
    .from('member_profiles')
    .select('email')
    .eq('papel', 'admin')
    .eq('ativo', true)

  if (!admins || admins.length === 0) {
    // Sem admin ativo não há a quem avisar. Não marca `notificado_em`: assim
    // o alerta sai de verdade assim que existir um, em vez de a retomada ser
    // silenciosamente dada como avisada.
    return Response.json({
      alertados: 0,
      notificacoesCriadas: 0,
      aviso: 'Nenhum administrador ativo para notificar.',
    })
  }

  const notificacoes = pendentes.flatMap((r) =>
    admins.map((a) => ({
      membro_email: a.email as string,
      tipo: 'reagendamento_proximo',
      referencia_tipo: 'negocio',
      // Aponta para o negócio, não para o reagendamento: é a ficha do
      // negócio que a pessoa quer abrir ao clicar na notificação.
      referencia_id: r.negocio_id as string,
      titulo: `Retomar em ${formatarDataCurta(r.data_recontato as string)}: ${r.organizacao_nome}`,
    })),
  )

  const { error: erroInsercao } = await admin
    .from('notificacoes')
    .insert(notificacoes)

  if (erroInsercao) {
    return Response.json(
      { erro: 'falha_ao_notificar', mensagem: erroInsercao.message },
      { status: 500 },
    )
  }

  // Só depois de as notificações existirem. Se a marcação viesse antes e a
  // inserção falhasse, a retomada ficaria marcada como avisada sem ninguém
  // ter sido avisado — e nunca mais entraria nesta consulta.
  const { error: erroMarcacao } = await admin
    .from('negocio_reagendamentos')
    .update({ notificado_em: new Date().toISOString() })
    .in(
      'id',
      pendentes.map((r) => r.id as string),
    )

  if (erroMarcacao) {
    return Response.json(
      {
        erro: 'falha_ao_marcar_notificado',
        mensagem: erroMarcacao.message,
        aviso:
          'As notificações foram criadas mas não puderam ser marcadas — a próxima execução vai duplicá-las.',
      },
      { status: 500 },
    )
  }

  return Response.json({
    alertados: pendentes.length,
    notificacoesCriadas: notificacoes.length,
  })
}

function formatarDataCurta(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`)
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
  }).format(d)
}
