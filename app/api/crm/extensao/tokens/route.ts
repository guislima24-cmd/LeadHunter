import { exigirMembroNaApi } from '@/lib/sessao'
import { emitirToken, listarTokensDoMembro } from '@/lib/extensao'

/** Os tokens ativos de quem está logado. Nunca devolve o segredo. */
export async function GET() {
  const sessao = await exigirMembroNaApi()
  if ('resposta' in sessao) return sessao.resposta

  const tokens = await listarTokensDoMembro(sessao.membro.email)
  return Response.json({ tokens })
}

/**
 * Emite um token novo.
 *
 * O segredo vai nesta resposta e **em nenhum outro lugar** — o banco só tem o
 * hash. Quem fechar a tela sem copiar precisa gerar outro; é o mesmo contrato
 * de um token de acesso pessoal do GitHub, e pela mesma razão.
 */
export async function POST(req: Request) {
  const sessao = await exigirMembroNaApi()
  if ('resposta' in sessao) return sessao.resposta

  const corpo = await req.json().catch(() => ({}))
  const resultado = await emitirToken(
    sessao.membro.email,
    typeof corpo.nomeDispositivo === 'string' ? corpo.nomeDispositivo : null,
  )

  if (!resultado) {
    return Response.json(
      { erro: 'falha_ao_emitir', mensagem: 'Não foi possível gerar o token.' },
      { status: 500 },
    )
  }

  return Response.json({ ok: true, id: resultado.id, token: resultado.token })
}
