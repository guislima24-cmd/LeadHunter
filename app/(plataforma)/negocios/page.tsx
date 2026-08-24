import Link from 'next/link'
import { Cabecalho } from '@/components/layout/Cabecalho'
import { Card, CardCabecalho } from '@/components/ui/Card'
import { Metrica } from '@/components/ui/Metrica'
import { EstadoVazio } from '@/components/ui/Estado'
import { QuadroNegocios } from '@/components/crm/QuadroNegocios'
import { NovoNegocio } from '@/components/crm/NovoNegocio'
import { AbasNegocios } from '@/components/crm/AbasNegocios'
import { exigirMembro } from '@/lib/sessao'
import {
  obterQuadroDeNegocios,
  obterPainelDoFunil,
  listarMotivosPerda,
  listarOrganizacoes,
  listarProdutosServicos,
} from '@/lib/crm'
import { contarReagendadosPendentes } from '@/lib/negocios'
import { formatarNumero, formatarReais } from '@/lib/formato'

export const metadata = { title: 'Negócios' }

/**
 * Kanban — a visualização padrão da aba Negócios.
 *
 * Era a página inicial até esta rodada. Saiu de lá porque o Início virou o
 * panorama da operação inteira (prospecção incluída) e o funil ganhou aba
 * própria com quatro formas de ser olhado; empilhar tudo numa página só
 * fazia a Previsão e a Lista nascerem escondidas abaixo da dobra.
 */
export default async function PaginaNegocios() {
  const membro = await exigirMembro()

  const [quadro, painel, motivosPerda, organizacoes, produtos, reagendados] =
    await Promise.all([
      obterQuadroDeNegocios(),
      obterPainelDoFunil(),
      listarMotivosPerda(),
      listarOrganizacoes(),
      listarProdutosServicos(),
      contarReagendadosPendentes(),
    ])

  return (
    <>
      <Cabecalho
        titulo="Negócios"
        descricao="O funil do time. Cada cartão é uma oportunidade real sendo trabalhada."
        acao={<NovoNegocio organizacoes={organizacoes} produtos={produtos} />}
      />

      <AbasNegocios reagendadosPendentes={reagendados} />

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
                  <NovoNegocio organizacoes={organizacoes} produtos={produtos} />
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
    </>
  )
}
