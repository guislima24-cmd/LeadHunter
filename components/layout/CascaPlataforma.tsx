'use client'
import { useState } from 'react'
import { BarraLateral } from '@/components/layout/BarraLateral'
import { cn } from '@/lib/cn'
import { COOKIE_BARRA } from '@/lib/barra'
import type { Membro } from '@/lib/sessao'

/**
 * Casca da plataforma: a barra lateral e o espaço que ela reserva ao lado.
 *
 * Existe como componente de cliente porque recolher a barra muda duas coisas
 * ao mesmo tempo — a largura dela e o recuo do conteúdo — e as duas precisam
 * animar juntas. O estado inicial vem do servidor (cookie lido no layout), não
 * do `localStorage`: assim a barra já nasce na largura certa, em vez de abrir
 * larga e pular para estreita depois que o JavaScript roda.
 */
export function CascaPlataforma({
  membro,
  recolhidaInicial,
  children,
}: {
  membro: Membro
  recolhidaInicial: boolean
  children: React.ReactNode
}) {
  const [recolhida, setRecolhida] = useState(recolhidaInicial)

  function alternar() {
    const proxima = !recolhida
    setRecolhida(proxima)
    // Um ano: é preferência de layout, não sessão.
    document.cookie = `${COOKIE_BARRA}=${proxima ? 'recolhida' : 'aberta'}; path=/; max-age=31536000; samesite=lax`
  }

  return (
    <div className="min-h-screen bg-tinta-50">
      <BarraLateral
        membro={membro}
        recolhida={recolhida}
        aoAlternar={alternar}
      />
      <div
        className={cn(
          'transition-[padding] duration-200 ease-out',
          recolhida ? 'lg:pl-16' : 'lg:pl-64',
        )}
      >
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  )
}
