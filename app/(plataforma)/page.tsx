import Link from 'next/link'
import { Cabecalho } from '@/components/layout/Cabecalho'
import { Card, CardCabecalho } from '@/components/ui/Card'
import { Metrica } from '@/components/ui/Metrica'
import { EstadoVazio } from '@/components/ui/Estado'
import { Tabela, Th, Td, Tr } from '@/components/ui/Tabela'
import { PainelGraficos } from '@/components/crm/PainelGraficos'
import { exigirMembro } from '@/lib/sessao'
import { obterResumoInicio, obterFunilDoMembro } from '@/lib/dados'
import { obterQuadroDeNegocios, obterPainelDoFunil } from '@/lib/crm'
import { contarReagendadosPendentes } from '@/lib/negocios'
import { formatarNumero, formatarReais, tempoRelativo } from '@/lib/formato'

export const metadata = { title: 'Início' }

/**
 * Início: o panorama da operação inteira, do lead bruto ao contrato.
 *
 * O quadro de negócios morava aqui e mudou para a aba Negócios nesta rodada.
 * O motivo é que o funil ganhou quatro formas de ser olhado (Kanban, Lista,
 * Funil, Previsão) — empilhar as quatro sob o resumo da prospecção faria as
 * três últimas nascerem abaixo da dobra, que é exatamente o problema que
 * tirar o Kanban de `/pipeline` tinha resolvido.
 *
 * O que fica: os números de saída do funil no topo (é o que se quer ver ao
 * abrir o CRM), os gráficos, e o volume bruto que alimenta tudo.
 */
export default async function PaginaInicio() {
  const membro = await exigirMembro()

  const [resumo, quadro, painel, funilLeads, reagendados] = await Promise.all([
    obterResumoInicio(membro.abaPlanilha),
    obterQuadroDeNegocios(),
    obterPainelDoFunil(),
    obterFunilDoMembro(membro.abaPlanilha),
    contarReagendadosPendentes(),
  ])

  const primeiroNome = membro.nome.split(' ')[0] || membro.nome
  const houveNegocio = painel.etapasAlcancadas.some((e) => e.quantidade > 0)

  return (
    <>
      <Cabecalho
        titulo={`Olá, ${primeiroNome}`}
        descricao="Como está a operação comercial agora — do lead na base ao contrato assinado."
        acao={
          <Link
            href="/negocios"
            className="inline-flex h-9 items-center rounded-lg bg-verde-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-verde-700"
          >
            Abrir o funil
          </Link>
        }
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

      {/* Uma fila que se espera zerar não merece um card fixo — só aparece
          quando tem alguém dentro dela. */}
      {reagendados > 0 && (
        <Link
          href="/negocios/reagendados"
          className="mt-4 flex items-center justify-between gap-3 rounded-cartao border border-amarelo-300 bg-amarelo-50 px-4 py-3 transition-colors hover:bg-amarelo-100"
        >
          <span className="text-sm text-amarelo-800">
            <strong className="numerico">{formatarNumero(reagendados)}</strong>{' '}
            {reagendados === 1
              ? 'negócio perdido por timing aguarda recontato'
              : 'negócios perdidos por timing aguardam recontato'}
            .
          </span>
          <span className="shrink-0 text-xs font-semibold text-amarelo-800 underline">
            Ver a fila
          </span>
        </Link>
      )}

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
