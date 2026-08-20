import { cn } from '@/lib/cn'
import { Spinner } from './Spinner'

export function EstadoVazio({
  icone,
  titulo,
  descricao,
  acao,
  className,
}: {
  icone?: React.ReactNode
  titulo: string
  descricao?: string
  acao?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('px-6 py-16 text-center', className)}>
      {icone && (
        <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-full bg-tinta-100 text-tinta-400">
          {icone}
        </div>
      )}
      <p className="font-titulo text-sm font-bold text-tinta-800">{titulo}</p>
      {descricao && (
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-tinta-500">{descricao}</p>
      )}
      {acao && <div className="mt-5">{acao}</div>}
    </div>
  )
}

export function EstadoCarregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <div className="flex items-center justify-center gap-2.5 px-6 py-16 text-tinta-500">
      <Spinner className="size-4 text-verde-600" />
      <span className="text-sm">{texto}</span>
    </div>
  )
}

export function EstadoErro({
  titulo = 'Algo deu errado',
  descricao,
  acao,
}: {
  titulo?: string
  descricao?: string
  acao?: React.ReactNode
}) {
  return (
    <div className="px-6 py-14 text-center">
      <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-full bg-perigo-50 text-perigo-600">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5">
          <path d="M12 9v4M12 17h.01" strokeLinecap="round" />
          <circle cx="12" cy="12" r="9" />
        </svg>
      </div>
      <p className="font-titulo text-sm font-bold text-tinta-800">{titulo}</p>
      {descricao && (
        <p className="mx-auto mt-1.5 max-w-md text-sm text-tinta-500">{descricao}</p>
      )}
      {acao && <div className="mt-5">{acao}</div>}
    </div>
  )
}
