import { exigirMembroDaExtensao } from '@/lib/extensao'
import { chamarRpcCrm } from '@/lib/crm'
import { PlanilhaNaoConfiguradaError, registrarCapturaNaPlanilha } from '@/lib/planilha'

/**
 * Captura de um perfil do LinkedIn, vinda da extensão do Chrome.
 *
 * Escreve direto na planilha e no CRM — não passa mais pelo n8n. Passava
 * (webhook W4), mas o trial do n8n Cloud expirou e os workflows ficaram
 * pausados; em vez de esperar uma assinatura para uma extensão que só faz
 * duas gravações simples, a lógica do W4 (documentada em `n8n/README.md`)
 * foi reimplementada aqui: `lib/planilha.ts` para a aba do membro,
 * `crm_registrar_captura_linkedin` para organização/contato.
 *
 * As duas gravações são independentes de propósito, como o node do W4 fazia
 * com `onError: continueRegularOutput`: se o CRM falhar, a planilha — que é
 * o que o time realmente usa no dia a dia — já foi gravada, e a falha só é
 * logada, não devolvida como erro ao membro.
 */
export async function POST(req: Request) {
  const sessao = await exigirMembroDaExtensao(req)
  if ('resposta' in sessao) return sessao.resposta
  const { membro } = sessao

  // Sem aba vinculada não tem onde escrever. Erro explícito, porque o
  // vínculo é coisa que um admin resolve em um minuto — e a alternativa
  // (gravar em lugar nenhum e responder ok) esconderia o problema por semanas.
  if (!membro.abaPlanilha) {
    return Response.json(
      {
        erro: 'sem_aba_vinculada',
        mensagem:
          'Sua conta ainda não está vinculada a uma aba da planilha. Peça a um administrador para fazer o vínculo — até lá a captura não tem onde ser gravada.',
      },
      { status: 409 },
    )
  }

  const corpo = await req.json().catch(() => ({}))

  const nome = String(corpo.nome ?? '').trim()
  const empresa = String(corpo.empresa ?? '').trim()
  const cargo = String(corpo.cargo ?? '').trim()
  const linkedinUrl = String(corpo.linkedinUrl ?? corpo.linkedin_url ?? '').trim()

  // Só o nome é obrigatório. A empresa **não** é: o LinkedIn nem sempre a
  // expõe de um jeito que dê para ler da página — headline que é lista de
  // especialidades, perfil sem empresa atual, markup que mudou. Descartar a
  // captura inteira por causa disso seria perder o lead para não deixar uma
  // célula em branco, sendo que a pessoa está olhando o perfil na hora e
  // preenche a empresa em dois segundos. A linha na planilha, com nome, URL
  // e data, já é quase todo o valor.
  if (!nome) {
    return Response.json(
      {
        erro: 'campos_obrigatorios_ausentes',
        mensagem: 'A captura precisa pelo menos do nome.',
        faltando: ['nome'],
      },
      { status: 400 },
    )
  }

  if (!empresa) {
    console.warn(
      '[extensao/prospeccao] captura sem empresa — gravando assim mesmo:',
      { membro: membro.email, linkedinUrl },
    )
  }

  let resultado: { linha: number; novaLinha: boolean }
  try {
    resultado = await registrarCapturaNaPlanilha(membro.abaPlanilha, {
      nome,
      empresa,
      cargo,
      linkedinUrl,
    })
  } catch (erro) {
    if (erro instanceof PlanilhaNaoConfiguradaError) {
      console.error('[extensao/prospeccao] planilha não configurada:', erro.message)
      return Response.json(
        {
          erro: 'planilha_nao_configurada',
          mensagem:
            'A integração com a planilha ainda não foi configurada neste ambiente. Avise um administrador.',
        },
        { status: 503 },
      )
    }
    console.error('[extensao/prospeccao] falha ao gravar na planilha:', erro)
    return Response.json(
      {
        erro: 'falha_na_planilha',
        mensagem: 'Não foi possível gravar a captura na planilha agora. Tente de novo em alguns instantes.',
      },
      { status: 502 },
    )
  }

  // Sem empresa não dá para criar organização no CRM — é o nome dela que
  // identifica o registro. A linha na planilha já foi gravada de qualquer
  // forma; o CRM fica de fora desta captura, e não o contrário.
  if (empresa) {
    try {
      const crm = await chamarRpcCrm('crm_registrar_captura_linkedin', {
        p_membro_email: membro.email,
        p_nome: nome,
        p_empresa: empresa,
        p_cargo: cargo || null,
        p_linkedin_url: linkedinUrl || null,
      })
      if (!crm.ok) {
        console.error('[extensao/prospeccao] falha ao gravar no CRM:', crm.erro, crm.mensagem)
      }
    } catch (erro) {
      console.error('[extensao/prospeccao] falha inesperada ao gravar no CRM:', erro)
    }
  }

  // Onde exatamente a linha caiu: é a única forma de conferir isso sem pedir
  // para alguém procurar na planilha a olho.
  console.info(
    '[extensao/prospeccao] gravado em %s!%d (%s):',
    membro.abaPlanilha,
    resultado.linha,
    resultado.novaLinha ? 'linha nova' : 'linha existente atualizada',
    { nome, empresa: empresa || '(vazia)' },
  )

  return Response.json({
    ok: true,
    linha: resultado.linha,
    aba: membro.abaPlanilha,
  })
}
