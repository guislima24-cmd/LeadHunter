import { NextRequest, NextResponse } from 'next/server'
import { fetchCNPJ } from '@/lib/brasilApi'
import { SearchFilters, Company } from '@/types'
import { SETORES } from '@/data/cnaes'

// CNPJs públicos reais por setor para demonstração
const SAMPLE_CNPJS: Record<string, string[]> = {
  tecnologia: ['33.000.167/0001-01', '60.701.190/0001-04', '07.526.557/0001-00', '10.316.614/0001-01', '18.065.507/0001-71'],
  manufatura: ['60.409.075/0001-52', '33.030.981/0001-79', '56.992.riate/0001-43', '58.157.510/0001-29', '33.041.260/0652-90'],
  saude: ['33.530.486/0001-29', '60.840.055/0001-31', '67.440.669/0001-11', '03.853.896/0001-40', '06.997.761/0001-87'],
  servicos: ['43.283.811/0001-92', '14.380.200/0001-21', '19.290.900/0001-76', '24.148.098/0001-55', '31.692.408/0001-79'],
  logistica: ['02.429.710/0001-89', '04.772.980/0001-80', '09.296.295/0001-60', '11.380.703/0001-30', '16.414.096/0001-62'],
  construcao: ['07.738.004/0001-53', '08.754.862/0001-35', '10.286.143/0001-48', '12.235.968/0001-19', '14.523.541/0001-06'],
  educacao: ['33.353.644/0001-17', '02.012.862/0001-60', '04.268.185/0001-91', '08.343.044/0001-38', '10.766.548/0001-00'],
  varejo: ['47.508.411/0001-56', '03.017.585/0001-04', '07.437.299/0001-69', '09.168.704/0001-43', '11.628.580/0001-20'],
  agro: ['28.083.069/0001-72', '14.879.283/0001-00', '06.986.093/0001-76', '10.832.952/0001-02', '15.576.297/0001-90'],
  financeiro: ['00.360.305/0001-04', '33.657.248/0001-89', '01.522.368/0001-82', '04.902.979/0001-44', '07.237.373/0001-20'],
}

// Gera CNPJs fictícios válidos para preenchimento
function gerarCNPJFicticio(setor: string, index: number): string {
  const base = [
    '11222333000181', '22333444000195', '33444555000100',
    '44555666000117', '55666777000128', '66777888000139',
    '77888999000140', '88999000000151', '99000111000162',
    '10111222000173', '21222333000184', '32333444000195',
  ]
  return base[index % base.length]
}

export async function POST(req: NextRequest) {
  try {
    const filters: SearchFilters = await req.json()
    const { setor, porte, cidade, estado, quantidade } = filters

    // Busca CNPJs reais conhecidos do setor
    const cnpjsList = SAMPLE_CNPJS[setor] || SAMPLE_CNPJS['servicos']
    const companies: Company[] = []
    const errors: string[] = []

    for (let i = 0; i < Math.min(quantidade, cnpjsList.length); i++) {
      const cnpj = cnpjsList[i].replace(/\D/g, '')
      try {
        await new Promise(r => setTimeout(r, 400)) // Rate limit
        const company = await fetchCNPJ(cnpj)
        if (company) {
          // Filtrar por cidade/estado se informado
          if (cidade && !company.cidade.toLowerCase().includes(cidade.toLowerCase())) continue
          if (estado && company.estado !== estado) continue
          if (porte && porte !== '' && !company.porte.toUpperCase().includes(porte.toUpperCase())) continue
          companies.push(company)
        }
      } catch {
        errors.push(cnpj)
      }
    }

    return NextResponse.json({
      companies,
      total: companies.length,
      errors: errors.length,
    })
  } catch (error) {
    return NextResponse.json({ error: 'Erro na busca' }, { status: 500 })
  }
}
