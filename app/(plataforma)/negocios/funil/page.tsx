import { Cabecalho } from '@/components/layout/Cabecalho'
import { Card, CardCabecalho } from '@/components/ui/Card'
import { AbasNegocios } from '@/components/crm/AbasNegocios'
import { FunilVisual } from '@/components/crm/FunilVisual'
import { NovoNegocio } from '@/components/crm/NovoNegocio'
import { exigirMembro } from '@/lib/sessao'
import { listarOrganizacoes, listarProdutosServicos } from '@/lib/crm'
import { obterFunilVisual, contarReagendadosPendentes } from '@/lib/negocios'

export const metadata = { title: 'Negócios · Funil' }

export default async function PaginaFunilVisual() {
  await exigirMembro()

  const [etapas, organizacoes, produtos, reagendados] = await Promise.all([
    obterFunilVisual(),
    listarOrganizacoes(),
    listarProdutosServicos(),
    contarReagendadosPendentes(),
  ])

  return (
    <>
      <Cabecalho
        titulo="Negócios"
        descricao="O formato do funil agora: onde ele estrangula e quanto está parado em cada etapa."
        acao={<NovoNegocio organizacoes={organizacoes} produtos={produtos} />}
      />

      <AbasNegocios reagendadosPendentes={reagendados} />

      <Card>
        <CardCabecalho
          titulo="Funil de negócios"
          descricao="Cada faixa é uma etapa; a largura é proporcional à quantidade de negócios em aberto nela."
        />
        <FunilVisual etapas={etapas} />
      </Card>
    </>
  )
}
