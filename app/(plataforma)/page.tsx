import Link from 'next/link'
import { Cabecalho } from '@/components/layout/Cabecalho'
import { Card, CardCabecalho } from '@/components/ui/Card'
import { Metrica, Barra } from '@/components/ui/Metrica'
import { Badge } from '@/components/ui/Badge'
import { EstadoVazio } from '@/components/ui/Estado'
import { Tabela, Th, Td, Tr } from '@/components/ui/Tabela'
import { QuadroNegocios } from '@/components/crm/QuadroNegocios'
import { NovoNegocio } from '@/components/crm/NovoNegocio'
import { exigirMembro } from '@/lib/sessao'
import { obterResumoInicio, obterFunilDoMembro } from '@/lib/dados'
import {
  obterQuadroDeNegocios,
  listarMotivosPerda,
  listarOrganizacoes,
  listarProdutosServicos,
} from '@/lib/crm'
import {
  formatarNumero,
  formatarPercentual,
  formatarReais,
  tempoRelativo,
} from '@/lib/formato'

export const metadata = { title: 'Início' }

const ATALHOS = [
  {
    href: '/buscar',
    titulo: 'Buscar leads',
    texto: 'Filtre a base da Receita Federal e gere uma lista já sem duplicados.',
  },
  {
    href: '/maps',
    titulo: 'Prospectar no Maps',
    texto: 'Encontre negócios locais por setor e cidade, com análise da IA.',
  },
  {
    href: '/listas',
    titulo: 'Minhas listas',
    texto: 'Enriqueça, dispare a prospecção e promova leads a negócio.',
  },
]

/**
 * Início da plataforma: o quadro de negócios primeiro, o resto depois.
 *
 * O funil é o que responde "como estamos agora"; volume de leads, listas e
 * enriquecimento são o que alimenta o funil, e por isso passaram a viver
 * abaixo dele em vez de disputar o topo da tela. `/pipeline` continua
 * existindo, mas só redireciona para cá — o quadro não tem mais aba própria.
 */
