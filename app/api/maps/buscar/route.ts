import { NextRequest } from 'next/server'
import { exigirMembroNaApi, exigirAbaPlanilha } from '@/lib/sessao'
import { chamarN8n, ROTAS_N8N, MENSAGENS_ERRO_N8N } from '@/lib/n8n'

interface RespostaW5 {
  setor: string
  cidades_processadas: number
  cidades_bloqueadas_por_orcamento: number
  mensagem_orcamento: string
  total_acumulado_por_filtro: number
  concluido_em: string
  /** O W5 marca aqui quando o Google Places recusou a chamada. */
  erro_api?: boolean
  mensagem_api?: string
}

const MAX_CIDADES = 10
const MAX_POR_CIDADE = 60

/** Dispara o W5: busca no Google Places, analisa com IA e grava na planilha. */
export async function POST(req: NextRequest) {
  const sessao = await exigirMembroNaApi()
  if ('resposta' in sessao) return sessao.resposta

  const aba = exigirAbaPlanilha(sessao.membro)
  if (aba instanceof Response) return aba

  const corpo = await req.json()

  const setor = String(corpo.setor ?? '').trim()
  const cidades: string[] = Array.isArray(corpo.cidades)
    ? corpo.cidades
        .map((c: unknown) => String(c).trim())
        .filter(Boolean)
        .slice(0, MAX_CIDADES)
    : []

  if (!setor) {
    return Response.json(
      { erro: 'setor_obrigatorio', mensagem: 'Informe o setor a buscar.' },
      { status: 400 },
    )
  }

  if (cidades.length === 0) {
    return Response.json(
      { erro: 'cidade_obrigatoria', mensagem: 'Informe ao menos uma cidade.' },
      { status: 400 },
    )
  }

  const limite = Math.min(Math.max(1, Number(corpo.limite) || 10), MAX_POR_CIDADE)

  // O W5 percorre cidade a cidade chamando o Places e a IA: bem mais lento
  // que os demais workflows, daí o teto de tempo mais generoso.
  const resultado = await chamarN8n<RespostaW5>(
    ROTAS_N8N.maps,
    {
      setor,
      cidades,
      limite,
      useAI: corpo.useAI !== false,
      membro: aba,
    },
    { timeoutMs: 280_000 },
  )

  if (!resultado.ok) {
    return Response.json(
      {
        erro: resultado.erro,
        mensagem: MENSAGENS_ERRO_N8N[resultado.erro] ?? 'Falha na busca do Maps.',
        detalhe: resultado.detalhe,
      },
      { status: resultado.status },
    )
  }

  // O W5 responde 200 mesmo quando o Places falha, para nao perder o que as
  // outras cidades trouxeram. Sem tratar aqui, uma chave sem permissao apareceria
  // na tela como "0 empresas" — silencio no lugar de erro.
  if (resultado.dados.erro_api) {
    return Response.json(
      {
        erro: 'places_recusou',
        mensagem:
          'O Google Places recusou a busca. Confira se a Places API (New) está habilitada no Google Cloud e se a chave não tem restrição de IP ou de referenciador.',
        detalhe: resultado.dados.mensagem_api ?? '',
      },
      { status: 502 },
    )
  }

  return Response.json({
    setor: resultado.dados.setor ?? setor,
    cidadesProcessadas: resultado.dados.cidades_processadas ?? 0,
    cidadesBloqueadas: resultado.dados.cidades_bloqueadas_por_orcamento ?? 0,
    mensagemOrcamento: resultado.dados.mensagem_orcamento ?? '',
    totalAcumulado: resultado.dados.total_acumulado_por_filtro ?? 0,
    concluidoEm: resultado.dados.concluido_em ?? new Date().toISOString(),
  })
}
