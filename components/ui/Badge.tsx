import { cn } from '@/lib/cn'

export type TomBadge =
  | 'neutro'
  | 'verde'
  | 'amarelo'
  | 'perigo'
  | 'info'
  | 'contorno'

const tons: Record<TomBadge, string> = {
  neutro: 'bg-tinta-100 text-tinta-700',
  verde: 'bg-verde-50 text-verde-700',
  amarelo: 'bg-amarelo-50 text-amarelo-700',
  perigo: 'bg-perigo-50 text-perigo-700',
  info: 'bg-info-50 text-info-700',
  contorno: 'border border-tinta-200 bg-white text-tinta-600',
}

export function Badge({
  tom = 'neutro',
  className,
  children,
}: {
  tom?: TomBadge
  className?: string
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.7rem] font-semibold whitespace-nowrap',
        tons[tom],
        className,
      )}
    >
      {children}
    </span>
  )
}
