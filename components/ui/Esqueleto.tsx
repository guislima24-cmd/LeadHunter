import { cn } from '@/lib/cn'

/**
 * O que aparece enquanto uma página do servidor está sendo montada.
 *
 * Existe por um motivo bem específico. No App Router, navegar para uma página
 * dinâmica não muda **nada** na tela até o servidor responder: a página antiga
 * fica congelada, sem spinner, sem barra, sem cursor de espera. Para quem
 * clicou, é indistinguível de um clique que não pegou — então a pessoa clica
 * de novo. E de novo.
 *
 * Um `loading.tsx` resolve os dois lados disso de uma vez:
 *
 *  1. **Resposta imediata.** O React troca o conteúdo pelo esqueleto no mesmo
 *     quadro do clique. O feedback deixa de depender da rede.
 *  2. **Prefetch.** O `<Link>` do Next só consegue pré-carregar rota dinâmica
 *     até a fronteira de `loading`. Sem esse arquivo não há fronteira, e não
 *     há prefetch nenhum — com ele, o passar do mouse já adianta o trabalho.
 *
 * O desenho imita a página que vem depois (cabeçalho, faixa de métricas,
 * bloco grande) para a troca não dar um salto de layout.
 */

export function Bloco({ className }: { className?: string }) {
  return (
    <div
      className={cn('pulsar rounded-lg bg-tinta-200/70', className)}
      aria-hidden="true"
    />
  )
}

export function EsqueletoCabecalho() {
  return (
    <div className="mb-6 border-b border-tinta-200 pb-4">
      <Bloco className="h-7 w-56" />
      <Bloco className="mt-2.5 h-4 w-96 max-w-full" />
    </div>
  )
}

export function EsqueletoMetricas({ quantas = 4 }: { quantas?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: quantas }, (_, i) => (
        <div
          key={i}
          className="rounded-cartao border border-tinta-200 bg-white p-4"
        >
          <Bloco className="h-3 w-24" />
          <Bloco className="mt-3 h-7 w-20" />
          <Bloco className="mt-3 h-3 w-32" />
        </div>
      ))}
    </div>
  )
}

export function EsqueletoCartao({ altura = 'h-72' }: { altura?: string }) {
  return (
    <div className="rounded-cartao border border-tinta-200 bg-white">
      <div className="border-b border-tinta-100 px-5 py-4">
        <Bloco className="h-4 w-40" />
        <Bloco className="mt-2 h-3 w-64 max-w-full" />
      </div>
      <div className={cn('p-5', altura)}>
        <Bloco className="h-full w-full" />
      </div>
    </div>
  )
}

export function EsqueletoTabela({ linhas = 6 }: { linhas?: number }) {
  return (
    <div className="rounded-cartao border border-tinta-200 bg-white">
      <div className="border-b border-tinta-100 px-5 py-4">
        <Bloco className="h-4 w-40" />
      </div>
      <div className="divide-y divide-tinta-100">
        {Array.from({ length: linhas }, (_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-3.5">
            <Bloco className="h-4 flex-1" />
            <Bloco className="h-4 w-28 shrink-0" />
            <Bloco className="h-4 w-20 shrink-0" />
            <Bloco className="h-4 w-16 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Faixa de abas — mantém o lugar das subabas enquanto a página carrega. */
export function EsqueletoAbas({ quantas = 5 }: { quantas?: number }) {
  return (
    <div className="mb-5 flex gap-4 border-b border-tinta-200 pb-3">
      {Array.from({ length: quantas }, (_, i) => (
        <Bloco key={i} className="h-4 w-20" />
      ))}
    </div>
  )
}
