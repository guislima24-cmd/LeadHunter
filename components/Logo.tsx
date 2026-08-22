/* eslint-disable @next/next/no-img-element -- o símbolo é um SVG estático de
   menos de 1 KB: o next/image não tem o que otimizar nele, e passaria a exigir
   width/height fixos justo onde as telas variam o tamanho por classe. */
import { cn } from '@/lib/cn'

/**
 * Marca do Núcleo Comercial.
 *
 * O símbolo vem de `public/logo-ufabcjr.svg` em vez de estar embutido aqui:
 * trocar o arquivo troca a marca em todo lugar que a usa (barra lateral,
 * login, tela de erro, favicon em `app/icon.svg`) sem mexer em componente
 * nenhum. O SVG tem `viewBox` quadrada com o triângulo centralizado, então
 * as classes `size-*` continuam valendo como valiam no desenho anterior.
 */
export function Simbolo({ className }: { className?: string }) {
  return (
    <img
      src="/logo-ufabcjr.svg"
      alt=""
      aria-hidden="true"
      className={cn('size-8 shrink-0', className)}
    />
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

/**
 * Símbolo gigante e apagado no fundo de uma seção — a marca d'água do login.
 *
 * Fica em `aria-hidden` e `pointer-events-none`: é textura, não conteúdo, e
 * não pode interceptar clique de nada que esteja por cima.
 */
export function MarcaDagua({ className }: { className?: string }) {
  return (
    <img
      src="/logo-ufabcjr.svg"
      alt=""
      aria-hidden="true"
      className={cn('pointer-events-none absolute select-none', className)}
    />
  )
}
