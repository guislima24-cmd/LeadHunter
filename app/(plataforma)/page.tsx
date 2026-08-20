import Link from 'next/link'
import { Cabecalho } from '@/components/layout/Cabecalho'
import { Card, CardCabecalho } from '@/components/ui/Card'
import { Metrica } from '@/components/ui/Metrica'
import { Badge } from '@/components/ui/Badge'
import { EstadoVazio } from '@/components/ui/Estado'
import { Tabela, Th, Td, Tr } from '@/components/ui/Tabela'
import { exigirMembro } from '@/lib/sessao'
import { obterResumoInicio } from '@/lib/dados'
import { formatarNumero, tempoRelativo } from '@/lib/formato'

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
    href: '/pipeline',
    titulo: 'Acompanhar o funil',
    texto: 'Veja onde seus leads estão e quanto cada etapa converte.',
  },
]

export default async function PaginaInicio() {
  const membro = await exigirMembro()
  const resumo = await obterResumoInicio(membro.abaPlanilha)

  const primeiroNome = membro.nome.split(' ')[0] || membro.nome

  return (
    <>
      <Cabecalho
        titulo={`Olá, ${primeiroNome}`}
        descricao="Um panorama da sua operação comercial e o que está acontecendo agora."
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metrica
          rotulo="Leads na base"
          valor={formatarNumero(resumo.leadsNaBase)}
          apoio="Receita Federal, atualizada"
        />
        <Metrica
          rotulo="Minhas listas"
          valor={formatarNumero(resumo.minhasListas)}
          apoio={`${formatarNumero(resumo.leadsNasListas)} leads nas 5 últimas`}
          destaque
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
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-3">
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
                    <Td className="text-tinta-500">{tempoRelativo(lista.criadaEm)}</Td>
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
                <Badge tom={resumo.pendentesEnriquecimento > 0 ? 'amarelo' : 'neutro'}>
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
      </section>
    </>
  )
}
