import { criarClienteAdmin } from '@/lib/supabase/admin'
import { exigirMembroNaApi } from '@/lib/sessao'
import { listarMetasComProgresso } from '@/lib/insights'
import { validarMeta, respostaApenasAdmin } from '@/lib/validacao-metas'

/** Lista as metas com o progresso calculado. Qualquer membro pode ler. */
export async function GET() {
  const sessao = await exigirMembroNaApi()
  if ('resposta' in sessao) return sessao.resposta

  const metas = await listarMetasComProgresso({ incluirInativas: true })
  return Response.json({ metas })
}

/**
 * Cria uma meta. **Só admin** — meta é configuração de quanto a empresa se
 * cobra, não anotação pessoal.
 */
export async function POST(req: Request) {
  const sessao = await exigirMembroNaApi()
  if ('resposta' in sessao) return sessao.resposta
  if (sessao.membro.papel !== 'admin') return respostaApenasAdmin()

  const corpo = await req.json().catch(() => ({}))
  const erro = validarMeta(corpo)
  if (erro) return erro

  const admin = criarClienteAdmin()
  const { data, error } = await admin
    .from('metas')
    .insert({
      meta_pai_id: corpo.metaPaiId || null,
      nome: String(corpo.nome).trim(),
      descricao: corpo.descricao?.trim() || null,
      metrica_fonte: corpo.metricaFonte,
      valor_alvo: Number(corpo.valorAlvo),
      // Meta derivada ignora o valor informado: ele é calculado na leitura,
      // a partir da fonte real. Guardar um número aqui só criaria um segundo
      // valor para discordar do primeiro.
      valor_atual:
        corpo.metricaFonte === 'manual' ? Number(corpo.valorAtual ?? 0) : 0,
      unidade: corpo.unidade?.trim() || null,
      periodo_inicio: corpo.periodoInicio,
      periodo_fim: corpo.periodoFim,
      criado_por_email: sessao.membro.email,
    })
    .select('id')
    .single()

  if (error) {
    return Response.json(
      { erro: 'falha_ao_criar_meta', mensagem: error.message },
      { status: 500 },
    )
  }

  return Response.json({ ok: true, metaId: data.id })
}
