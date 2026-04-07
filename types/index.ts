export interface Company {
  id: string
  cnpj: string
  razao_social: string
  nome_fantasia?: string
  nome_lead?: string
  setor: string
  cnae_codigo?: string
  porte: string
  cidade: string
  estado: string
  telefone?: string
  email?: string
  site?: string
  situacao: string
  data_abertura?: string
  enrichment?: Enrichment
  selected: boolean
}

export interface Enrichment {
  dor_provavel: string
  abordagem_sugerida: 'CLASSICA' | 'AIDA'
  justificativa: string
  gancho: string
}

export interface SearchFilters {
  setor: string
  porte: string
  cidade: string
  estado: string
  quantidade: number
  nomeEmpresa: string
  apenasComContato: boolean
  idadeEmpresa: string
}

export interface CNPJApiResponse {
  cnpj: string
  razao_social: string
  nome_fantasia: string
  cnae_fiscal: number
  cnae_fiscal_descricao: string
  porte: string
  municipio: string
  uf: string
  ddd_telefone_1: string
  email: string
  situacao_cadastral: string
  data_inicio_atividade: string
  descricao_porte: string
}
