import { cn } from '@/lib/cn'

export function Cabecalho({
  titulo,
  descricao,
  acao,
  className,
}: {
  titulo: string
  descricao?: string
  acao?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-tinta-200 pb-5',
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="font-titulo text-2xl font-extrabold text-tinta-900">
          {titulo}
        </h1>
        {descricao && (
          <p className="mt-1 max-w-2xl text-sm text-tinta-500">{descricao}</p>
        )}
      </div>
      {acao && <div className="shrink-0">{acao}</div>}
    </div>
  )
}
