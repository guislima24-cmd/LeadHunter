import { exigirMembroNaApi } from '@/lib/sessao'
import { criarClienteAdmin } from '@/lib/supabase/admin'

const CANAIS = ['email', 'whatsapp', 'linkedin'] as const
type Canal = (typeof CANAIS)[number]

/**
 * Conecta um canal de saída para o membro logado (Seção 8.7).
 *
 * - `email`: ativa de fato `member_profiles.email_remetente`, que já existia
 *   preparado para o envio individual do W3 — a troca de credencial dentro
 *   do n8n continua sendo trabalho manual à parte.
 * - `linkedin`: só guarda a URL do próprio perfil como identidade; a captura
 *   em si continua sendo a extensão de navegador + W4.
 * - `whatsapp`: **bloqueado** até decisão de provedor (Meta Cloud API vs.
 *   Twilio/Z-API etc. — Seção 12, item 1 da especificação). O schema
 *   (`canais_membro`, `whatsapp_enviados`) já existe; o envio não.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ canal: string }> },
) {
  const sessao = await exigirMembroNaApi()
  if ('resposta' in sessao) return sessao.resposta

  const { canal } = await params
  if (!CANAIS.includes(canal as Canal)) {
    return Response.json(
      { erro: 'canal_invalido', mensagem: `Canal deve ser um de ${CANAIS.join('/')}.` },
      { status: 400 },
    )
  }

  if (canal === 'whatsapp') {
    return Response.json(
      {
        erro: 'canal_bloqueado',
        mensagem:
          'Envio por WhatsApp ainda não está disponível: falta decidir o provedor (API oficial da Meta ou um terceirizado como Twilio/Z-API). O schema já está pronto, o disparo depende dessa decisão.',
      },
      { status: 501 },
    )
  }

  const corpo = await req.json().catch(() => ({}))
  const identificador = String(corpo.identificador ?? '').trim()

  if (!identificador) {
    return Response.json(
      {
        erro: 'identificador_obrigatorio',
        mensagem:
          canal === 'email'
            ? 'Informe o endereço de Gmail a conectar.'
            : 'Informe a URL do seu perfil do LinkedIn.',
      },
      { status: 400 },
    )
  }

  const admin = criarClienteAdmin()

  const { error } = await admin.from('canais_membro').upsert(
    {
      membro_email: sessao.membro.email,
      canal,
      identificador,
      status: 'conectado',
      conectado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: 'membro_email,canal' },
  )

  if (error) {
    return Response.json(
      { erro: 'falha_ao_conectar', mensagem: 'Não foi possível salvar a conexão.' },
      { status: 500 },
    )
  }

  if (canal === 'email') {
    await admin
      .from('member_profiles')
      .update({ email_remetente: identificador })
      .eq('email', sessao.membro.email)
  }

  return Response.json({ ok: true })
}
