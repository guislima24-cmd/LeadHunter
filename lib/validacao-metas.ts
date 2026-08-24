import type { MetricaFonte } from '@/lib/tipos-insights'

/**
 * Validação compartilhada entre criar e editar meta.
 *
 * Fica aqui e não no arquivo de rota porque um Route Handler do App Router só
 * pode exportar os métodos HTTP — exportar um helper de lá quebra o build.
 */

export const FONTES_VALIDAS: MetricaFonte[] = [
  'manual',
  'contratos_fechados',
  'faturamento_ganho',
  'reunioes_realizadas',
  'prospeccoes_realizadas',
  'negocios_criados',
]

export function respostaApenasAdmin() {
  return Response.json(
    {
      erro: 'apenas_admin',
      mensagem: 'Só administradores criam ou editam metas.',
    },
    { status: 403 },
  )
}

export function validarMeta(corpo: Record<string, unknown>): Response | null {
  if (!String(corpo.nome ?? '').trim()) {
    return Response.json(
      { erro: 'nome_obrigatorio', mensagem: 'Dê um nome à meta.' },
      { status: 400 },
    )
  }
  if (!FONTES_VALIDAS.includes(corpo.metricaFonte as MetricaFonte)) {
    return Response.json(
      {
        erro: 'metrica_invalida',
        mensagem: 'Escolha de onde o progresso desta meta vem.',
      },
      { status: 400 },
    )
  }
  const alvo = Number(corpo.valorAlvo)
  if (!Number.isFinite(alvo) || alvo <= 0) {
    return Response.json(
      {
        erro: 'alvo_invalido',
        mensagem: 'O alvo precisa ser um número maior que zero.',
      },
      { status: 400 },
    )
  }
  const inicio = String(corpo.periodoInicio ?? '')
  const fim = String(corpo.periodoFim ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio) || !/^\d{4}-\d{2}-\d{2}$/.test(fim)) {
    return Response.json(
      { erro: 'periodo_invalido', mensagem: 'Informe o início e o fim do período.' },
      { status: 400 },
    )
  }
  if (fim < inicio) {
    return Response.json(
      {
        erro: 'periodo_invertido',
        mensagem: 'O fim do período não pode ser antes do início.',
      },
      { status: 400 },
    )
  }
  return null
}
