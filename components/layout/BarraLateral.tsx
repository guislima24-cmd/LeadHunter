'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Logo } from '@/components/Logo'
import { NAVEGACAO, type ItemNavegacao } from '@/lib/navegacao'
import { cn } from '@/lib/cn'
import type { Membro } from '@/lib/sessao'

function estaAtivo(href: string, caminho: string) {
  return href === '/' ? caminho === '/' : caminho.startsWith(href)
}

function Itens({
  itens,
  caminho,
  aoNavegar,
}: {
  itens: ItemNavegacao[]
  caminho: string
  aoNavegar?: () => void
}) {
  return (
    <nav className="flex flex-col gap-0.5">
      {itens.map((item) => {
        const ativo = estaAtivo(item.href, caminho)
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={aoNavegar}
            aria-current={ativo ? 'page' : undefined}
            className={cn(
              'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors',
              ativo
                ? 'bg-white/10 text-white'
                : 'text-tinta-400 hover:bg-white/5 hover:text-white',
            )}
          >
            {ativo && (
              <span
                aria-hidden="true"
                className="absolute top-1/2 left-0 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-amarelo-400"
              />
            )}
            <span className={cn(ativo ? 'text-amarelo-400' : 'text-tinta-500 group-hover:text-tinta-300')}>
              {item.icone}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{item.rotulo}</span>
              <span className="block truncate text-[0.7rem] text-tinta-500">
                {item.descricao}
              </span>
            </span>
          </Link>
        )
      })}
    </nav>
  )
}

function CartaoMembro({ membro }: { membro: Membro }) {
  const iniciais = membro.nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')

  return (
    <div className="border-t border-white/10 p-3">
      <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-verde-600 text-xs font-bold text-white">
          {iniciais || '?'}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-white">
            {membro.nome}
          </span>
          <span className="block truncate text-[0.7rem] text-tinta-500">
            {membro.abaPlanilha ? `Aba: ${membro.abaPlanilha}` : 'Aba não vinculada'}
          </span>
        </span>
      </div>
      <form action="/auth/sair" method="post">
        <button
          type="submit"
          className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-tinta-400 transition-colors hover:bg-white/5 hover:text-white"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="size-4">
            <path d="M15 17v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v2" />
            <path d="M19 12H9m10 0-3-3m3 3-3 3" />
          </svg>
          Sair
        </button>
      </form>
    </div>
  )
}

export function BarraLateral({ membro }: { membro: Membro }) {
  const caminho = usePathname()
  const [aberta, setAberta] = useState(false)

  const itens = NAVEGACAO.filter(
    (item) => !item.somenteAdmin || membro.papel === 'admin',
  )

  const conteudo = (
    <>
      <div className="p-5">
        <Link href="/" aria-label="Ir para o início">
          <Logo emFundoEscuro />
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto rolagem-fina px-3">
        <Itens itens={itens} caminho={caminho} aoNavegar={() => setAberta(false)} />
      </div>
      <CartaoMembro membro={membro} />
    </>
  )

  return (
    <>
      {/* Topo do celular */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-tinta-200 bg-white px-4 lg:hidden">
        <Link href="/" aria-label="Ir para o início">
          <Logo compacto />
        </Link>
        <button
          type="button"
          onClick={() => setAberta(true)}
          aria-label="Abrir menu"
          aria-expanded={aberta}
          className="rounded-lg p-2 text-tinta-600 transition-colors hover:bg-tinta-100"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="size-5">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
      </header>

      {/* Gaveta do celular */}
      {aberta && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={() => setAberta(false)}
            className="absolute inset-0 bg-tinta-950/50"
          />
          <div className="relative flex h-full w-72 max-w-[85vw] flex-col bg-tinta-950">
            {conteudo}
          </div>
        </div>
      )}

      {/* Barra fixa no desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-tinta-950 lg:flex">
        {conteudo}
      </aside>
    </>
  )
}
