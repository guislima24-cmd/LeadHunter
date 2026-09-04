import { exigirMembroNaApi } from '@/lib/sessao'
import { revogarToken } from '@/lib/extensao'

/** Revoga um token. A extensão que o usa para de funcionar na hora seguinte. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessao = await exigirMembroNaApi()
  if ('resposta' in sessao) return sessao.resposta

  const { id } = await params
  const ok = await revogarToken(id, sessao.membro.email)

  if (!ok) {
    return Response.json(
      { erro: 'falha_ao_revogar', mensagem: 'Não foi possível revogar o token.' },
      { status: 500 },
    )
  }

  return Response.json({ ok: true })
}
