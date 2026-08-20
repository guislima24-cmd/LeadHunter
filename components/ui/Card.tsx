import { cn } from '@/lib/cn'

export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn(
        'rounded-cartao border border-tinta-200 bg-white shadow-cartao',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function CardCabecalho({
  titulo,
  descricao,
  acao,
  className,
}: {
  titulo: React.ReactNode
  descricao?: React.ReactNode
  acao?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-start justify-between gap-3 border-b border-tinta-200 px-5 py-4',
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="text-sm font-bold text-tinta-900">{titulo}</h2>
        {descricao && (
          <p className="mt-0.5 text-xs text-tinta-500">{descricao}</p>
        )}
      </div>
      {acao && <div className="shrink-0">{acao}</div>}
    </div>
  )
}

export function CardCorpo({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return <div className={cn('p-5', className)}>{children}</div>
}
