import 'server-only'
import { redirect } from 'next/navigation'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { criarClienteAdmin } from '@/lib/supabase/admin'

/** Só emails deste domínio entram na plataforma. */
export const DOMINIO_PERMITIDO = 'ufabcjr.com.br'

export interface Membro {
  email: string
  nome: string
  /** Nome exato da aba do membro na planilha "Prospecção - Vendas". */
  abaPlanilha: string | null
  papel: 'membro' | 'admin'
  ativo: boolean
  avatarUrl: string | null
  /**
   * Conta que envia a prospecção deste membro. Vazio = conta institucional,
   * que é como o time opera hoje. Preenchido, a plataforma passa o endereço
   * adiante para o W3 rotear (ver README, seção de envio individual).
   */
  emailRemetente: string | null
}

/**
 * Lê a sessão e devolve o perfil do membro, criando-o no primeiro login.
 *
 * Quem tem email do domínio sempre entra; o vínculo com a aba da planilha
 * pode ficar pendente (`abaPlanilha: null`) até um admin preencher. As telas
 * que disparam workflows checam isso e explicam o que fazer.
 */
export async function obterMembro(): Promise<Membro | null> {
  const supabase = await criarClienteServidor()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) return null

  const email = user.email.toLowerCase()
  if (!email.endsWith(`@${DOMINIO_PERMITIDO}`)) return null

  const nomeGoogle =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    ''
  const avatarUrl =
    (user.user_metadata?.avatar_url as string | undefined) ?? null

  const admin = criarClienteAdmin()
  const { data: perfil } = await admin
    .from('member_profiles')
    .select('email, nome, aba_planilha, papel, ativo, email_remetente')
    .eq('email', email)
    .maybeSingle()

  // Primeiro login de alguém do domínio: cria o perfil sem aba vinculada.
  if (!perfil) {
    const { data: novo } = await admin
      .from('member_profiles')
      .insert({ email, nome: nomeGoogle })
      .select('email, nome, aba_planilha, papel, ativo, email_remetente')
      .single()

    if (!novo) return null
    return {
      email: novo.email,
      nome: novo.nome || nomeGoogle || email,
      abaPlanilha: novo.aba_planilha,
      papel: novo.papel,
      ativo: novo.ativo,
      avatarUrl,
      emailRemetente: novo.email_remetente ?? null,
    }
  }

  // Guarda o nome do Google se o cadastro veio sem nome.
  if (!perfil.nome && nomeGoogle) {
    await admin
      .from('member_profiles')
      .update({ nome: nomeGoogle })
      .eq('email', email)
  }

  return {
    email: perfil.email,
    nome: perfil.nome || nomeGoogle || email,
    abaPlanilha: perfil.aba_planilha,
    papel: perfil.papel,
    ativo: perfil.ativo,
    avatarUrl,
    emailRemetente: perfil.email_remetente ?? null,
  }
}

/** Para Server Components: garante sessão válida ou manda para o login. */
export async function exigirMembro(): Promise<Membro> {
  const membro = await obterMembro()
  if (!membro) redirect('/login')
  if (!membro.ativo) redirect('/login?motivo=inativo')
  return membro
}

/** Para Route Handlers: devolve o membro ou uma resposta 401/403 pronta. */
export async function exigirMembroNaApi(): Promise<
  { membro: Membro } | { resposta: Response }
> {
  const membro = await obterMembro()

  if (!membro) {
    return {
      resposta: Response.json(
        { erro: 'nao_autenticado', mensagem: 'Faça login para continuar.' },
        { status: 401 },
      ),
    }
  }

  if (!membro.ativo) {
    return {
      resposta: Response.json(
        { erro: 'membro_inativo', mensagem: 'Seu acesso está desativado.' },
        { status: 403 },
      ),
    }
  }

  return { membro }
}

/**
 * Para rotas do CRM restritas a admin (reatribuir dono, configurar etapas,
 * produtos, motivos de perda, tipos de atividade, campos dinâmicos).
 *
 * A checagem real de autorização é aqui — a RLS do banco é defesa em
 * profundidade, não o mecanismo principal (a aplicação sempre fala com o
 * Postgres pela chave de service role, ver n8n/sql/003_crm.sql).
 */
export function exigirAdmin(membro: Membro): Response | null {
  if (membro.papel !== 'admin') {
    return Response.json(
      {
        erro: 'acao_restrita_a_admin',
        mensagem: 'Só um administrador pode fazer isso.',
      },
      { status: 403 },
    )
  }
  return null
}

/**
 * Como todo workflow grava na aba do membro, quem não tem vínculo não pode
 * dispará-los — mas continua enxergando as telas de leitura.
 */
export function exigirAbaPlanilha(membro: Membro): string | Response {
  if (!membro.abaPlanilha) {
    return Response.json(
      {
        erro: 'sem_aba_vinculada',
        mensagem:
          'Seu login ainda não está vinculado a uma aba da planilha. Peça para um administrador fazer o vínculo antes de disparar automações.',
      },
      { status: 409 },
    )
  }
  return membro.abaPlanilha
}
