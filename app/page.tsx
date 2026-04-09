'use client'
import { useState } from 'react'
import FilterPanel from '@/components/FilterPanel'
import ResultsTable from '@/components/ResultsTable'
import Pagination from '@/components/Pagination'
import { Company, SearchFilters, SearchResponse } from '@/types'
import { exportToCSV } from '@/lib/exportUtils'

const defaultFilters: SearchFilters = {
  setor: '',
  cidade: '',
  estado: '',
  quantidade: 50,
  nomeEmpresa: '',
  filtroContato: 'todos',
  page: 1,
  porPagina: 50,
}

export default function Home() {
  const [filters, setFilters] = useState<SearchFilters>(defaultFilters)
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(false)
  const [enriching, setEnriching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [totalResults, setTotalResults] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)

  const handleSearch = async (page = 1) => {
    setLoading(true)
    setSearched(true)
    setCompanies([])
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...filters, page }),
      })
      const data: SearchResponse = await res.json()
      setCompanies(data.companies || [])
      setTotalResults(data.total)
      setCurrentPage(data.page)
      setTotalPages(data.totalPages)
    } catch {
      alert('Erro na busca. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      handleSearch(newPage)
    }
  }

  const handleEnrich = async () => {
    const selected = companies.filter(c => c.selected)
    if (selected.length === 0) return
    setEnriching(true)
    try {
      const res = await fetch('/api/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companies: selected }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        alert(`Erro no enriquecimento: ${data.error || 'Erro desconhecido'}`)
        return
      }
      const enrichedMap = new Map(data.companies.map((c: Company) => [c.id, c]))
      setCompanies(prev => prev.map(c => enrichedMap.has(c.id) ? enrichedMap.get(c.id) as Company : c))
    } catch (err) {
      alert(`Erro no enriquecimento: ${err instanceof Error ? err.message : 'Erro de conexão'}`)
    } finally {
      setEnriching(false)
    }
  }

  const toggle = (id: string) => setCompanies(prev => prev.map(c => c.id === id ? { ...c, selected: !c.selected } : c))
  const toggleAll = (selected: boolean) => setCompanies(prev => prev.map(c => ({ ...c, selected })))
  const selectedCount = companies.filter(c => c.selected).length

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <header style={{ borderBottom: '1px solid var(--border)', padding: '0 32px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-card)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ background: 'var(--accent)', color: '#000', fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '0.8rem', padding: '3px 8px', borderRadius: '4px' }}>LEAD</span>
          <span style={{ color: 'var(--accent)', fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '0.8rem' }}>HUNTER</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontFamily: 'Syne, sans-serif' }}>· UFABC Júnior</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {selectedCount > 0 && (
            <>
              <button
                onClick={handleEnrich}
                disabled={enriching}
                style={{ background: 'transparent', border: '1px solid var(--accent)', borderRadius: '8px', padding: '7px 16px', color: 'var(--accent)', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {enriching ? <><span className="spinner" /> Enriquecendo...</> : `✦ Enriquecer com IA (${selectedCount})`}
              </button>
              <button
                onClick={() => exportToCSV(companies.filter(c => c.selected))}
                style={{ background: 'var(--accent)', border: 'none', borderRadius: '8px', padding: '7px 16px', color: '#000', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}
              >
                ↓ Exportar CSV ({selectedCount})
              </button>
            </>
          )}
        </div>
      </header>

      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 24px', display: 'grid', gridTemplateColumns: '280px 1fr', gap: '24px', alignItems: 'start' }}>
        {/* Sidebar filtros */}
        <div style={{ position: 'sticky', top: '80px' }}>
          <div style={{ marginBottom: '20px' }}>
            <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.5rem' }}>
              Encontre <span style={{ color: 'var(--accent)' }}>Leads</span>
            </h1>
            <p style={{ color: 'var(--text-muted)', marginTop: '4px', fontSize: '0.8rem' }}>
              Base pública da Receita Federal · gratuito
            </p>
          </div>
          <FilterPanel filters={filters} onChange={setFilters} onSearch={() => handleSearch()} loading={loading} />

          {/* Info */}
          <div style={{ marginTop: '16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', lineHeight: '1.6' }}>
              💡 Os leads encontrados exportam no formato compatível com o <span style={{ color: 'var(--accent)' }}>ProspectAI</span> — importe direto e gere as mensagens.
            </p>
          </div>
        </div>

        {/* Resultados */}
        <div>
          {!searched && !loading && (
            <div className="fade-in" style={{ textAlign: 'center', paddingTop: '80px' }}>
              <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🏭</div>
              <p style={{ color: 'var(--text-muted)', fontFamily: 'Syne, sans-serif', fontWeight: 700 }}>
                Configure os filtros e clique em Buscar
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '6px' }}>
                Dados oficiais da Receita Federal — custo zero
              </p>
            </div>
          )}

          {loading && (
            <div style={{ textAlign: 'center', paddingTop: '80px' }}>
              <span className="spinner" style={{ width: '32px', height: '32px', borderWidth: '3px' }} />
              <p style={{ color: 'var(--text-muted)', marginTop: '16px', fontFamily: 'Syne, sans-serif' }}>
                Consultando Receita Federal...
              </p>
            </div>
          )}

          {!loading && searched && companies.length === 0 && (
            <div className="fade-in" style={{ textAlign: 'center', paddingTop: '80px' }}>
              <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🔍</div>
              <p style={{ color: 'var(--text-muted)', fontFamily: 'Syne, sans-serif', fontWeight: 700 }}>Nenhuma empresa encontrada</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '6px' }}>Tente outros filtros</p>
            </div>
          )}

          {!loading && companies.length > 0 && (
            <div className="fade-in">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.1rem' }}>
                  <span style={{ color: 'var(--accent)' }}>{totalResults}</span> empresas encontradas
                  {totalPages > 1 && (
                    <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.8rem', marginLeft: '8px' }}>
                      · Página {currentPage} de {totalPages}
                    </span>
                  )}
                </h2>
                {selectedCount > 0 && (
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    {selectedCount} selecionada{selectedCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <ResultsTable companies={companies} onToggle={toggle} onToggleAll={toggleAll} />
              <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={handlePageChange} />
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
