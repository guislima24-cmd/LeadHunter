import { exigirMembroNaApi, exigirAbaPlanilha } from '@/lib/sessao'
import { chamarN8n, ROTAS_N8N, MENSAGENS_ERRO_N8N } from '@/lib/n8n'
import { criarClienteAdmin } from '@/lib/supabase/admin'

/**
 * Reenfileira o enriquecimento dos leads da lista que ainda não estão `ok`.
 *
 * Existe porque o enriquecimento roda uma vez só, na criação da lista: um lead
 * que falhasse ali (cota do modelo, Tavily fora do ar) ficava com
 * `enriquecimento_status = 'erro'` para sempre, sem caminho de volta pela tela.
 *
 * O W2 responde na hora e segue processando em segundo plano — daí não haver
 * contagem no retorno. A página da lista se atualiza sozinha enquanto houver
 * lead na fila.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessao = await exigirMembroNaApi()
  if ('resposta' in sessao) return sessao.resposta

  const aba = exigirAbaPlanilha(sessao.membro)
  if (aba instanceof Response) return aba

  const { id } = await params

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

  const resultado = await chamarN8n(ROTAS_N8N.enriquecer, { lista_id: id })

  if (!resultado.ok) {
    return Response.json(
      {
        erro: resultado.erro,
        mensagem:
          MENSAGENS_ERRO_N8N[resultado.erro] ??
          'Falha ao reenfileirar o enriquecimento.',
        detalhe: resultado.detalhe,
      },
      { status: resultado.status },
    )
  }

  return Response.json({ aceito: true })
}
