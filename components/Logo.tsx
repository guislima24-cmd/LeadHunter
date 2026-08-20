import { cn } from '@/lib/cn'

/**
 * Marca do Núcleo Comercial.
 *
 * O símbolo é um desenho próprio nas cores institucionais (verde/amarelo).
 * Para usar o logotipo oficial da UFABC Júnior, coloque o arquivo em
 * `public/logo-ufabcjr.svg` e troque o <svg> abaixo por
 * `<Image src="/logo-ufabcjr.svg" ... />` — o resto do layout não muda.
 */
export function Simbolo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      role="img"
      aria-label="UFABC Júnior"
      className={cn('size-8 shrink-0', className)}
    >
      <rect width="32" height="32" rx="8" className="fill-verde-600" />
      {/* Traço ascendente: prospecção que evolui pelo funil */}
      <path
        d="M8 20.5 13.5 15l4 4L24 12"
        fill="none"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-amarelo-400"
      />
      <circle cx="24" cy="12" r="2.75" className="fill-amarelo-400" />
    </svg>
  )
}

export function Logo({
  className,
  emFundoEscuro = false,
  compacto = false,
}: {
  className?: string
  emFundoEscuro?: boolean
  compacto?: boolean
}) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <Simbolo />
      {!compacto && (
        <span className="flex min-w-0 flex-col leading-none">
          <span
            className={cn(
              'font-titulo text-sm font-extrabold tracking-tight',
              emFundoEscuro ? 'text-white' : 'text-tinta-900',
            )}
          >
            Núcleo Comercial
          </span>
          <span
            className={cn(
              'mt-1 text-[0.7rem] font-medium',
              emFundoEscuro ? 'text-tinta-400' : 'text-tinta-500',
            )}
          >
            UFABC Júnior
          </span>
        </span>
      )}
    </span>
  )
}
