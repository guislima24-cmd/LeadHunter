'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Logo, Simbolo } from '@/components/Logo'
import {
  NAVEGACAO,
  caiEmRota,
  subitemAtivo,
  type ItemNavegacao,
} from '@/lib/navegacao'
import { cn } from '@/lib/cn'
import type { Membro } from '@/lib/sessao'

function iniciaisDe(nome: string) {
  return nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
}

function Itens({
  itens,
  caminho,
  recolhida,
  ehAdmin,
  aoNavegar,
}: {
  itens: ItemNavegacao[]
  caminho: string
  recolhida: boolean
  ehAdmin: boolean
  aoNavegar?: () => void
}) {
  return (
    <nav className="flex flex-col gap-0.5">
      {itens.map((item) => {
        const ativo = caiEmRota(item.href, caminho)
        const subitens = (item.subitens ?? []).filter(
          (sub) => !sub.somenteAdmin || ehAdmin,
        )
        // As subabas só aparecem sob o grupo em que se está. Deixar todas
        // abertas o tempo todo transformaria a barra numa lista de dezesseis
        // links, que é exatamente a lista plana que esta mudança desfez.
        const mostrarSubitens = !recolhida && ativo && subitens.length > 0
        const subAtiva = mostrarSubitens ? subitemAtivo(subitens, caminho) : null

        return (
          <div key={item.href}>
            <Link
              href={item.href}
              onClick={aoNavegar}
              aria-current={ativo && subitens.length === 0 ? 'page' : undefined}
              // Recolhida, o rótulo some da tela mas continua no `title`: é a
              // única pista que sobra de qual ícone é qual.
              title={recolhida ? `${item.rotulo} — ${item.descricao}` : undefined}
              className={cn(
                'group relative flex items-center gap-3 rounded-lg py-2.5 transition-colors',
                recolhida ? 'justify-center px-0' : 'px-3',
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
              <span
                className={cn(
                  ativo ? 'text-amarelo-400' : 'text-tinta-500 group-hover:text-tinta-300',
                )}
              >
                {item.icone}
              </span>
              {!recolhida && (
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{item.rotulo}</span>
                  <span className="block truncate text-[0.7rem] text-tinta-500">
                    {item.descricao}
                  </span>
                </span>
              )}
            </Link>

            {mostrarSubitens && (
              <div className="relative mt-0.5 mb-1 ml-[1.6rem] flex flex-col gap-px border-l border-white/10 pl-3">
                {subitens.map((sub) => {
                  const subEhAtiva = sub.href === subAtiva
                  return (
                    <Link
                      key={sub.href}
                      href={sub.href}
                      onClick={aoNavegar}
                      aria-current={subEhAtiva ? 'page' : undefined}
                      className={cn(
                        'rounded-md px-2.5 py-1.5 text-[0.8rem] font-medium transition-colors',
                        subEhAtiva
                          ? 'bg-white/10 font-semibold text-white'
                          : 'text-tinta-400 hover:bg-white/5 hover:text-white',
                      )}
                    >
                      {sub.rotulo}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </nav>
  )
}

function CartaoMembro({
  membro,
  recolhida,
}: {
  membro: Membro
  recolhida: boolean
}) {
  const iniciais = iniciaisDe(membro.nome)

  return (
    <div className="border-t border-white/10 p-3">
      <div
        className={cn(
          'flex items-center gap-2.5 rounded-lg py-2',
          recolhida ? 'justify-center px-0' : 'px-2',
        )}
        title={recolhida ? membro.nome : undefined}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-verde-600 text-xs font-bold text-white">
          {iniciais || '?'}
        </span>
        {!recolhida && (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-white">
              {membro.nome}
            </span>
            <span className="block truncate text-[0.7rem] text-tinta-500">
              {membro.abaPlanilha ? `Aba: ${membro.abaPlanilha}` : 'Aba não vinculada'}
            </span>
          </span>
        )}
      </div>
      <form action="/auth/sair" method="post">
        <button
          type="submit"
          title={recolhida ? 'Sair' : undefined}
          className={cn(
            'mt-1 flex w-full items-center gap-2.5 rounded-lg py-2 text-xs font-semibold text-tinta-400 transition-colors hover:bg-white/5 hover:text-white',
            recolhida ? 'justify-center px-0' : 'px-3',
          )}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="size-4 shrink-0">
            <path d="M15 17v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v2" />
            <path d="M19 12H9m10 0-3-3m3 3-3 3" />
          </svg>
          {!recolhida && 'Sair'}
        </button>
      </form>
    </div>
  )
}

function IconeMenu({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  )
}

export function BarraLateral({
  membro,
  recolhida,
  aoAlternar,
}: {
  membro: Membro
  recolhida: boolean
  aoAlternar: () => void
}) {
  const caminho = usePathname()
  const [gavetaAberta, setGavetaAberta] = useState(false)

  const itens = NAVEGACAO.filter(
    (item) => !item.somenteAdmin || membro.papel === 'admin',
  )

  /** `estreita` só vale no desktop — a gaveta do celular abre sempre inteira. */
  function conteudo(estreita: boolean, aoNavegar?: () => void) {
    return (
      <>
        <div
          className={cn(
            'flex items-center gap-2 p-5',
            estreita ? 'flex-col' : 'justify-between',
          )}
        >
          <Link href="/" aria-label="Ir para o início">
            {estreita ? <Simbolo /> : <Logo emFundoEscuro />}
          </Link>
          <button
            type="button"
            onClick={aoAlternar}
            aria-expanded={!estreita}
            aria-label={estreita ? 'Expandir menu' : 'Recolher menu'}
            title={estreita ? 'Expandir menu' : 'Recolher menu'}
            className="hidden shrink-0 rounded-lg p-2 text-tinta-400 transition-colors hover:bg-white/10 hover:text-white lg:block"
          >
            <IconeMenu className="size-5" />
          </button>
        </div>
        <div className="rolagem-fina flex-1 overflow-x-hidden overflow-y-auto px-3">
          <Itens
            itens={itens}
            caminho={caminho}
            recolhida={estreita}
            ehAdmin={membro.papel === 'admin'}
            aoNavegar={aoNavegar}
          />
        </div>
        <CartaoMembro membro={membro} recolhida={estreita} />
      </>
    )
  }

  return (
    <>
      {/* Topo do celular */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-tinta-200 bg-white px-4 lg:hidden">
        <Link href="/" aria-label="Ir para o início">
          <Logo compacto />
        </Link>
        <button
          type="button"
          onClick={() => setGavetaAberta(true)}
          aria-label="Abrir menu"
          aria-expanded={gavetaAberta}
          className="rounded-lg p-2 text-tinta-600 transition-colors hover:bg-tinta-100"
        >
          <IconeMenu className="size-5" />
        </button>
      </header>

      {/* Gaveta do celular */}
      {gavetaAberta && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={() => setGavetaAberta(false)}
            className="absolute inset-0 bg-tinta-950/50"
          />
          <div className="relative flex h-full w-72 max-w-[85vw] flex-col bg-tinta-950">
            {conteudo(false, () => setGavetaAberta(false))}
          </div>
        </div>
      )}

      {/* Barra fixa no desktop */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden flex-col overflow-hidden bg-tinta-950 transition-[width] duration-200 ease-out lg:flex',
          recolhida ? 'w-16' : 'w-64',
        )}
      >
        {conteudo(recolhida)}
      </aside>
    </>
  )
}
