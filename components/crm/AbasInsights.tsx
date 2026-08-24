'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/cn'

const ABAS = [
  { href: '/insights', rotulo: 'Painel', exato: true },
  { href: '/insights/metas', rotulo: 'Metas', exato: true },
  { href: '/insights/relatorios', rotulo: 'Relatórios', exato: false },
  { href: '/insights/relatorios/gerar', rotulo: 'Gerar com IA', exato: true },
] as const

/**
 * As quatro telas de Insights.
 *
 * "Relatórios" casa por prefixo para continuar aceso ao abrir um relatório
 * específico — menos "Gerar com IA", que é filha dela na URL mas é uma tela
 * própria, e por isso se compara exata.
 */
export function AbasInsights() {
  const caminho = usePathname()

  return (
    <div className="mb-5 flex gap-1 overflow-x-auto border-b border-tinta-200">
      {ABAS.map((aba) => {
        const ativa =
          aba.exato || caminho === aba.href
            ? caminho === aba.href
            : caminho.startsWith(`${aba.href}/`) &&
              caminho !== '/insights/relatorios/gerar'

        return (
          <Link
            key={aba.href}
            href={aba.href}
            aria-current={ativa ? 'page' : undefined}
            className={cn(
              '-mb-px shrink-0 border-b-2 px-3.5 py-2.5 text-sm font-semibold transition-colors',
              ativa
                ? 'border-verde-600 text-verde-700'
                : 'border-transparent text-tinta-500 hover:border-tinta-300 hover:text-tinta-800',
            )}
          >
            {aba.rotulo}
          </Link>
        )
      })}
    </div>
  )
}
