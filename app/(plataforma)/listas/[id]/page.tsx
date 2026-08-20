import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Cabecalho } from '@/components/layout/Cabecalho'
import { Card, CardCabecalho } from '@/components/ui/Card'
import { Metrica } from '@/components/ui/Metrica'
import { Badge, type TomBadge } from '@/components/ui/Badge'
import { Tabela, Th, Td, Tr } from '@/components/ui/Tabela'
import { EstadoVazio } from '@/components/ui/Estado'
import { BotaoProspectar } from './BotaoProspectar'
import { exigirMembro } from '@/lib/sessao'
import { obterLista, type LeadDaLista } from '@/lib/dados'
import {
  formatarCNPJ,
  formatarTelefone,
  formatarNumero,
  formatarDataHora,
} from '@/lib/formato'

export const metadata = { title: 'Lista' }

const ROTULO_ENRIQUECIMENTO: Record<string, { texto: string; tom: TomBadge }> = {
  concluido: { texto: 'Enriquecido', tom: 'verde' },
  pendente: { texto: 'Aguardando cota', tom: 'amarelo' },
  erro: { texto: 'Falhou', tom: 'perigo' },
}

function StatusEnriquecimento({ lead }: { lead: LeadDaLista }) {
  if (!lead.enriquecimentoStatus) {
    return <Badge tom="neutro">Na fila</Badge>
  }
  const rotulo = ROTULO_ENRIQUECIMENTO[lead.enriquecimentoStatus]
  return rotulo ? (
    <Badge tom={rotulo.tom}>{rotulo.texto}</Badge>
  ) : (
    <Badge tom="neutro">{lead.enriquecimentoStatus}</Badge>
  )
}

export default async function PaginaLista({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const membro = await exigirMembro()

  const dados = membro.abaPlanilha
    ? await obterLista(id, membro.abaPlanilha)
    : null
  if (!dados) notFound()

  const { lista, leads } = dados
  const enriquecidos = leads.filter((l) => l.enriquecimentoStatus === 'concluido').length
  const contatados = leads.filter((l) => l.contatadoEm).length
  const elegiveis = leads.filter((l) => l.email && !l.contatadoEm).length

  return (
    <>
      <Link
        href="/listas"
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-tinta-500 transition-colors hover:text-verde-700"
      >
        ← Minhas listas
      </Link>

      <Cabecalho
        titulo={lista.setor || 'Lista sem setor'}
        descricao={`${lista.cidade || 'Todas as cidades'} · gerada em ${formatarDataHora(lista.criadaEm)}`}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metrica rotulo="Leads na lista" valor={formatarNumero(leads.length)} />
        <Metrica
          rotulo="Enriquecidos"
          valor={formatarNumero(enriquecidos)}
          apoio={`de ${formatarNumero(leads.length)}`}
          destaque={enriquecidos > 0}
        />
        <Metrica
          rotulo="Já contatados"
          valor={formatarNumero(contatados)}
          apoio="por email, via plataforma"
        />
        <Metrica
          rotulo="Prontos para envio"
          valor={formatarNumero(elegiveis)}
          apoio="com email e ainda sem contato"
        />
      </section>

      <div className="mt-6">
        <BotaoProspectar
          listaId={lista.id}
          elegiveis={elegiveis}
          habilitado={Boolean(membro.abaPlanilha)}
        />
      </div>

      <Card className="mt-6">
        <CardCabecalho
          titulo="Leads"
          descricao="Os dados do decisor chegam pelo enriquecimento com IA e podem levar alguns minutos."
        />
        {leads.length === 0 ? (
          <EstadoVazio
            titulo="Lista sem leads"
            descricao="Nenhum lead desta lista foi encontrado na base — pode ter sido gerada antes de uma atualização da Receita Federal."
          />
        ) : (
          <Tabela>
            <thead>
              <tr>
                <Th>Empresa</Th>
                <Th>Decisor</Th>
                <Th>Contato</Th>
                <Th>Enriquecimento</Th>
                <Th>Prospecção</Th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <Tr key={lead.cnpj}>
                  <Td>
                    <span className="block max-w-xs truncate font-semibold text-tinta-900">
                      {lead.razaoSocial}
                    </span>
                    <span className="numerico mt-0.5 block text-xs text-tinta-500">
                      {formatarCNPJ(lead.cnpj)}
                      {lead.cidade ? ` · ${lead.cidade}` : ''}
                    </span>
                  </Td>
                  <Td>
                    {lead.decisorNome ? (
                      <>
                        <span className="block text-sm font-medium text-tinta-800">
                          {lead.decisorLinkedin ? (
                            <a
                              href={lead.decisorLinkedin}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-verde-700 hover:underline"
                            >
                              {lead.decisorNome}
                            </a>
                          ) : (
                            lead.decisorNome
                          )}
                        </span>
                        {lead.decisorCargo && (
                          <span className="block text-xs text-tinta-500">
                            {lead.decisorCargo}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-tinta-400">—</span>
                    )}
                  </Td>
                  <Td>
                    <div className="flex flex-col gap-0.5 text-xs">
                      {lead.email && (
                        <span className="max-w-[15rem] truncate text-tinta-700">
                          {lead.email}
                        </span>
                      )}
                      {lead.telefone && (
                        <span className="numerico text-tinta-500">
                          {formatarTelefone(lead.telefone)}
                        </span>
                      )}
                      {lead.site && (
                        <a
                          href={lead.site}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="max-w-[15rem] truncate text-verde-700 hover:underline"
                        >
                          {lead.site.replace(/^https?:\/\//, '')}
                        </a>
                      )}
                      {!lead.email && !lead.telefone && !lead.site && (
                        <span className="text-tinta-400">Sem contato</span>
                      )}
                    </div>
                  </Td>
                  <Td>
                    <StatusEnriquecimento lead={lead} />
                  </Td>
                  <Td className="text-xs whitespace-nowrap">
                    {lead.contatadoEm ? (
                      <span className="text-tinta-600">
                        {formatarDataHora(lead.contatadoEm)}
                      </span>
                    ) : lead.email ? (
                      <span className="text-tinta-400">Não enviado</span>
                    ) : (
                      <span className="text-tinta-400">Sem email</span>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Tabela>
        )}
      </Card>
    </>
  )
}
