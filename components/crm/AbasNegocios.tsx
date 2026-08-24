'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/cn'

/**
 * As quatro visualizações do mesmo funil, mais a lista de retomadas.
 *
 * Repete o que a barra lateral já mostra, de propósito: quem entra em
 * `/negocios` por um link direto (ou com a barra recolhida) não tem como
 * descobrir que Lista e Previsão existem — a subaba na lateral só aparece
 * dentro do grupo aberto.
 *
 * O contador de reagendados fica aqui e não no rótulo da lateral porque é
 * uma fila que se espera zerar: um número que some quando o trabalho acaba
 * pertence à tela do trabalho, não ao menu.
 */
const ABAS = [
  { href: '/negocios', rotulo: 'Kanban' },
  { href: '/negocios/lista', rotulo: 'Lista' },
  { href: '/negocios/funil', rotulo: 'Funil' },
  { href: '/negocios/previsao', rotulo: 'Previsão' },
  { href: '/negocios/reagendados', rotulo: 'Reagendados' },
] as const

export function AbasNegocios({
  reagendadosPendentes = 0,
}: {
  reagendadosPendentes?: number
}) {
  const caminho = usePathname()

  return (
    <div className="mb-5 flex gap-1 overflow-x-auto border-b border-tinta-200">
      {ABAS.map((aba) => {
        // Exato: `/negocios` é prefixo de todas as outras, e sem isto o
        // Kanban ficaria aceso em cima de qualquer visualização.
        const ativa = caminho === aba.href
        const contador =
          aba.href === '/negocios/reagendados' ? reagendadosPendentes : 0

        return (
          <Link
            key={aba.href}
            href={aba.href}
            aria-current={ativa ? 'page' : undefined}
            className={cn(
              '-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-sm font-semibold transition-colors',
              ativa
                ? 'border-verde-600 text-verde-700'
                : 'border-transparent text-tinta-500 hover:border-tinta-300 hover:text-tinta-800',
            )}
          >
            {aba.rotulo}
            {contador > 0 && (
              <span
                className={cn(
                  'numerico rounded-full px-1.5 py-0.5 text-[0.65rem] font-bold',
                  ativa
                    ? 'bg-verde-100 text-verde-700'
                    : 'bg-amarelo-100 text-amarelo-700',
                )}
              >
                {contador}
              </span>
            )}
          </Link>
        )
      })}
    </div>
  )
}
