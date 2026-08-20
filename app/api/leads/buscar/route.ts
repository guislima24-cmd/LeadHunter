import { NextRequest } from 'next/server'
import { exigirMembroNaApi } from '@/lib/sessao'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { SETORES } from '@/data/cnaes'

export interface FiltrosBusca {
  setor?: string
  cidade?: string
  estado?: string
  nomeEmpresa?: string
  porte?: string
  filtroContato?: 'todos' | 'comContato' | 'apenasEmail' | 'apenasTelefone'
  pagina?: number
  porPagina?: number
}

export interface LeadBusca {
  cnpj: string
  razaoSocial: string
  nomeFantasia: string | null
  setor: string | null
  porte: string | null
  cidade: string | null
  estado: string | null
  telefone: string | null
  email: string | null
}

const MAX_POR_PAGINA = 100

/** A base grava cidades sem acento ("Sao Paulo"), então normalizamos a busca. */
function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/** Neutraliza os curingas do LIKE para que o usuário não altere a consulta. */
function escaparLike(texto: string): string {
  return texto.replace(/[%_\\]/g, '\\$&')
}

export async function POST(req: NextRequest) {
  const sessao = await exigirMembroNaApi()
  if ('resposta' in sessao) return sessao.resposta

  const filtros = (await req.json()) as FiltrosBusca

  const porPagina = Math.min(Math.max(1, filtros.porPagina ?? 25), MAX_POR_PAGINA)
  const pagina = Math.max(1, filtros.pagina ?? 1)
  const inicio = (pagina - 1) * porPagina

  const db = criarClienteAdmin()
  let consulta = db
    .from('leads')
    .select('cnpj, razao_social, nome_fantasia, setor, porte, cidade, estado, telefone, email')

  if (filtros.setor) {
    const rotulo = SETORES.find((s) => s.value === filtros.setor)?.label
    if (rotulo) consulta = consulta.eq('setor', rotulo)
  }

  if (filtros.estado) consulta = consulta.eq('estado', filtros.estado)
  if (filtros.porte) consulta = consulta.eq('porte', filtros.porte)

  if (filtros.cidade?.trim()) {
    consulta = consulta.ilike('cidade', `%${escaparLike(semAcento(filtros.cidade.trim()))}%`)
  }

  if (filtros.nomeEmpresa?.trim()) {
    const termo = escaparLike(semAcento(filtros.nomeEmpresa.trim()))
    consulta = consulta.or(
      `razao_social.ilike.%${termo}%,nome_fantasia.ilike.%${termo}%`,
    )
  }

  switch (filtros.filtroContato) {
    case 'comContato':
      consulta = consulta.or('email.neq.,telefone.neq.')
      break
    case 'apenasEmail':
      consulta = consulta.neq('email', '')
      break
    case 'apenasTelefone':
      consulta = consulta.neq('telefone', '')
      break
  }

  // Pede uma linha a mais para saber se existe próxima página. Um COUNT exato
  // sobre 1,67 milhão de linhas estoura o tempo limite do PostgREST.
  const { data, error } = await consulta.order('id').range(inicio, inicio + porPagina)

  if (error) {
    return Response.json(
      { erro: 'falha_na_busca', mensagem: error.message },
      { status: 500 },
    )
  }

  const linhas = data ?? []
  const temProxima = linhas.length > porPagina
  const pagina_ = temProxima ? linhas.slice(0, porPagina) : linhas

  const leads: LeadBusca[] = pagina_.map((l) => ({
    cnpj: String(l.cnpj ?? ''),
    razaoSocial: String(l.razao_social || l.nome_fantasia || 'Empresa sem nome'),
    nomeFantasia:
      l.nome_fantasia && l.nome_fantasia !== l.razao_social
        ? String(l.nome_fantasia)
        : null,
    setor: (l.setor as string) || null,
    porte: (l.porte as string) || null,
    cidade: (l.cidade as string) || null,
    estado: (l.estado as string) || null,
    telefone: (l.telefone as string) || null,
    email: (l.email as string) || null,
  }))

  return Response.json({ leads, pagina, porPagina, temProxima })
}
