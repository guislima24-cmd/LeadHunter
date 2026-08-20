import { cn } from '@/lib/cn'

export function Metrica({
  rotulo,
  valor,
  apoio,
  destaque = false,
  className,
}: {
  rotulo: string
  valor: React.ReactNode
  apoio?: React.ReactNode
  destaque?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-cartao border bg-white p-4 shadow-cartao',
        destaque ? 'border-verde-200 bg-verde-50/40' : 'border-tinta-200',
        className,
      )}
    >
      <p className="text-[0.7rem] font-semibold tracking-wide text-tinta-500 uppercase">
        {rotulo}
      </p>
      <p
        className={cn(
          'numerico mt-1.5 font-titulo text-2xl font-extrabold',
          destaque ? 'text-verde-700' : 'text-tinta-900',
        )}
      >
        {valor}
      </p>
      {apoio && <div className="mt-1 text-xs text-tinta-500">{apoio}</div>}
    </div>
  )
}

/** Barra de progresso — usada em orçamento e cota. */
export function Barra({
  percentual,
  tom = 'verde',
}: {
  percentual: number
  tom?: 'verde' | 'amarelo' | 'perigo'
}) {
  const largura = Math.max(0, Math.min(100, percentual))
  const cores = {
    verde: 'bg-verde-500',
    amarelo: 'bg-amarelo-400',
    perigo: 'bg-perigo-500',
  }
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-tinta-200">
      <div
        className={cn('h-full rounded-full transition-[width] duration-500', cores[tom])}
        style={{ width: `${largura}%` }}
      />
    </div>
  )
}
