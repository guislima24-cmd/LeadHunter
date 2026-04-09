import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { SearchFilters, Company, SearchResponse } from '@/types'

// Remove acentos para busca normalizada (DB armazena sem acentos)
function removeAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

// Extrai nome do lead da razão social (funciona bem para MEIs)
function extrairNomeLead(razaoSocial: string, porte: string): string | undefined {
  if (!razaoSocial) return undefined
  if (porte === 'MEI') {
    const nome = razaoSocial.replace(/\d{11,14}$/, '').trim()
    if (nome) {
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
    const { setor, cidade, estado, quantidade, nomeEmpresa, filtroContato, page = 1, porPagina = 50 } = filters

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const safeQuantidade = Math.min(quantidade, 1000)
    const safePorPagina = Math.min(porPagina, 100)
    const safePage = Math.max(1, page)
    const offset = (safePage - 1) * safePorPagina

    // Se o offset já passou do total desejado, retorna vazio
    if (offset >= safeQuantidade) {
      const empty: SearchResponse = { companies: [], total: 0, page: safePage, porPagina: safePorPagina, totalPages: 0 }
      return NextResponse.json(empty)
    }

    // Limita esta página para não ultrapassar quantidade total desejada
    const thisPageLimit = Math.min(safePorPagina, safeQuantidade - offset)

    // Busca thisPageLimit + 1 para saber se há próxima página (evita COUNT que causa timeout)
    let query = supabase.from('leads').select('*')

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

    // Normaliza acentos para busca de cidade (DB armazena sem acentos, ex: "Sao Paulo")
    if (cidade && cidade !== '') {
      const cidadeNorm = removeAccents(cidade)
      query = query.ilike('cidade', `%${cidadeNorm}%`)
    }

    // Busca por nome da empresa
    if (nomeEmpresa && nomeEmpresa !== '') {
      const nomeNorm = removeAccents(nomeEmpresa)
      query = query.or(`razao_social.ilike.%${nomeNorm}%,nome_fantasia.ilike.%${nomeNorm}%`)
    }

    // Filtro de contato
    if (filtroContato === 'comContato') {
      query = query.or('email.neq.,telefone.neq.')
    } else if (filtroContato === 'apenasEmail') {
      query = query.neq('email', '')
    } else if (filtroContato === 'apenasTelefone') {
      query = query.neq('telefone', '')
    }

    // Busca 1 a mais para detectar se há próxima página (sem COUNT custoso)
    query = query.order('id').range(offset, offset + thisPageLimit)

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const rows = data || []
    const hasNextPage = rows.length > thisPageLimit
    const pageRows = hasNextPage ? rows.slice(0, thisPageLimit) : rows

    const companies: Company[] = pageRows.map((row: Record<string, string>, i: number) => ({
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
      situacao: 'Ativa',
      selected: false,
    }))

    // Estimativa de páginas baseada no que sabemos
    // Se há próxima página, total é pelo menos (page * porPagina) + 1
    // Caso contrário, total é offset + rows retornadas
    const estimatedTotal = hasNextPage
      ? Math.min(safePage * safePorPagina + safePorPagina, safeQuantidade)
      : offset + pageRows.length
    const totalPages = hasNextPage
      ? Math.min(safePage + 1, Math.ceil(safeQuantidade / safePorPagina))
      : safePage

    const response: SearchResponse = {
      companies,
      total: estimatedTotal,
      page: safePage,
      porPagina: safePorPagina,
      totalPages,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erro na busca' }, { status: 500 })
  }
}
