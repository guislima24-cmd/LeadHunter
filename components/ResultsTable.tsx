'use client'
import { Company } from '@/types'

interface Props {
  companies: Company[]
  onToggle: (id: string) => void
  onToggleAll: (selected: boolean) => void
}

export default function ResultsTable({ companies, onToggle, onToggleAll }: Props) {
  const allSelected = companies.every(c => c.selected)

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
            <th style={{ padding: '12px 16px', width: '40px' }}>
              <input
                type="checkbox"
                checked={allSelected}
                onChange={e => onToggleAll(e.target.checked)}
                style={{ accentColor: 'var(--accent)', width: '16px', height: '16px', cursor: 'pointer' }}
              />
            </th>
            {['Empresa / Lead', 'Setor', 'Localização', 'Contato', 'IA / Contexto'].map(col => (
              <th key={col} style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.7rem', fontFamily: 'Syne, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {companies.map((company, i) => (
            <tr
              key={company.id}
              style={{
                borderBottom: i < companies.length - 1 ? '1px solid #1a1a1a' : 'none',
                background: company.selected ? 'rgba(240,192,64,0.04)' : i % 2 === 0 ? 'var(--bg)' : 'var(--bg-card)',
                transition: 'background 0.15s',
              }}
            >
              <td style={{ padding: '12px 16px' }}>
                <input
                  type="checkbox"
                  checked={company.selected}
                  onChange={() => onToggle(company.id)}
                  style={{ accentColor: 'var(--accent)', width: '16px', height: '16px', cursor: 'pointer' }}
                />
              </td>

              {/* Empresa / Lead */}
              <td style={{ padding: '12px 16px', minWidth: '200px' }}>
                {company.nome_lead && (
                  <div style={{ color: 'var(--accent)', fontWeight: 600, fontSize: '0.8rem', marginBottom: '3px' }}>
                    👤 {company.nome_lead}
                  </div>
                )}
                <div style={{ color: 'var(--text-primary)', fontWeight: 500, fontSize: '0.875rem' }}>
                  {company.nome_fantasia || company.razao_social}
                </div>
                {company.nome_fantasia && (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginTop: '2px' }}>
                    {company.razao_social}
                  </div>
                )}
                <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontFamily: 'monospace', marginTop: '2px' }}>
                  {company.cnpj}
                </div>
              </td>

              {/* Setor */}
              <td style={{ padding: '12px 16px' }}>
                <span style={{ background: 'rgba(240,192,64,0.1)', color: 'var(--accent)', fontSize: '0.7rem', fontFamily: 'Syne, sans-serif', fontWeight: 700, padding: '3px 8px', borderRadius: '4px', display: 'inline-block' }}>
                  {company.setor}
                </span>
                {company.cnae_codigo && (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem', marginTop: '4px' }}>
                    CNAE: {company.cnae_codigo}
                  </div>
                )}
              </td>

              {/* Localização */}
              <td style={{ padding: '12px 16px' }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{company.cidade}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{company.estado}</div>
              </td>

              {/* Contato */}
              <td style={{ padding: '12px 16px', minWidth: '180px' }}>
                {company.email && (
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '4px', wordBreak: 'break-all' }}>
                    ✉ {company.email}
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.6rem', marginLeft: '4px' }}>· RF</span>
                  </div>
                )}
                {company.telefone && (
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                    📞 {company.telefone}
                  </div>
                )}
                {!company.email && !company.telefone && (
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Sem contato</span>
                )}
              </td>

              {/* IA / Contexto */}
              <td style={{ padding: '12px 16px', minWidth: '220px' }}>
                {company.enrichment ? (
                  <div>
                    {company.enrichment.gancho && (
                      <div style={{ color: 'var(--accent)', fontSize: '0.8rem', fontWeight: 600, lineHeight: '1.4', marginBottom: '4px' }}>
                        &ldquo;{company.enrichment.gancho}&rdquo;
                      </div>
                    )}
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', lineHeight: '1.4', marginBottom: '4px' }}>
                      {company.enrichment.dor_provavel}
                    </div>
                    <span style={{
                      background: company.enrichment.abordagem_sugerida === 'AIDA' ? 'rgba(59,130,246,0.15)' : 'rgba(34,197,94,0.15)',
                      color: company.enrichment.abordagem_sugerida === 'AIDA' ? '#3b82f6' : '#22c55e',
                      fontSize: '0.65rem',
                      fontFamily: 'Syne, sans-serif',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: '4px',
                    }}>
                      {company.enrichment.abordagem_sugerida}
                    </span>
                  </div>
                ) : (
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
