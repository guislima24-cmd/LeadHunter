import type { ReactNode } from 'react'

export interface SubItemNavegacao {
  href: string
  rotulo: string
  /** Só administradores enxergam. */
  somenteAdmin?: boolean
}

export interface ItemNavegacao {
  /** Para onde o item leva. Num grupo, é a primeira subaba. */
  href: string
  rotulo: string
  descricao: string
  icone: ReactNode
  /** Só administradores enxergam. */
  somenteAdmin?: boolean
  /**
   * Quando presente, o item vira um grupo com subabas. O `href` continua
   * valendo — é para onde o clique no grupo leva, e é o que a barra usa
   * quando está recolhida e não há espaço para as subabas.
   */
  subitens?: SubItemNavegacao[]
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
    descricao: 'Panorama da operação',
    icone: (
      <svg viewBox="0 0 24 24" {...props}>
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V20h14V9.5" />
        <path d="M9.5 20v-6h5v6" />
      </svg>
    ),
  },
  {
    href: '/negocios',
    rotulo: 'Negócios',
    descricao: 'Funil, previsão e retomadas',
    icone: (
      <svg viewBox="0 0 24 24" {...props}>
        <rect x="3" y="7.5" width="18" height="13" rx="2" />
        <path d="M8.5 7.5V5.5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v2" />
        <path d="M3 12.5h18" />
      </svg>
    ),
    subitens: [
      { href: '/negocios', rotulo: 'Kanban' },
      { href: '/negocios/lista', rotulo: 'Lista' },
      { href: '/negocios/funil', rotulo: 'Funil' },
      { href: '/negocios/previsao', rotulo: 'Previsão' },
      { href: '/negocios/reagendados', rotulo: 'Reagendados' },
    ],
  },
  {
    href: '/buscar',
    rotulo: 'Leads',
    descricao: 'Receita Federal e Maps',
    icone: (
      <svg viewBox="0 0 24 24" {...props}>
        <circle cx="11" cy="11" r="6.5" />
        <path d="m20 20-3.6-3.6" />
      </svg>
    ),
    subitens: [
      { href: '/buscar', rotulo: 'Buscar leads' },
      { href: '/maps', rotulo: 'Google Maps' },
    ],
  },
  {
    href: '/insights',
    rotulo: 'Insights',
    descricao: 'Painel, metas e relatórios',
    icone: (
      <svg viewBox="0 0 24 24" {...props}>
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
      </svg>
    ),
    subitens: [
      { href: '/insights', rotulo: 'Painel' },
      { href: '/insights/metas', rotulo: 'Metas' },
      { href: '/insights/relatorios', rotulo: 'Relatórios' },
      { href: '/insights/relatorios/gerar', rotulo: 'Gerar com IA' },
    ],
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
    href: '/precificacao',
    rotulo: 'Precificação',
    descricao: 'Orçamento e régua de preço',
    icone: (
      <svg viewBox="0 0 24 24" {...props}>
        <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0l-7.2-7.2A2 2 0 0 1 2.8 12V4.8A2 2 0 0 1 4.8 2.8H12a2 2 0 0 1 1.4.6l7.2 7.2a2 2 0 0 1 0 2.8Z" />
        <path d="M7.5 7.5h.01" />
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

/**
 * Se um caminho cai dentro de um item de navegação.
 *
 * `/` é exato — senão toda rota da plataforma acenderia o Início junto. Os
 * demais casam por prefixo de segmento: `/negocios/lista` acende Negócios,
 * mas `/negocios` **não** deve acender um hipotético `/negocios-antigos`,
 * daí a barra no fim em vez de `startsWith` puro.
 */
export function caiEmRota(href: string, caminho: string) {
  if (href === '/') return caminho === '/'
  return caminho === href || caminho.startsWith(`${href}/`)
}

/**
 * A subaba ativa dentro de um grupo.
 *
 * A mais longa que casa vence: `/negocios/reagendados` casa tanto com ela
 * mesma quanto com `/negocios` (o Kanban), e sem o desempate por
 * comprimento as duas acenderiam ao mesmo tempo.
 */
export function subitemAtivo(
  subitens: SubItemNavegacao[],
  caminho: string,
): string | null {
  let escolhido: string | null = null
  for (const sub of subitens) {
    if (caiEmRota(sub.href, caminho)) {
      if (escolhido === null || sub.href.length > escolhido.length) {
        escolhido = sub.href
      }
    }
  }
  return escolhido
}
