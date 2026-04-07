import Papa from 'papaparse'
import { Company } from '@/types'

export function exportToCSV(companies: Company[]): void {
  const date = new Date().toISOString().split('T')[0].replace(/-/g, '')

  const rows = companies.map(c => ({
    'Nome Lead': c.nome_lead || '',
    'Company': c.nome_fantasia || c.razao_social,
    'Razao Social': c.razao_social,
    'Industry': c.setor,
    'CNAE': c.cnae_codigo || '',
    'Porte': c.porte,
    'City': c.cidade,
    'State': c.estado,
    'Email': c.email || '',
    'Phone': c.telefone || '',
    'Site': c.site || '',
    'CNPJ': c.cnpj,
    'Data Abertura': c.data_abertura || '',
    'Dor Provavel': c.enrichment?.dor_provavel || '',
    'Abordagem Sugerida': c.enrichment?.abordagem_sugerida || '',
    'Gancho': c.enrichment?.gancho || '',
    'Justificativa': c.enrichment?.justificativa || '',
  }))

  const csv = Papa.unparse(rows)
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `leadhunter_${date}.csv`
  link.click()
  URL.revokeObjectURL(url)
}
