import { NextRequest, NextResponse } from 'next/server'
import { Company } from '@/types'

export async function POST(req: NextRequest) {
  try {
    const { companies }: { companies: Company[] } = await req.json()
    const apiKey = process.env.ANTHROPIC_API_KEY

    if (!apiKey) {
      console.error('[enrich] ANTHROPIC_API_KEY não configurada')
      return NextResponse.json({ error: 'API key não configurada. Configure ANTHROPIC_API_KEY nas variáveis de ambiente.' }, { status: 500 })
    }

    const enriched = await Promise.all(
      companies.map(async (company) => {
        const prompt = `Você é um especialista em vendas B2B para o mercado brasileiro.
Analise os dados desta empresa e gere insights para prospecção.

Empresa: ${company.razao_social}
Nome Fantasia: ${company.nome_fantasia || 'Não informado'}
Setor: ${company.setor}
Porte: ${company.porte}
Cidade: ${company.cidade} - ${company.estado}

Retorne APENAS um JSON válido com este formato, sem explicações ou markdown:
{
  "dor_provavel": "Principal dor que empresas deste perfil enfrentam (1 frase objetiva)",
  "abordagem_sugerida": "CLASSICA",
  "justificativa": "Por que essa abordagem funciona para esse perfil (1 frase)",
  "gancho": "Frase de abertura para o pitch (máximo 20 palavras)"
}`

        try {
          const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model: 'claude-haiku-4-5-20251001',
              max_tokens: 300,
              messages: [{ role: 'user', content: prompt }],
            }),
          })

          if (!res.ok) {
            const errBody = await res.text()
            console.error(`[enrich] Anthropic API error ${res.status}:`, errBody)
            return company
          }

          const data = await res.json()
          const text = data.content?.[0]?.text || '{}'
          const clean = text.replace(/```json|```/g, '').trim()
          const enrichment = JSON.parse(clean)

          return { ...company, enrichment }
        } catch (err) {
          console.error('[enrich] Erro ao enriquecer empresa:', company.razao_social, err)
          return company
        }
      })
    )

    return NextResponse.json({ companies: enriched })
  } catch (error) {
    console.error('[enrich] Erro interno:', error)
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 })
  }
}
