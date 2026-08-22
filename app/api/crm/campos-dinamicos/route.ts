import { exigirMembroNaApi, exigirAdmin } from '@/lib/sessao'
import { criarClienteAdmin } from '@/lib/supabase/admin'

const ENTIDADES = ['negocio', 'organizacao', 'contato', 'atividade'] as const
const TIPOS = ['texto_curto', 'numero', 'data', 'booleano', 'selecao_multipla'] as const

/** Lista as definições de campo dinâmico ativas, opcionalmente filtradas por entidade. */
export async function GET(req: Request) {
  const sessao = await exigirMembroNaApi()
  if ('resposta' in sessao) return sessao.resposta

  const entidade = new URL(req.url).searchParams.get('entidade')

  const admin = criarClienteAdmin()
  let consulta = admin
    .from('campos_dinamicos_definicao')
    .select('id, entidade, chave, rotulo, tipo, opcoes, obrigatorio, ordem')
    .eq('ativo', true)
    .order('ordem', { ascending: true })

  if (entidade) consulta = consulta.eq('entidade', entidade)

  const { data } = await consulta
  return Response.json({ definicoes: data ?? [] })
}

/** Cria uma definição de campo dinâmico — configuração restrita a admin (Seção 5/8.6). */
export async function POST(req: Request) {
  const sessao = await exigirMembroNaApi()
  if ('resposta' in sessao) return sessao.resposta

  const negado = exigirAdmin(sessao.membro)
  if (negado) return negado

  const corpo = await req.json().catch(() => ({}))
  const entidade = corpo.entidade
  const tipo = corpo.tipo
  const chave = String(corpo.chave ?? '').trim()
  const rotulo = String(corpo.rotulo ?? '').trim()

  if (!ENTIDADES.includes(entidade) || !TIPOS.includes(tipo) || !chave || !rotulo) {
    return Response.json(
      {
        erro: 'campos_invalidos',
        mensagem: `entidade deve ser uma de ${ENTIDADES.join('/')}, tipo uma de ${TIPOS.join('/')}, e chave/rotulo são obrigatórios.`,
      },
      { status: 400 },
    )
  }

  if (tipo === 'selecao_multipla' && !Array.isArray(corpo.opcoes)) {
    return Response.json(
      {
        erro: 'opcoes_obrigatorias',
        mensagem: 'Campo do tipo seleção múltipla precisa de "opcoes" (lista de valores).',
      },
      { status: 400 },
    )
  }

  const admin = criarClienteAdmin()
  const { data, error } = await admin
    .from('campos_dinamicos_definicao')
    .insert({
      entidade,
      chave,
      rotulo,
      tipo,
      opcoes: tipo === 'selecao_multipla' ? corpo.opcoes : null,
      obrigatorio: Boolean(corpo.obrigatorio),
      ordem: corpo.ordem ?? null,
    })
    .select('id')
    .single()

  if (error || !data) {
    return Response.json(
      {
        erro: 'falha_ao_criar',
        mensagem:
          error?.code === '23505'
            ? 'Já existe um campo com essa chave para essa entidade.'
            : 'Não foi possível criar o campo dinâmico.',
      },
      { status: error?.code === '23505' ? 409 : 500 },
    )
  }

  return Response.json({ definicaoId: data.id }, { status: 201 })
}
