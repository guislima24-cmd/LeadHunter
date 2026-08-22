import Link from 'next/link'
import { Cabecalho } from '@/components/layout/Cabecalho'
import { Card, CardCabecalho } from '@/components/ui/Card'
import { Metrica, Barra } from '@/components/ui/Metrica'
import { Badge } from '@/components/ui/Badge'
import { EstadoVazio } from '@/components/ui/Estado'
import { QuadroNegocios } from './QuadroNegocios'
import { exigirMembro } from '@/lib/sessao'
import { obterFunilDoMembro } from '@/lib/dados'
import { obterQuadroDeNegocios, listarMotivosPerda } from '@/lib/crm'
import {
  formatarNumero,
  formatarPercentual,
  formatarReais,
} from '@/lib/formato'

export const metadata = { title: 'Pipeline' }

export default async function PaginaPipeline() {
  const membro = await exigirMembro()
  const [quadro, motivosPerda, funilLeads] = await Promise.all([
    obterQuadroDeNegocios(),
    listarMotivosPerda(),
    obterFunilDoMembro(membro.abaPlanilha),
  ])

  const topoLeads = funilLeads[0]?.quantidade ?? 0

  return (
    <>
      <Cabecalho
        titulo="Pipeline"
        descricao="Os negócios que o time está trabalhando, por etapa do funil."
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metrica
          rotulo="Negócios em aberto"
          valor={formatarNumero(quadro.totalAbertos)}
          apoio="somando todas as etapas"
        />
        <Metrica
          rotulo="Valor em aberto"
          valor={formatarReais(quadro.valorTotalAberto)}
          apoio="só negócios com valor preenchido"
          destaque={quadro.valorTotalAberto > 0}
        />
        <Metrica
          rotulo="Ganhos no mês"
          valor={formatarNumero(quadro.ganhosNoMes)}
          apoio="fechados desde o dia 1º"
          destaque={quadro.ganhosNoMes > 0}
        />
        <Metrica
          rotulo="Perdidos no mês"
          valor={formatarNumero(quadro.perdidosNoMes)}
          apoio="com motivo registrado"
        />
      </section>

      <div className="mt-6">
        {quadro.totalAbertos === 0 ? (
          <Card>
            <CardCabecalho
              titulo="Funil de negócios"
              descricao="Cada cartão é uma oportunidade real sendo trabalhada."
            />
            <EstadoVazio
              titulo="Nenhum negócio no funil ainda"
              descricao="Um negócio nasce quando alguém decide trabalhar um lead de verdade — nenhuma automação cria isso sozinha. Abra uma das suas listas e use “Iniciar negócio” em um lead já enriquecido."
              acao={
                <Link
                  href="/listas"
                  className="inline-flex h-10 items-center rounded-lg bg-verde-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-verde-700"
                >
                  Ir para minhas listas
                </Link>
              }
            />
          </Card>
        ) : (
          <QuadroNegocios
            colunas={quadro.colunas}
            motivosPerda={motivosPerda}
            emailDoMembro={membro.email}
          />
        )}
      </div>

      <Card className="mt-8">
        <CardCabecalho
          titulo="Antes do funil: sua prospecção"
          descricao="Volume bruto que a plataforma movimentou — é daqui que saem os negócios."
        />

        {funilLeads.length === 0 || topoLeads === 0 ? (
          <EstadoVazio
            titulo="Sem movimento ainda"
            descricao="Assim que você gerar a primeira lista, esta parte começa a se preencher."
          />
        ) : (
          <div className="divide-y divide-tinta-100">
            {funilLeads.map((etapa, indice) => {
              const percentualDoTopo =
                topoLeads > 0 ? (etapa.quantidade / topoLeads) * 100 : 0
              const anterior = indice > 0 ? funilLeads[indice - 1] : null
              const conversao =
                anterior && anterior.quantidade > 0
                  ? (etapa.quantidade / anterior.quantidade) * 100
                  : null

              return (
                <div key={etapa.chave} className="px-5 py-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-tinta-900">
                        {etapa.rotulo}
                      </p>
                      <p className="mt-0.5 text-xs text-tinta-500">
                        {etapa.descricao}
                      </p>
                    </div>
                    <div className="flex items-baseline gap-3">
                      {conversao != null && (
                        <Badge tom={conversao >= 50 ? 'verde' : 'neutro'}>
                          {formatarPercentual(conversao)} da etapa anterior
                        </Badge>
                      )}
                      <span className="numerico font-titulo text-xl font-extrabold text-tinta-900">
                        {formatarNumero(etapa.quantidade)}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3">
                    <Barra
                      percentual={percentualDoTopo}
                      tom={
                        indice === 0
                          ? 'verde'
                          : percentualDoTopo < 20
                            ? 'amarelo'
                            : 'verde'
                      }
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </>
  )
}
