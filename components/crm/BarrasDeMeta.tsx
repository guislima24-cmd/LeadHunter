import { COR } from '@/lib/cores-grafico'
import { formatarData, formatarNumero, formatarReais } from '@/lib/formato'
import { ROTULO_METRICA, type MetaComProgresso } from '@/lib/tipos-insights'
import { cn } from '@/lib/cn'

/**
 * Progresso das metas, com a régua do tempo por cima.
 *
 * A barra sozinha mente por omissão: 60% do alvo é ótimo no dia 10 e ruim no
 * dia 28. Por isso cada barra carrega um marcador de onde a meta *deveria*
 * estar pelo tempo já decorrido — é a comparação entre os dois que diz se
 * está no ritmo.
 *
 * A cor nunca informa sozinha: o estado vai escrito ao lado ("No ritmo",
 * "Atenção", "Atrasada"), junto do número. O amarelo do estado "Atenção" não
 * alcança 3:1 de contraste com o fundo — passa exatamente porque o texto
 * está ali.
 */

const ESTADO: Record<
  MetaComProgresso['estado'],
  { rotulo: string; cor: string; classe: string }
> = {
  concluida: {
    rotulo: 'Alcançada',
    cor: COR.meta.noRitmo,
    classe: 'bg-verde-50 text-verde-700',
  },
  no_ritmo: {
    rotulo: 'No ritmo',
    cor: COR.meta.noRitmo,
    classe: 'bg-verde-50 text-verde-700',
  },
  atencao: {
    rotulo: 'Atenção',
    cor: COR.meta.atencao,
    classe: 'bg-amarelo-50 text-amarelo-700',
  },
  atrasada: {
    rotulo: 'Atrasada',
    cor: COR.meta.atrasada,
    classe: 'bg-perigo-50 text-perigo-700',
  },
}

function formatarValor(valor: number, meta: MetaComProgresso) {
  if (meta.metricaFonte === 'faturamento_ganho') return formatarReais(valor)
  const n = formatarNumero(valor)
  return meta.unidade ? `${n} ${meta.unidade}` : n
}

function UmaMeta({
  meta,
  aninhada = false,
}: {
  meta: MetaComProgresso
  aninhada?: boolean
}) {
  const estado = ESTADO[meta.estado]

  return (
    <div className={cn(aninhada && 'border-l-2 border-tinta-100 pl-4')}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-tinta-900">{meta.nome}</p>
          <p className="text-xs text-tinta-500">
            {ROTULO_METRICA[meta.metricaFonte]} ·{' '}
            {formatarData(meta.periodoInicio)} a {formatarData(meta.periodoFim)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[0.7rem] font-semibold',
              estado.classe,
            )}
          >
            {estado.rotulo}
          </span>
          <span className="numerico text-sm font-bold text-tinta-900">
            {meta.percentualReal}%
          </span>
        </div>
      </div>

      <div className="relative mt-2 h-2.5 w-full overflow-hidden rounded-full bg-tinta-100">
        <div
          className="h-full rounded-full"
          style={{
            width: `${meta.percentual}%`,
            backgroundColor: estado.cor,
          }}
        />
        {/* A régua do tempo, desenhada por cima da barra preenchida.
            O anel branco existe porque o marcador cai ora sobre o trilho
            claro, ora sobre o preenchimento colorido — uma linha escura
            sozinha some no primeiro caso, e uma clara some no segundo. */}
        {meta.percentualEsperado != null &&
          meta.percentualEsperado > 0 &&
          meta.percentualEsperado < 100 && (
            <span
              aria-hidden="true"
              title="Onde a meta estaria se o progresso acompanhasse o tempo"
              className="absolute top-0 bottom-0 w-1 rounded-full bg-tinta-800 ring-1 ring-white"
              style={{ left: `${meta.percentualEsperado}%` }}
            />
          )}
      </div>

      <p className="numerico mt-1.5 text-xs text-tinta-500">
        {formatarValor(meta.valorAtual, meta)} de{' '}
        {formatarValor(meta.valorAlvo, meta)}
        {meta.percentualEsperado != null && (
          <>
            {' '}
            · a régua do tempo marca {meta.percentualEsperado}% do período
            decorrido
          </>
        )}
      </p>

      {meta.descricao && (
        <p className="mt-1 text-xs leading-relaxed text-tinta-500">
          {meta.descricao}
        </p>
      )}

      {meta.filhas.length > 0 && (
        <div className="mt-4 space-y-4">
          {meta.filhas.map((filha) => (
            <UmaMeta key={filha.id} meta={filha} aninhada />
          ))}
        </div>
      )}
    </div>
  )
}

export function BarrasDeMeta({ metas }: { metas: MetaComProgresso[] }) {
  if (metas.length === 0) {
    return (
      <p className="px-5 py-8 text-center text-sm text-tinta-500">
        Nenhuma meta cadastrada para este período.
      </p>
    )
  }

  return (
    <div className="space-y-5 p-5">
      {metas.map((meta) => (
        <UmaMeta key={meta.id} meta={meta} />
      ))}
    </div>
  )
}
