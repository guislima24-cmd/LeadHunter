import { exigirMembroNaApi } from '@/lib/sessao'
import { criarClienteAdmin } from '@/lib/supabase/admin'

/** Cria uma atividade vinculada a negócio e/ou contato e/ou organização (Seção 8.5). */
export async function POST(req: Request) {
  const sessao = await exigirMembroNaApi()
  if ('resposta' in sessao) return sessao.resposta

  const corpo = await req.json().catch(() => ({}))
  const tipoId = String(corpo.tipoId ?? '').trim()
  const titulo = String(corpo.titulo ?? '').trim()
  const negocioId = corpo.negocioId ?? null
  const contatoId = corpo.contatoId ?? null
  const organizacaoId = corpo.organizacaoId ?? null

  if (!tipoId || !titulo) {
    return Response.json(
      { erro: 'campos_obrigatorios', mensagem: 'Informe ao menos tipoId e titulo.' },
      { status: 400 },
    )
  }

  if (!negocioId && !contatoId && !organizacaoId) {
    return Response.json(
      {
        erro: 'sem_vinculo',
        mensagem: 'A atividade precisa estar vinculada a um negócio, contato ou organização.',
      },
      { status: 400 },
    )
  }

  const admin = criarClienteAdmin()
  const { data, error } = await admin
    .from('atividades')
    .insert({
      tipo_id: tipoId,
      titulo,
      descricao: corpo.descricao ?? null,
      data_prazo: corpo.dataPrazo ?? null,
      negocio_id: negocioId,
      contato_id: contatoId,
      organizacao_id: organizacaoId,
      responsavel_email: corpo.responsavelEmail ?? sessao.membro.email,
      criado_por_email: sessao.membro.email,
    })
    .select('id')
    .single()

  if (error || !data) {
    return Response.json(
      { erro: 'falha_ao_criar', mensagem: 'Não foi possível criar a atividade.' },
      { status: 500 },
    )
  }

  return Response.json({ atividadeId: data.id }, { status: 201 })
}
