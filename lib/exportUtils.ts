import Papa from 'papaparse'
import { Company } from '@/types'

export function exportToCSV(companies: Company[]): void {
  const date = new Date().toISOString().split('T')[0].replace(/-/g, '')

  const rows = companies.map(c => ({
    'nome': c.nome_lead || '',
    'empresa': c.nome_fantasia || c.razao_social,
    'razao_social': c.razao_social,
    'setor': c.setor,
    'cnae': c.cnae_codigo || '',
    'porte': c.porte,
    'cidade': c.cidade,
    'estado': c.estado,
    'email': c.email || '',
    'telefone': c.telefone || '',
    'cnpj': c.cnpj,
    'dor_provavel': c.enrichment?.dor_provavel || '',
    'abordagem_sugerida': c.enrichment?.abordagem_sugerida || '',
    'gancho': c.enrichment?.gancho || '',
    'justificativa': c.enrichment?.justificativa || '',
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
