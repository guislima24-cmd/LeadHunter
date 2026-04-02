import Papa from 'papaparse'
import { Company } from '@/types'

export function exportToCSV(companies: Company[]): void {
  const date = new Date().toISOString().split('T')[0].replace(/-/g, '')

  const rows = companies.map(c => ({
    'First Name': '',
    'Last Name': '',
    'Title': '',
    'Company': c.nome_fantasia || c.razao_social,
    'Industry': c.setor,
    '# Employees': '',
    'City': c.cidade,
    'Email': c.email || '',
    'Phone': c.telefone || '',
    'CNPJ': c.cnpj,
    'State': c.estado,
    'Porte': c.porte,
    'Data Abertura': c.data_abertura || '',
    'Dor Provavel': c.enrichment?.dor_provavel || '',
    'Abordagem Sugerida': c.enrichment?.abordagem_sugerida || '',
    'Gancho': c.enrichment?.gancho || '',
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
