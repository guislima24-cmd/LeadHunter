import { Company, CNPJApiResponse } from '@/types'
import { cnaeToSetor } from '@/data/cnaes'

export async function fetchCNPJ(cnpj: string): Promise<Company | null> {
  const clean = cnpj.replace(/\D/g, '')

  try {
    // Tenta BrasilAPI primeiro
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`, {
      next: { revalidate: 3600 },
    })

    if (!res.ok) throw new Error('BrasilAPI failed')

    const data: CNPJApiResponse = await res.json()

    if (data.situacao_cadastral !== 'ATIVA' && data.situacao_cadastral !== '02') {
      return null
    }

    return {
      id: clean,
      cnpj: formatCNPJ(clean),
      razao_social: data.razao_social,
      nome_fantasia: data.nome_fantasia || undefined,
      setor: cnaeToSetor(String(data.cnae_fiscal)),
      cnae_codigo: String(data.cnae_fiscal),
      porte: data.descricao_porte || data.porte || 'Não informado',
      cidade: data.municipio,
      estado: data.uf,
      telefone: data.ddd_telefone_1 ? formatPhone(data.ddd_telefone_1) : undefined,
      email: data.email?.toLowerCase() || undefined,
      situacao: 'Ativa',
      data_abertura: data.data_inicio_atividade,
      selected: false,
    }
  } catch {
    try {
      // Fallback: ReceitaWS
      const res2 = await fetch(`https://receitaws.com.br/v1/cnpj/${clean}`, {
        next: { revalidate: 3600 },
      })
      if (!res2.ok) return null
      const data2 = await res2.json()
      if (data2.status === 'ERROR' || data2.situacao !== 'ATIVA') return null

      return {
        id: clean,
        cnpj: formatCNPJ(clean),
        razao_social: data2.nome,
        nome_fantasia: data2.fantasia || undefined,
        setor: cnaeToSetor(data2.atividade_principal?.[0]?.code || ''),
        porte: data2.porte || 'Não informado',
        cidade: data2.municipio,
        estado: data2.uf,
        telefone: data2.telefone || undefined,
        email: data2.email?.toLowerCase() || undefined,
        situacao: 'Ativa',
        data_abertura: data2.abertura,
        selected: false,
      }
    } catch {
      return null
    }
  }
}

function formatCNPJ(cnpj: string): string {
  return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
}

function formatPhone(phone: string): string {
  const clean = phone.replace(/\D/g, '')
  if (clean.length === 10) return `(${clean.slice(0,2)}) ${clean.slice(2,6)}-${clean.slice(6)}`
  if (clean.length === 11) return `(${clean.slice(0,2)}) ${clean.slice(2,7)}-${clean.slice(7)}`
  return phone
}
