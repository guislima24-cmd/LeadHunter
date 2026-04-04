import { NextRequest, NextResponse } from 'next/server'
import { SearchFilters, Company } from '@/types'

export async function POST(req: NextRequest) {
  try {
    const filters: SearchFilters = await req.json()
    const { setor, porte, cidade, estado, quantidade } = filters

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'API key não configurada' }, { status: 500 })
    }

    const prompt = `Você é um especialista em empresas brasileiras. Gere uma lista de ${Math.min(quantidade, 50)} empresas brasileiras reais do setor de ${setor}.
${estado ? `Foque em empresas do estado: ${estado}` : ''}
${cidade ? `Preferencialmente da cidade: ${cidade}` : ''}
${porte && porte !== '' ? `Porte preferencial: ${porte}` : 'Misture portes variados (pequenas, médias e grandes)'}

Retorne APENAS um JSON válido sem markdown, com este formato exato:
[
  {
    "id": "1",
    "cnpj": "XX.XXX.XXX/0001-XX",
    "razao_social": "NOME DA EMPRESA S.A.",
    "nome_fantasia": "Nome Fantasia",
    "setor": "${setor}",
    "porte": "PEQUENA ou MÉDIA ou GRANDE ou MICRO",
    "cidade": "Nome da Cidade",
    "estado": "${estado || 'SP'}",
    "telefone": "(11) XXXX-XXXX",
    "email": "contato@empresa.com.br",
    "situacao": "Ativa",
    "selected": false
  }
]

Use empresas reais do mercado brasileiro. Varie os portes e cidades. Inclua e-mails e telefones plausíveis.`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await response.json()
    const text = data.content?.[0]?.text || '[]'
    const clean = text.replace(/```json|```/g, '').trim()

    let companies: Company[] = []
    try {
      companies = JSON.parse(clean)
      // Garante que todos têm selected: false e id único
      companies = companies.map((c, i) => ({
        ...c,
        id: `${Date.now()}-${i}`,
        selected: false,
      }))
    } catch {
      companies = []
    }

    return NextResponse.json({ companies, total: companies.length })
  } catch (error) {
    return NextResponse.json({ error: 'Erro na busca' }, { status: 500 })
  }
}