export default async function PaginaInicio() {
  const membro = await exigirMembro()

  const [resumo, quadro, motivosPerda, organizacoes, produtos, funilLeads] =
    await Promise.all([
      obterResumoInicio(membro.abaPlanilha),
      obterQuadroDeNegocios(),
      listarMotivosPerda(),
      listarOrganizacoes(),
      listarProdutosServicos(),
      obterFunilDoMembro(membro.abaPlanilha),
    ])

  const primeiroNome = membro.nome.split(' ')[0] || membro.nome
  const topoLeads = funilLeads[0]?.quantidade ?? 0

  return (
    <>
      <Cabecalho
        titulo={`Olá, ${primeiroNome}`}
        descricao="O funil do time, em primeiro plano. Cada cartão é uma oportunidade real sendo trabalhada."
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
              acao={
                <NovoNegocio organizacoes={organizacoes} produtos={produtos} />
              }
            />
            <EstadoVazio
              titulo="Nenhum negócio no funil ainda"
              descricao="Um negócio nasce quando alguém decide trabalhar uma oportunidade de verdade — nenhuma automação cria isso sozinha. Crie um à mão, ou abra uma das suas listas e use “Iniciar negócio” em um lead já enriquecido."
              acao={
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <NovoNegocio
                    organizacoes={organizacoes}
                    produtos={produtos}
                  />
                  <Link
                    href="/listas"
                    className="inline-flex h-8 items-center rounded-md border border-tinta-200 bg-white px-3 text-xs font-semibold text-tinta-800 transition-colors hover:bg-tinta-50"
                  >
                    Ir para minhas listas
                  </Link>
                </div>
              }
            />
          </Card>
        ) : (
          <QuadroNegocios
            colunas={quadro.colunas}
            motivosPerda={motivosPerda}
            emailDoMembro={membro.email}
            organizacoes={organizacoes}
            produtos={produtos}
          />
        )}
      </div>

      <section className="mt-10">
        <div className="mb-4 border-b border-tinta-200 pb-3">
          <h2 className="font-titulo text-lg font-extrabold text-tinta-900">
            A operação por trás do funil
          </h2>
          <p className="mt-0.5 text-sm text-tinta-500">
            O volume bruto que a plataforma movimenta — é daqui que saem os
            negócios acima.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metrica
            rotulo="Leads na base"
            valor={formatarNumero(resumo.leadsNaBase)}
            apoio="Receita Federal, atualizada"
          />
          <Metrica
            rotulo="Minhas listas"
            valor={formatarNumero(resumo.minhasListas)}
            apoio={`${formatarNumero(resumo.leadsNasListas)} leads nas 5 últimas`}
          />
          <Metrica
            rotulo="Emails enviados"
            valor={formatarNumero(resumo.emailsEnviados)}
            apoio="Prospecção por email, no seu nome"
          />
          <Metrica
            rotulo="Reservas ativas"
            valor={formatarNumero(resumo.reservasAtivas)}
            apoio="Leads travados para você por 24 h"
          />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardCabecalho
              titulo="Últimas listas geradas"
              descricao="As cinco mais recentes criadas por você."
              acao={
                <Link
                  href="/listas"
                  className="text-xs font-semibold text-verde-700 hover:text-verde-800 hover:underline"
                >
                  Ver todas
                </Link>
              }
            />
            {resumo.ultimasListas.length === 0 ? (
              <EstadoVazio
                titulo="Nenhuma lista ainda"
                descricao="Gere sua primeira lista na busca — os leads ficam reservados no seu nome por 24 horas."
                acao={
                  <Link
                    href="/buscar"
                    className="inline-flex h-9 items-center rounded-lg bg-verde-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-verde-700"
                  >
                    Buscar leads
                  </Link>
                }
              />
            ) : (
              <Tabela>
                <thead>
                  <tr>
                    <Th>Setor</Th>
                    <Th>Cidade</Th>
                    <Th className="text-right">Leads</Th>
                    <Th>Criada</Th>
                  </tr>
                </thead>
                <tbody>
                  {resumo.ultimasListas.map((lista) => (
                    <Tr key={lista.id}>
                      <Td>
                        <Link
                          href={`/listas/${lista.id}`}
                          className="font-semibold text-tinta-900 hover:text-verde-700 hover:underline"
                        >
                          {lista.setor || 'Sem setor'}
                        </Link>
                      </Td>
                      <Td className="text-tinta-600">{lista.cidade || '—'}</Td>
                      <Td className="numerico text-right font-semibold">
                        {formatarNumero(lista.quantidadeLeads)}
                      </Td>
                      <Td className="text-tinta-500">
                        {tempoRelativo(lista.criadaEm)}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Tabela>
            )}
          </Card>

          <div className="space-y-6">
            <Card>
              <CardCabecalho
                titulo="Enriquecimento com IA"
                descricao="Status do W2 na base inteira."
              />
              <div className="space-y-3 p-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-tinta-600">Concluídos</span>
                  <Badge tom="verde">{formatarNumero(resumo.enriquecidos)}</Badge>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-tinta-600">Aguardando cota</span>
                  <Badge
                    tom={resumo.pendentesEnriquecimento > 0 ? 'amarelo' : 'neutro'}
                  >
                    {formatarNumero(resumo.pendentesEnriquecimento)}
                  </Badge>
                </div>
                <p className="border-t border-tinta-100 pt-3 text-xs leading-relaxed text-tinta-500">
                  Leads marcados como <em>aguardando cota</em> voltam a ser
                  enriquecidos assim que o limite mensal da Tavily renovar.
                </p>
              </div>
            </Card>

            <Card>
              <CardCabecalho titulo="Ir direto para" />
              <div className="divide-y divide-tinta-100">
                {ATALHOS.map((atalho) => (
                  <Link
                    key={atalho.href}
                    href={atalho.href}
                    className="group flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-tinta-50"
                  >
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-amarelo-400" />
                    <span>
                      <span className="block text-sm font-semibold text-tinta-900 group-hover:text-verde-700">
                        {atalho.titulo}
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-tinta-500">
                        {atalho.texto}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </Card>
          </div>
        </div>

        <Card className="mt-6">
          <CardCabecalho
            titulo="Antes do funil: sua prospecção"
            descricao="Quanto cada etapa da automação entrega para a etapa seguinte."
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
      </section>
    </>
  )
}
