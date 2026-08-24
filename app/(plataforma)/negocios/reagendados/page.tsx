import { Cabecalho } from '@/components/layout/Cabecalho'
import { Card } from '@/components/ui/Card'
import { Metrica } from '@/components/ui/Metrica'
import { EstadoVazio } from '@/components/ui/Estado'
import { AbasNegocios } from '@/components/crm/AbasNegocios'
import { CartaoReagendado } from '@/components/crm/CartaoReagendado'
import { exigirMembro } from '@/lib/sessao'
import { listarReagendadosPendentes } from '@/lib/negocios'
import { formatarNumero, formatarReais } from '@/lib/formato'

export const metadata = { title: 'Negócios · Reagendados' }

/**
 * A fila de retomadas: negócios perdidos por timing, com data para voltar.
 *
 * Existe porque "o cliente pediu para falar em março" era, até agora,
 * informação que morria na memória de quem conduziu a conversa. Aqui ela é
 * registro — com contexto suficiente para outra pessoa retomar.
 *
 * Ordenada pelo que vence primeiro. Não é uma lista de leitura, é uma fila
 * de trabalho: o topo é o que precisa de ligação esta semana.
 */
export default async function PaginaReagendados() {
  await exigirMembro()

  const pendentes = await listarReagendadosPendentes()

  const vencidos = pendentes.filter((r) => r.diasAteRecontato < 0)
  const proximos = pendentes.filter(
    (r) => r.diasAteRecontato >= 0 && r.diasAteRecontato <= 5,
  )
  const valorEmJogo = pendentes.reduce((s, r) => s + (r.valor ?? 0), 0)

  return (
    <>
      <Cabecalho
        titulo="Negócios"
        descricao="Perdidos por “momento errado”, com data marcada para voltar a conversar."
      />

      <AbasNegocios reagendadosPendentes={pendentes.length} />

      <section className="grid gap-4 sm:grid-cols-3">
        <Metrica
          rotulo="Aguardando recontato"
          valor={formatarNumero(pendentes.length)}
          apoio="negócios com retomada marcada"
        />
        <Metrica
          rotulo="Vencidos ou nesta semana"
          valor={formatarNumero(vencidos.length + proximos.length)}
          apoio={
            vencidos.length > 0
              ? `${formatarNumero(vencidos.length)} já passaram da data`
              : 'nada atrasado'
          }
          destaque={vencidos.length > 0}
        />
        <Metrica
          rotulo="Valor em jogo"
          valor={formatarReais(valorEmJogo)}
          apoio="somando o valor que os negócios tinham quando foram perdidos"
        />
      </section>

      <div className="mt-6">
        {pendentes.length === 0 ? (
          <Card>
            <EstadoVazio
              titulo="Nenhuma retomada agendada"
              descricao="Quando um negócio for fechado como perdido pelo motivo “Momento errado”, o CRM pede o contexto da conversa e a data para voltar — e o registro aparece aqui, para qualquer pessoa do time retomar."
            />
          </Card>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
            {pendentes.map((item) => (
              <CartaoReagendado key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
