import { exigirMembroDaExtensao } from '@/lib/extensao'
import { chamarN8n, ROTAS_N8N } from '@/lib/n8n'

/**
 * Captura de um perfil do LinkedIn, vinda da extensão do Chrome.
 *
 * Esta rota é o que faltava para a extensão falar com o CRM. O webhook W4 do
 * n8n (`/apollo/linkedin-captura`) já existia e já fazia o certo — grava na
 * aba do membro na planilha **e** faz upsert em `organizacoes`/`contatos` —
 * mas nada no CRM o chamava: a extensão continuava apontando para o app antigo
 * do ProspectAI, que escrevia na planilha por um caminho paralelo.
 *
 * Então aqui não há regra de negócio nova. Há tradução: token da extensão →
 * membro → aba da planilha → W4.
 */
export async function POST(req: Request) {
  const sessao = await exigirMembroDaExtensao(req)
  if ('resposta' in sessao) return sessao.resposta
  const { membro } = sessao

  // Sem aba vinculada o W4 não tem onde escrever. Erro explícito, porque o
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

  if (!nome || !empresa) {
    return Response.json(
      {
        erro: 'campos_obrigatorios_ausentes',
        mensagem: 'A captura precisa pelo menos do nome e da empresa.',
        faltando: [!nome && 'nome', !empresa && 'empresa'].filter(Boolean),
      },
      { status: 400 },
    )
  }

  const resposta = await chamarN8n<{
    ok: boolean
    atualizado?: boolean
    linha?: number
    id_sync?: string
    aba?: string
  }>(ROTAS_N8N.linkedin, {
    nome,
    empresa,
    cargo: String(corpo.cargo ?? '').trim(),
    linkedin_url: String(corpo.linkedinUrl ?? corpo.linkedin_url ?? '').trim(),
    // O `membro` que o W4 espera é o nome da aba, não o email.
    membro: membro.abaPlanilha,
  })

  if (!resposta.ok) {
    return Response.json(
      {
        erro: resposta.erro,
        mensagem:
          resposta.erro === 'webhook_nao_encontrado'
            ? 'O workflow de captura do LinkedIn (W4) não respondeu. Avise um administrador.'
            : 'Não foi possível gravar a captura agora. Tente de novo em alguns instantes.',
        detalhe: resposta.detalhe,
      },
      { status: resposta.status === 404 ? 502 : 502 },
    )
  }

  return Response.json({
    ok: true,
    linha: resposta.dados?.linha ?? null,
    aba: resposta.dados?.aba ?? membro.abaPlanilha,
  })
}
