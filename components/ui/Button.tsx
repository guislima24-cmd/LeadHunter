'use client'
import { cn } from '@/lib/cn'
import { Spinner } from './Spinner'

type Variante = 'primario' | 'secundario' | 'fantasma' | 'perigo' | 'destaque'
type Tamanho = 'sm' | 'md' | 'lg'

const variantes: Record<Variante, string> = {
  primario:
    'bg-verde-600 text-white hover:bg-verde-700 active:bg-verde-800 disabled:bg-verde-600',
  destaque:
    'bg-amarelo-400 text-tinta-900 hover:bg-amarelo-500 active:bg-amarelo-600 disabled:bg-amarelo-400',
  secundario:
    'bg-white text-tinta-800 border border-tinta-200 hover:bg-tinta-50 hover:border-tinta-300 active:bg-tinta-100',
  fantasma:
    'bg-transparent text-tinta-600 hover:bg-tinta-100 hover:text-tinta-900 active:bg-tinta-200',
  perigo:
    'bg-perigo-500 text-white hover:bg-perigo-600 active:bg-perigo-700 disabled:bg-perigo-500',
}

const tamanhos: Record<Tamanho, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-md',
  md: 'h-10 px-4 text-sm gap-2 rounded-lg',
  lg: 'h-12 px-6 text-base gap-2.5 rounded-lg',
}

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante
  tamanho?: Tamanho
  carregando?: boolean
  larguraTotal?: boolean
}

export function Button({
  variante = 'primario',
  tamanho = 'md',
  carregando = false,
  larguraTotal = false,
  className,
  children,
  disabled,
  ...props
}: Props) {
  return (
    <button
      {...props}
      disabled={disabled || carregando}
      className={cn(
        'inline-flex items-center justify-center font-semibold whitespace-nowrap',
        'transition-colors duration-150',
        'disabled:cursor-not-allowed disabled:opacity-55',
        variantes[variante],
        tamanhos[tamanho],
        larguraTotal && 'w-full',
        className,
      )}
    >
      {carregando && <Spinner className="size-3.5" />}
      {children}
    </button>
  )
}
