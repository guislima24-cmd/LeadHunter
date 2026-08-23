import Link from 'next/link'
import { Cabecalho } from '@/components/layout/Cabecalho'
import { Card, CardCabecalho } from '@/components/ui/Card'
import { Metrica } from '@/components/ui/Metrica'
import { EstadoVazio } from '@/components/ui/Estado'
import { Tabela, Th, Td, Tr } from '@/components/ui/Tabela'
import { QuadroNegocios } from '@/components/crm/QuadroNegocios'
import { NovoNegocio } from '@/components/crm/NovoNegocio'
import { PainelGraficos } from '@/components/crm/PainelGraficos'
import { exigirMembro } from '@/lib/sessao'
import { obterResumoInicio, obterFunilDoMembro } from '@/lib/dados'
import {
  obterQuadroDeNegocios,
  obterPainelDoFunil,
  listarMotivosPerda,
  listarOrganizacoes,
  listarProdutosServicos,
} from '@/lib/crm'
import { formatarNumero, formatarReais, tempoRelativo } from '@/lib/formato'

export const metadata = { title: 'Início' }

/**
 * Início da plataforma: o quadro de negócios primeiro, os gráficos do funil
 * logo abaixo e o volume bruto da prospecção por último.
 *
 * O funil é o que responde "como estamos agora"; leads, listas e
 * enriquecimento são o que o alimenta. `/pipeline` continua existindo, mas só
 * redireciona para cá — o quadro não tem mais aba própria.
 */
export default async function PaginaInicio() {
  const membro = await exigirMembro()

  const [resumo, quadro, painel, motivosPerda, organizacoes, produtos, funilLeads] =
    await Promise.all([
      obterResumoInicio(membro.abaPlanilha),
      obterQuadroDeNegocios(),
      obterPainelDoFunil(),
      listarMotivosPerda(),
      listarOrganizacoes(),
      listarProdutosServicos(),
      obterFunilDoMembro(membro.abaPlanilha),
    ])

  const primeiroNome = membro.nome.split(' ')[0] || membro.nome
  const houveNegocio = painel.etapasAlcancadas.some((e) => e.quantidade > 0)

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
          rotulo="Ticket médio ganho"
          valor={
            painel.ticketMedioGanhoMes == null
              ? '—'
              : formatarReais(painel.ticketMedioGanhoMes)
          }
          apoio={
            painel.ticketMedioGanhoMes == null
              ? 'nenhum ganho com valor no mês'
              : `média dos ${formatarNumero(quadro.ganhosNoMes)} fechados no mês`
          }
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

      {/* O painel aparece assim que existe histórico, mesmo sem negócio aberto
          — mês fechado inteiro em ganho/perdido ainda é o que se quer ver. */}
      {houveNegocio && (
        <section className="mt-10">
          <div className="mb-4 border-b border-tinta-200 pb-3">
            <h2 className="font-titulo text-lg font-extrabold text-tinta-900">
              O funil em números
            </h2>
            <p className="mt-0.5 text-sm text-tinta-500">
              Onde os negócios travam, quanto está em jogo em cada etapa e o que
              vem antes deles.
            </p>
          </div>

          <PainelGraficos
            etapasAlcancadas={painel.etapasAlcancadas}
            valorPorEtapa={painel.valorPorEtapa}
            fechadosPorMes={painel.fechadosPorMes}
            origens={painel.origens}
            funilLeads={funilLeads}
          />
        </section>
      )}

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

        <Card className="mt-6">
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
      </section>
    </>
  )
}
