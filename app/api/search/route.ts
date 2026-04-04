import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { SearchFilters, Company } from '@/types'

export async function POST(req: NextRequest) {
  try {
    const filters: SearchFilters = await req.json()
    const { setor, porte, cidade, estado, quantidade } = filters

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Monta a query dinamicamente
    let query = supabase
      .from('leads')
      .select('*')
      .limit(Math.min(quantidade, 200))

    if (setor && setor !== '') {
      // Mapeia o value do filtro para o label do setor
      const setorMap: Record<string, string> = {
        tecnologia: 'Tecnologia',
        manufatura: 'Manufatura',
        saude: 'Saúde',
        varejo: 'Varejo',
        construcao: 'Construção',
        educacao: 'Educação',
        servicos: 'Serviços B2B',
        logistica: 'Logística',
        agro: 'Agronegócio',
        financeiro: 'Financeiro',
      }
      const setorLabel = setorMap[setor] || setor
      query = query.eq('setor', setorLabel)
    }

    if (estado && estado !== '') {
      query = query.eq('estado', estado)
    }

    if (porte && porte !== '') {
      const porteMap: Record<string, string> = {
        'MEI': 'Micro',
        'MICRO EMPRESA': 'Micro',
        'EMPRESA DE PEQUENO PORTE': 'Pequena',
        'DEMAIS': 'Grande',
      }
      const porteLabel = porteMap[porte] || porte
      query = query.eq('porte', porteLabel)
    }

    if (cidade && cidade !== '') {
      query = query.ilike('cidade', `%${cidade}%`)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const companies: Company[] = (data || []).map((row: Record<string, string>, i: number) => ({
      id: String(row.id || i),
      cnpj: row.cnpj || '',
      razao_social: row.razao_social || '',
      nome_fantasia: row.nome_fantasia || undefined,
      setor: row.setor || '',
      cnae_codigo: row.cnae || undefined,
      porte: row.porte || 'Não informado',
      cidade: row.cidade || '',
      estado: row.estado || '',
      telefone: row.telefone || undefined,
      email: row.email || undefined,
      situacao: 'Ativa',
      selected: false,
    }))

    return NextResponse.json({ companies, total: companies.length })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erro na busca' }, { status: 500 })
  }
}
