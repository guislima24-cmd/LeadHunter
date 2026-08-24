import { COR } from '@/lib/cores-grafico'
import { formatarNumero, formatarReais } from '@/lib/formato'
import type { EtapaDoFunilVisual } from '@/lib/negocios'

/**
 * O funil desenhado como funil: cada etapa é uma faixa cuja largura é
 * proporcional à quantidade de negócios nela.
 *
 * Serve ao que o Kanban não serve. O quadro mostra *quais* negócios estão em
 * cada etapa; esta tela mostra o *formato* do funil — onde ele estrangula.
 * Um afunilamento brusco entre duas etapas é a informação, e no Kanban ela
 * fica diluída entre colunas de alturas parecidas.
 *
 * Uma cor só, para todas as faixas. Colorir cada etapa de um tom diferente
 * seria pintar por posição, não por identidade: a etapa não muda de natureza
 * por estar mais abaixo, e o olho leria as cores como categorias que não
 * existem. Quem carrega a magnitude é a largura, com o número escrito ao lado.
 *
 * Componente de servidor: é geometria sobre número pronto, sem estado nem
 * interação — não há motivo para mandar isto ao navegador como JavaScript.
 */
export function FunilVisual({ etapas }: { etapas: EtapaDoFunilVisual[] }) {
  const totalAberto = etapas.reduce((s, e) => s + e.negociosAbertos, 0)

  if (totalAberto === 0) {
    return (
      <p className="px-5 py-10 text-center text-sm text-tinta-500">
        Nenhum negócio em aberto para desenhar o funil.
      </p>
    )
  }

  return (
    <div className="p-5">
      <ol className="flex flex-col gap-2">
        {etapas.map((etapa) => (
          <li key={etapa.etapaId}>
            <div className="flex items-center gap-4">
              {/* A faixa. `min-w-0` deixa ela encolher; o rótulo à direita
                  tem largura própria e não é espremido pelo desenho. */}
              <div className="flex min-w-0 flex-1 justify-center">
                <div
                  className="h-11 rounded-md transition-[width] duration-300"
                  style={{
                    width: `${etapa.larguraPercentual}%`,
                    backgroundColor: COR.serie,
                    // Sem a largura mínima, uma etapa zerada desaparece — e
                    // "nenhum negócio aqui" é justamente o que se quer ver.
                    minWidth: etapa.negociosAbertos === 0 ? 0 : undefined,
                  }}
                  role="img"
                  aria-label={`${etapa.etapaNome}: ${formatarNumero(etapa.negociosAbertos)} negócios`}
                />
                {etapa.negociosAbertos === 0 && (
                  <div className="flex h-11 items-center">
                    <span className="text-xs text-tinta-400">vazia</span>
                  </div>
                )}
              </div>

              <div className="w-56 shrink-0">
                <p className="truncate text-sm font-semibold text-tinta-900">
                  {etapa.etapaNome}
                </p>
                <p className="numerico text-xs text-tinta-500">
                  {formatarNumero(etapa.negociosAbertos)}{' '}
                  {etapa.negociosAbertos === 1 ? 'negócio' : 'negócios'}
                  {etapa.valorTotalAberto > 0 && (
                    <> · {formatarReais(etapa.valorTotalAberto)}</>
                  )}
                </p>
              </div>
            </div>

            {/* A passagem entre uma etapa e a seguinte. Fica entre as duas
                faixas porque é da passagem que ela fala, não da etapa. */}
            {etapa.conversaoDaAnterior != null && (
              <p className="mt-1 mb-1 flex items-center gap-1.5 pl-1 text-[0.7rem] text-tinta-400">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="size-3"
                  aria-hidden="true"
                >
                  <path d="M12 5v14M6 13l6 6 6-6" />
                </svg>
                <span className="numerico">
                  {etapa.conversaoDaAnterior}% seguem da etapa anterior
                </span>
                {etapa.tempoMedioDias != null && (
                  <span className="numerico">
                    · {formatarNumero(etapa.tempoMedioDias)}{' '}
                    {etapa.tempoMedioDias === 1 ? 'dia' : 'dias'} em média aqui
                  </span>
                )}
              </p>
            )}
          </li>
        ))}
      </ol>

      <p className="mt-4 border-t border-tinta-100 pt-3 text-xs leading-relaxed text-tinta-500">
        A largura compara cada etapa com a mais cheia, não com o total — um
        negócio ocupa uma etapa só, então dividir pelo total daria faixas quase
        iguais e um funil sem formato. A porcentagem entre as faixas é a razão
        entre o que está parado numa etapa e na anterior <em>agora</em>; a
        conversão histórica de verdade fica no Painel de Insights.
      </p>
    </div>
  )
}
