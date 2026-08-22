import type { ReactNode } from 'react'

export interface ItemNavegacao {
  href: string
  rotulo: string
  descricao: string
  icone: ReactNode
  /** Só administradores enxergam. */
  somenteAdmin?: boolean
}

const props = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  className: 'size-[18px] shrink-0',
}

export const NAVEGACAO: ItemNavegacao[] = [
  {
    href: '/',
    rotulo: 'Início',
    descricao: 'Funil de negócios',
    icone: (
      <svg viewBox="0 0 24 24" {...props}>
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V20h14V9.5" />
        <path d="M9.5 20v-6h5v6" />
      </svg>
    ),
  },
  {
    href: '/buscar',
    rotulo: 'Buscar leads',
    descricao: 'Receita Federal + dedupe',
    icone: (
      <svg viewBox="0 0 24 24" {...props}>
        <circle cx="11" cy="11" r="6.5" />
        <path d="m20 20-3.6-3.6" />
      </svg>
    ),
  },
  {
    href: '/listas',
    rotulo: 'Minhas listas',
    descricao: 'Enriquecimento e prospecção',
    icone: (
      <svg viewBox="0 0 24 24" {...props}>
        <rect x="3.5" y="4" width="17" height="16" rx="2.5" />
        <path d="M8 9h8M8 13h8M8 17h5" />
      </svg>
    ),
  },
  {
    href: '/maps',
    rotulo: 'Google Maps',
    descricao: 'Prospecção local com IA',
    icone: (
      <svg viewBox="0 0 24 24" {...props}>
        <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" />
        <circle cx="12" cy="10" r="2.5" />
      </svg>
    ),
  },
  {
    href: '/monitoramento',
    rotulo: 'Monitoramento',
    descricao: 'Falhas e custos',
    somenteAdmin: true,
    icone: (
      <svg viewBox="0 0 24 24" {...props}>
        <path d="M3.5 13h4l2.5-6 4 12 2.5-6h4" />
      </svg>
    ),
  },
]
