import 'server-only'
import { createHash, randomBytes } from 'node:crypto'
import { criarClienteAdmin } from '@/lib/supabase/admin'

/**
 * Credencial da extensão do Chrome.
 *
 * A extensão roda no navegador do membro, num domínio que não é o do CRM, e
 * o service worker dela não enxerga o cookie de sessão do Supabase. Por isso
 * ela não usa a sessão: usa um token próprio, que o membro gera na tela de
 * configurações e cola no popup da extensão uma vez.
 *
 * O segredo aparece **uma vez**, no momento em que é criado. O banco guarda
 * só o SHA-256 dele — mesmo raciocínio de senha, com a diferença de que aqui
 * não faz falta sal nem alongamento: o segredo tem 256 bits vindos de
 * `randomBytes`, então não existe dicionário nem força bruta que chegue nele.
 */

const PREFIXO = 'lhx_'

export interface MembroDaExtensao {
  email: string
  nome: string
  abaPlanilha: string | null
}

function hashDoToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

/** Gera um token novo. O valor em claro só existe neste retorno. */
export async function emitirToken(
  membroEmail: string,
  nomeDispositivo: string | null,
): Promise<{ token: string; id: string } | null> {
  const segredo = randomBytes(32).toString('base64url')
  const token = `${PREFIXO}${segredo}`

  const admin = criarClienteAdmin()
  const { data, error } = await admin
    .from('extensao_tokens')
    .insert({
      membro_email: membroEmail,
      token_hash: hashDoToken(token),
      // Só o suficiente para a pessoa distinguir dois tokens na lista.
      prefixo: token.slice(0, PREFIXO.length + 6),
      nome_dispositivo: nomeDispositivo?.trim() || null,
    })
    .select('id')
    .single()

  if (error || !data) return null
  return { token, id: data.id as string }
}

/**
 * Quem é o dono deste token.
 *
 * Devolve `null` para token inexistente, revogado ou de membro inativo — a
 * rota que chama não precisa distinguir os três casos, e não deve: responder
 * "esse token existe mas foi revogado" conta a quem tentou que ele acertou
 * metade do palpite.
 */
export async function membroPeloToken(
  cabecalho: string | null,
): Promise<MembroDaExtensao | null> {
  const token = (cabecalho ?? '').trim()
  if (!token.startsWith(PREFIXO) || token.length < PREFIXO.length + 20) {
    return null
  }

  const admin = criarClienteAdmin()
  const { data, error } = await admin.rpc('resolver_token_extensao', {
    p_token_hash: hashDoToken(token),
  })

  if (error || !data?.length) return null
  const linha = data[0] as {
    membro_email: string
    aba_planilha: string | null
    nome: string
  }

  return {
    email: linha.membro_email,
    nome: linha.nome,
    abaPlanilha: linha.aba_planilha,
  }
}

/**
 * O mesmo, já em formato de resposta HTTP para as rotas da extensão.
 *
 * Toda rota da extensão começa com isto, e nenhuma delas aceita sessão de
 * navegador: o token é o único caminho, o que mantém a superfície pequena.
 */
export async function exigirMembroDaExtensao(
  req: Request,
): Promise<{ membro: MembroDaExtensao } | { resposta: Response }> {
  const membro = await membroPeloToken(req.headers.get('X-Extensao-Token'))

  if (!membro) {
    return {
      resposta: Response.json(
        {
          erro: 'token_invalido',
          mensagem:
            'Token da extensão inválido ou revogado. Gere um novo em Configurações → Extensão e cole no popup.',
        },
        { status: 401 },
      ),
    }
  }

  return { membro }
}

export interface TokenNaLista {
  id: string
  prefixo: string
  nomeDispositivo: string | null
  criadoEm: string
  ultimoUsoEm: string | null
}

export async function listarTokensDoMembro(
  membroEmail: string,
): Promise<TokenNaLista[]> {
  const admin = criarClienteAdmin()
  const { data } = await admin
    .from('extensao_tokens')
    .select('id, prefixo, nome_dispositivo, criado_em, ultimo_uso_em')
    .eq('membro_email', membroEmail)
    .is('revogado_em', null)
    .order('criado_em', { ascending: false })

  return (data ?? []).map((t) => ({
    id: t.id as string,
    prefixo: t.prefixo as string,
    nomeDispositivo: (t.nome_dispositivo as string | null) ?? null,
    criadoEm: t.criado_em as string,
    ultimoUsoEm: (t.ultimo_uso_em as string | null) ?? null,
  }))
}

/**
 * Revoga um token.
 *
 * O filtro por `membro_email` não é redundante com o `id`: sem ele, alguém
 * que descobrisse o id de um token alheio poderia revogá-lo — derrubar a
 * extensão de outra pessoa é pequeno como estrago, mas é estrago.
 */
export async function revogarToken(
  id: string,
  membroEmail: string,
): Promise<boolean> {
  const admin = criarClienteAdmin()
  const { error } = await admin
    .from('extensao_tokens')
    .update({ revogado_em: new Date().toISOString() })
    .eq('id', id)
    .eq('membro_email', membroEmail)
    .is('revogado_em', null)

  return !error
}
