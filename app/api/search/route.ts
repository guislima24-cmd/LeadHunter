import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { SearchFilters, Company } from '@/types'

// Remove acentos para busca normalizada (DB armazena sem acentos/maiúsculas)
function removeAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

// Extrai nome do lead da razão social (funciona bem para MEIs)
function extrairNomeLead(razaoSocial: string, porte: string): string | undefined {
  if (!razaoSocial) return undefined

  // Para MEIs, a razão social geralmente é o nome da pessoa
  if (porte === 'MEI') {
    // Remove números (CNPJ) do final se houver
    const nome = razaoSocial.replace(/\d{11,14}$/, '').trim()
    if (nome) {
      // Capitaliza o nome
      return nome
        .toLowerCase()
        .split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
    }
  }

  return undefined
}

export async function POST(req: NextRequest) {
  try {
    const filters: SearchFilters = await req.json()
    const { setor, porte, cidade, estado, quantidade, nomeEmpresa, apenasComContato, idadeEmpresa } = filters

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Monta a query dinamicamente - limit no final
    let query = supabase
      .from('leads')
      .select('*')

    if (setor && setor !== '') {
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

    // FIX: Usa o valor direto sem mapeamento errado
    if (porte && porte !== '') {
      query = query.eq('porte', porte)
    }

    // FIX: Normaliza removendo acentos para busca de cidade
    if (cidade && cidade !== '') {
      const cidadeNorm = removeAccents(cidade)
      query = query.ilike('cidade', `%${cidadeNorm}%`)
    }

    // Novo filtro: busca por nome da empresa
    if (nomeEmpresa && nomeEmpresa !== '') {
      const nomeNorm = removeAccents(nomeEmpresa)
      query = query.or(`razao_social.ilike.%${nomeNorm}%,nome_fantasia.ilike.%${nomeNorm}%`)
    }

    // Novo filtro: apenas com contato
    if (apenasComContato) {
      query = query.or('email.neq.,telefone.neq.')
    }

    // Novo filtro: idade da empresa (baseado em data_abertura)
    if (idadeEmpresa && idadeEmpresa !== '') {
      const hoje = new Date()
      let dataLimite: string | undefined
      let dataLimiteMax: string | undefined

      if (idadeEmpresa === 'nova') {
        // Menos de 2 anos
        const d = new Date(hoje)
        d.setFullYear(d.getFullYear() - 2)
        dataLimite = d.toISOString().split('T')[0]
        query = query.gte('data_abertura', dataLimite)
      } else if (idadeEmpresa === 'estabelecida') {
        // 2 a 10 anos
        const d2 = new Date(hoje)
        d2.setFullYear(d2.getFullYear() - 2)
        dataLimiteMax = d2.toISOString().split('T')[0]
        const d10 = new Date(hoje)
        d10.setFullYear(d10.getFullYear() - 10)
        dataLimite = d10.toISOString().split('T')[0]
        query = query.gte('data_abertura', dataLimite).lt('data_abertura', dataLimiteMax)
      } else if (idadeEmpresa === 'tradicional') {
        // Mais de 10 anos
        const d = new Date(hoje)
        d.setFullYear(d.getFullYear() - 10)
        dataLimite = d.toISOString().split('T')[0]
        query = query.lt('data_abertura', dataLimite)
      }
    }

    // Limit no final, após todos os filtros
    query = query.limit(Math.min(quantidade, 200))

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const companies: Company[] = (data || []).map((row: Record<string, string>, i: number) => ({
      id: String(row.id || i),
      cnpj: row.cnpj || '',
      razao_social: row.razao_social || row.nome_fantasia || 'Empresa sem nome',
      nome_fantasia: row.nome_fantasia && row.nome_fantasia !== row.razao_social ? row.nome_fantasia : undefined,
      nome_lead: extrairNomeLead(row.razao_social || '', row.porte || ''),
      setor: row.setor || '',
      cnae_codigo: row.cnae || undefined,
      porte: row.porte || 'Não informado',
      cidade: row.cidade || '',
      estado: row.estado || '',
      telefone: row.telefone || undefined,
      email: row.email || undefined,
      site: row.site || row.website || undefined,
      situacao: row.situacao || 'Ativa',
      data_abertura: row.data_abertura || undefined,
      selected: false,
    }))

    return NextResponse.json({ companies, total: companies.length })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erro na busca' }, { status: 500 })
  }
}
