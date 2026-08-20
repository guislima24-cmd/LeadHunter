import { Cabecalho } from '@/components/layout/Cabecalho'
import { Card, CardCabecalho } from '@/components/ui/Card'
import { exigirMembro } from '@/lib/sessao'
import { PLANILHA_URL, ORCAMENTO_MAPS_USD, ALERTA_MAPS_USD } from '@/lib/constantes'
import { formatarDolar } from '@/lib/formato'
import { FormularioMaps } from './FormularioMaps'

export const metadata = { title: 'Google Maps' }

export default async function PaginaMaps() {
  const membro = await exigirMembro()

  return (
    <>
      <Cabecalho
        titulo="Prospecção no Google Maps"
        descricao="Encontre negócios locais por setor e cidade. A IA analisa cada empresa e o resultado cai direto na planilha."
      />

      <FormularioMaps habilitado={Boolean(membro.abaPlanilha)} />

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardCabecalho titulo="Como funciona" />
          <ol className="space-y-3 p-5 text-sm leading-relaxed text-tinta-600">
            {[
              'A busca continua de onde parou: cada combinação de setor + cidade guarda a última página consultada, então rodar de novo traz empresas novas em vez de repetir as mesmas.',
              'Empresas que já estão na planilha são descartadas antes de gastar chamada de API.',
              'Com a IA ligada, cada empresa ganha potencial, dores típicas, serviços sugeridos, melhor canal e um argumento de abertura.',
              'Tudo é gravado na aba “Leads Maps”, no seu nome.',
            ].map((texto, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-verde-50 text-[0.7rem] font-bold text-verde-700">
                  {i + 1}
                </span>
                <span>{texto}</span>
              </li>
            ))}
          </ol>
        </Card>

        <Card>
          <CardCabecalho
            titulo="Controle de custo"
            descricao="O Google Places é pago por chamada."
          />
          <div className="space-y-3 p-5 text-sm leading-relaxed text-tinta-600">
            <p>
              O workflow soma o gasto do mês antes de cada cidade e{' '}
              <strong className="font-semibold text-tinta-800">
                trava em {formatarDolar(ORCAMENTO_MAPS_USD)}
              </strong>
              , avisando a partir de {formatarDolar(ALERTA_MAPS_USD)}. Cidades
              que não couberem no orçamento são puladas — nunca há estouro
              silencioso.
            </p>
            <p className="text-xs text-tinta-500">
              O extrato de custo vive na aba <em>Maps Usage</em> da planilha,
              que é a fonte da verdade. Esta tela mostra o que o workflow
              devolve ao terminar cada busca.
            </p>
            <a
              href={PLANILHA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-sm font-semibold text-verde-700 hover:underline"
            >
              Abrir a planilha →
            </a>
          </div>
        </Card>
      </div>
    </>
  )
}
