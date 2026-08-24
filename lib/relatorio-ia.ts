import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { formatarMesAno, formatarNumero, formatarReais } from '@/lib/formato'
import type { SnapshotDeMetricas } from '@/lib/tipos-insights'

/**
 * Redação do relatório mensal a partir de um snapshot de métricas.
 *
 * A IA aqui **não calcula nada**. Ela recebe números que o CRM já apurou e os
 * escreve em prosa — é um problema de redação sobre dado estruturado, não de
 * análise. Por isso não tem acesso ao banco, nem ferramentas, nem sequer os
 * ids das entidades: só o snapshot, já formatado em português.
 *
 * O que sai daqui nasce como rascunho, sempre. Quem publica é gente.
 */

const MODELO = 'claude-opus-5'

/**
 * O tom que o texto precisa ter, e — mais importante — o que ele não pode
 * fazer.
 *
 * As proibições são específicas de propósito. "Escreva de forma humanizada"
 * produz exatamente o texto genérico que se quer evitar; o que muda o
 * resultado é dizer quais construções não usar, e exigir que todo número
 * citado exista no snapshot.
 */
const INSTRUCOES = `Você redige o relatório mensal do Núcleo Comercial da UFABC Júnior, uma empresa júnior de Ciência e Tecnologia da Universidade Federal do ABC.

Quem lê: os próprios membros do núcleo e a diretoria. São universitários que conhecem a operação de perto — não precisam de contexto sobre o que é um funil nem de explicação sobre o que a empresa faz.

REGRAS INEGOCIÁVEIS SOBRE OS NÚMEROS
- Use apenas os números do resumo que receber. Não calcule, não estime, não projete, não invente.
- Se um número não estiver no resumo, ele não existe para este relatório. Não escreva "aproximadamente", "cerca de" nem "provavelmente".
- Quando um dado estiver zerado ou ausente, diga isso de forma direta em vez de contornar. Um mês sem contratos fechados é um mês sem contratos fechados.
- Não afirme causa. "As reuniões caíram porque o time estava em época de provas" é invenção — a menos que esteja no resumo, você não sabe o porquê.

COMO ESCREVER
- Português do Brasil, primeira pessoa do plural ("fechamos", "prospectamos").
- Prosa corrida em parágrafos. Pode usar no máximo dois subtítulos curtos se o texto passar de quatro parágrafos.
- Entre 3 e 6 parágrafos. Um relatório mensal que ninguém lê inteiro não serviu para nada.
- Comece pelo que mais importa no mês, não por uma introdução sobre o relatório em si.

O QUE NÃO FAZER — estas construções denunciam texto automático:
- Não abra com "Neste mês", "No mês de X", "O presente relatório" nem "Este documento".
- Não feche com "Seguimos firmes", "Vamos com tudo", "Em suma", "Concluindo" nem qualquer frase de encerramento motivacional.
- Nada de "é importante destacar", "vale ressaltar", "cabe salientar", "de modo geral", "de maneira geral".
- Nada de jargão de análise de dados: "métricas", "KPIs", "performance", "insights", "taxa de conversão do funil", "pipeline". Escreva o que aconteceu, com as palavras que o time usa.
- Nada de bullet points repetindo os números que já estão na tabela do sistema.
- Não elogie nem repreenda pessoas nomeadamente.

Devolva apenas o texto do relatório. Sem título, sem preâmbulo, sem comentário sobre o que você fez.`

