'use client'
import { SearchFilters } from '@/types'
import { SETORES, PORTES, ESTADOS } from '@/data/cnaes'

interface Props {
  filters: SearchFilters
  onChange: (f: SearchFilters) => void
  onSearch: () => void
  loading: boolean
}

const inputStyle = {
  width: '100%',
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  color: 'var(--text-primary)',
  padding: '10px 14px',
  fontSize: '0.875rem',
  fontFamily: 'DM Sans, sans-serif',
  outline: 'none',
}

const labelStyle = {
  display: 'block' as const,
  color: 'var(--text-muted)',
  fontSize: '0.7rem',
  fontFamily: 'Syne, sans-serif',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.1em',
  marginBottom: '6px',
}

export default function FilterPanel({ filters, onChange, onSearch, loading }: Props) {
  const update = (key: keyof SearchFilters, value: string | number) => {
    onChange({ ...filters, [key]: value })
  }

  const valid = filters.setor !== ''

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px' }}>
      <h3 style={{ fontFamily: 'Syne, sans-serif', color: 'var(--accent)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '20px' }}>
        Filtros de Busca
      </h3>

      <div className="grid grid-cols-2 gap-4" style={{ marginBottom: '16px' }}>
        {/* Setor */}
        <div style={{ gridColumn: 'span 2' }}>
          <label style={labelStyle}>Setor *</label>
          <select
            value={filters.setor}
            onChange={e => update('setor', e.target.value)}
            style={{ ...inputStyle, cursor: 'pointer' }}
          >
            <option value="">Selecione um setor</option>
            {SETORES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        {/* Porte */}
        <div>
          <label style={labelStyle}>Porte</label>
          <select value={filters.porte} onChange={e => update('porte', e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
            {PORTES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>

        {/* Estado */}
        <div>
          <label style={labelStyle}>Estado</label>
          <select value={filters.estado} onChange={e => update('estado', e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
            <option value="">Todos</option>
            {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>

        {/* Cidade */}
        <div>
          <label style={labelStyle}>Cidade</label>
          <input
            style={inputStyle}
            placeholder="Ex: São Paulo"
            value={filters.cidade}
            onChange={e => update('cidade', e.target.value)}
          />
        </div>

        {/* Quantidade */}
        <div>
          <label style={labelStyle}>
            Quantidade: <span style={{ color: 'var(--accent)' }}>{filters.quantidade}</span>
          </label>
          <input
            type="range" min={5} max={50} step={5}
            value={filters.quantidade}
            onChange={e => update('quantidade', Number(e.target.value))}
            style={{ accentColor: 'var(--accent)', width: '100%', marginTop: '8px' }}
          />
        </div>
      </div>

      <button
        onClick={onSearch}
        disabled={loading || !valid}
        style={{
          width: '100%',
          background: !valid ? 'var(--bg)' : 'var(--accent)',
          color: !valid ? 'var(--text-muted)' : '#000',
          border: 'none',
          borderRadius: '10px',
          padding: '14px',
          fontFamily: 'Syne, sans-serif',
          fontWeight: 800,
          fontSize: '0.9rem',
          cursor: !valid || loading ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
        }}
      >
        {loading ? <><span className="spinner" /> Buscando empresas...</> : '🔍 Buscar Leads'}
      </button>
    </div>
  )
}
