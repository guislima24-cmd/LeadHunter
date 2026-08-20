import { NextRequest } from 'next/server'
import { exigirMembroNaApi, exigirAbaPlanilha } from '@/lib/sessao'
import { chamarN8n, ROTAS_N8N, MENSAGENS_ERRO_N8N } from '@/lib/n8n'
import { SETORES } from '@/data/cnaes'

interface RespostaW1 {
  lista_id: string
  quantidade: number
  bloqueados_por_contato: number
  bloqueados_por_reserva: number
}

const MAX_LEADS_POR_LISTA = 200

/** Dispara o W1: gera a lista com dedupe e reserva os leads para o membro. */
export async function POST(req: NextRequest) {
  const sessao = await exigirMembroNaApi()
  if ('resposta' in sessao) return sessao.resposta

  const aba = exigirAbaPlanilha(sessao.membro)
  if (aba instanceof Response) return aba

  const corpo = await req.json()

  const quantidade = Math.min(
    Math.max(1, Number(corpo.quantidade) || 20),
    MAX_LEADS_POR_LISTA,
  )
  const setorRotulo = SETORES.find((s) => s.value === corpo.setor)?.label ?? ''

  if (!setorRotulo && !corpo.cidade && !corpo.nomeEmpresa) {
    return Response.json(
      {
        erro: 'filtros_insuficientes',
        mensagem:
          'Escolha ao menos um setor, cidade ou nome de empresa antes de gerar a lista.',
      },
      { status: 400 },
    )
  }

  const resultado = await chamarN8n<RespostaW1>(ROTAS_N8N.gerarLista, {
    setor: setorRotulo,
    cidade: corpo.cidade ?? '',
    estado: corpo.estado ?? '',
    nomeEmpresa: corpo.nomeEmpresa ?? '',
    quantidade,
    filtroContato: corpo.filtroContato ?? 'todos',
    // Vem da sessão, nunca do corpo: ninguém gera lista no nome de outro.
    membro: aba,
  })

  if (!resultado.ok) {
    return Response.json(
      {
        erro: resultado.erro,
        mensagem: MENSAGENS_ERRO_N8N[resultado.erro] ?? 'Falha ao gerar a lista.',
        detalhe: resultado.detalhe,
      },
      { status: resultado.status },
    )
  }

  return Response.json({
    listaId: resultado.dados.lista_id,
    quantidade: resultado.dados.quantidade ?? 0,
    bloqueadosPorContato: resultado.dados.bloqueados_por_contato ?? 0,
    bloqueadosPorReserva: resultado.dados.bloqueados_por_reserva ?? 0,
  })
}