/** O snapshot em português, do jeito que um humano leria. */
function descreverSnapshot(s: SnapshotDeMetricas): string {
  const linhas: string[] = []

  linhas.push(`PERÍODO: ${formatarMesAno(s.periodo.inicio)} (de ${s.periodo.inicio} a ${s.periodo.fim})`)
  linhas.push('')

  linhas.push('FECHAMENTO DO PERÍODO')
  linhas.push(`- Negócios ganhos: ${formatarNumero(s.resumo.ganhos)}`)
  linhas.push(`- Negócios perdidos: ${formatarNumero(s.resumo.perdidos)}`)
  linhas.push(`- Valor fechado: ${formatarReais(s.resumo.valorGanho)}`)
  linhas.push(
    `- Ticket médio dos ganhos: ${s.resumo.ticketMedio == null ? 'sem ganhos com valor preenchido no período' : formatarReais(s.resumo.ticketMedio)}`,
  )
  linhas.push(
    `- Proporção de ganhos entre os fechados: ${s.resumo.taxaGanho == null ? 'nenhum negócio fechado no período' : `${s.resumo.taxaGanho}%`}`,
  )
  linhas.push('')

  linhas.push('PROSPECÇÃO (do primeiro contato ao contrato)')
  for (const e of s.funilProspeccao) {
    const conv = e.conversao == null ? '' : ` (${e.conversao}% da etapa anterior)`
    const fonte = e.fonte === 'manual' ? ' [registro manual do time]' : ''
    linhas.push(`- ${e.rotulo}: ${formatarNumero(e.quantidade)}${conv}${fonte}`)
  }
  linhas.push('')

  if (s.motivosDePerda.length > 0) {
    linhas.push('POR QUE OS NEGÓCIOS FORAM PERDIDOS')
    for (const m of s.motivosDePerda) {
      linhas.push(`- ${m.motivo}: ${formatarNumero(m.quantidade)}`)
    }
    linhas.push('')
  }

  const etapasComNegocio = s.valorPorEtapa.filter((e) => e.quantidade > 0)
  if (etapasComNegocio.length > 0) {
    linhas.push('O QUE SEGUE EM ABERTO NO FUNIL (situação no fim do período)')
    for (const e of etapasComNegocio) {
      linhas.push(
        `- ${e.etapaNome}: ${formatarNumero(e.quantidade)} ${e.quantidade === 1 ? 'negócio' : 'negócios'}, ${formatarReais(e.valor)}`,
      )
    }
    linhas.push('')
  }

  const conversoes = s.funilNegocios.filter((c) => c.percentual != null)
  if (conversoes.length > 0) {
    linhas.push('PASSAGEM ENTRE ETAPAS (histórico acumulado, não só do período)')
    for (const c of conversoes) {
      const tempo =
        c.tempoMedioDias == null
          ? ''
          : `, ${formatarNumero(c.tempoMedioDias)} ${c.tempoMedioDias === 1 ? 'dia' : 'dias'} em média nesta etapa`
      linhas.push(`- ${c.etapaNome}: ${c.percentual}% avançaram${tempo}`)
    }
    linhas.push('')
  }

  if (s.rankingProspeccao.length > 0) {
    linhas.push('PROSPECÇÃO POR MEMBRO (emails enviados no período)')
    for (const r of s.rankingProspeccao) {
      linhas.push(`- ${r.membro}: ${formatarNumero(r.prospeccoes)}`)
    }
    linhas.push('')
  }

  if (s.metas.length > 0) {
    linhas.push('METAS DO PERÍODO')
    for (const m of s.metas) {
      const unidade = m.unidade ? ` ${m.unidade}` : ''
      linhas.push(
        `- ${m.nome} (${m.metrica}): ${formatarNumero(m.atual)}${unidade} de ${formatarNumero(m.alvo)}${unidade} — ${m.percentual}% do alvo`,
      )
    }
    linhas.push('')
  } else {
    linhas.push('METAS DO PERÍODO: nenhuma meta cadastrada para este período.')
    linhas.push('')
  }

  return linhas.join('\n')
}

export type ResultadoRedacao =
  | { ok: true; conteudo: string }
  | { ok: false; erro: string; mensagem: string }

export async function redigirRelatorio(
  snapshot: SnapshotDeMetricas,
): Promise<ResultadoRedacao> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      ok: false,
      erro: 'ia_nao_configurada',
      mensagem:
        'A geração por IA precisa da variável ANTHROPIC_API_KEY no ambiente. Enquanto ela não estiver configurada, escreva o relatório à mão — o resto da tela funciona igual.',
    }
  }

  const cliente = new Anthropic()

  try {
    // Streaming porque `max_tokens` alto sem stream esbarra no timeout HTTP
    // do SDK. Não há UI de streaming aqui — só se espera a mensagem final.
    const stream = cliente.messages.stream({
      model: MODELO,
      max_tokens: 16000,
      system: INSTRUCOES,
      thinking: { type: 'adaptive' },
      messages: [
        {
          role: 'user',
          content: `Escreva o relatório do período com base nestes números.\n\n${descreverSnapshot(snapshot)}`,
        },
      ],
    })

    const resposta = await stream.finalMessage()

    if (resposta.stop_reason === 'refusal') {
      return {
        ok: false,
        erro: 'ia_recusou',
        mensagem:
          'A IA recusou redigir este relatório. Escreva à mão ou tente de novo depois.',
      }
    }

    const texto = resposta.content
      .filter((bloco) => bloco.type === 'text')
      .map((bloco) => bloco.text)
      .join('\n')
      .trim()

    if (!texto) {
      return {
        ok: false,
        erro: 'ia_sem_texto',
        mensagem: 'A IA não devolveu texto. Tente de novo.',
      }
    }

    return { ok: true, conteudo: texto }
  } catch (erro) {
    if (erro instanceof Anthropic.AuthenticationError) {
      return {
        ok: false,
        erro: 'ia_chave_invalida',
        mensagem: 'A chave da API da Anthropic foi recusada. Confira ANTHROPIC_API_KEY.',
      }
    }
    if (erro instanceof Anthropic.RateLimitError) {
      return {
        ok: false,
        erro: 'ia_limite',
        mensagem: 'Limite de uso da IA atingido. Tente de novo em alguns minutos.',
      }
    }
    if (erro instanceof Anthropic.APIError) {
      return {
        ok: false,
        erro: 'ia_falhou',
        mensagem: `A IA respondeu com erro ${erro.status}. Tente de novo em alguns minutos.`,
      }
    }
    return {
      ok: false,
      erro: 'ia_indisponivel',
      mensagem: 'Não foi possível falar com a IA agora. Tente de novo em alguns minutos.',
    }
  }
}
