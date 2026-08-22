import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Cabecalho } from '@/components/layout/Cabecalho'
import { Card, CardCabecalho } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { EtapasDoNegocio } from '@/components/crm/EtapasDoNegocio'
import { DetalhesNegocio } from '@/components/crm/DetalhesNegocio'
import { LinhaDoTempo } from '@/components/crm/LinhaDoTempo'
import { exigirMembro } from '@/lib/sessao'
import {
  obterNegocio,
  obterHistoricoDeEtapas,
  listarAtividadesDoNegocio,
  listarContatosDaOrganizacao,
  listarEtapasAtivas,
  listarMembrosAtivos,
  listarMotivosPerda,
  listarProdutosServicos,
  listarTiposAtividade,
} from '@/lib/crm'
import {
  formatarCNPJ,
  formatarData,
  formatarDataHora,
  formatarReais,
  formatarTelefone,
} from '@/lib/formato'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const negocio = await obterNegocio(id)
  return { title: negocio ? negocio.titulo : 'Negócio' }
}

/**
 * Ficha do negócio: onde ele está, o que se sabe dele e o que já aconteceu.
 *
 * As três coisas numa tela só porque é assim que a conversa acontece — quem
 * abre a ficha antes de ligar quer ver o histórico, corrigir o valor e mover
 * a etapa sem navegar entre abas.
 */
export default async function PaginaNegocio({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const membro = await exigirMembro()

  const negocio = await obterNegocio(id)
  if (!negocio) notFound()

  const [
    etapas,
    produtos,
    contatos,
    motivosPerda,
    tipos,
    atividades,
    historico,
    membros,
  ] = await Promise.all([
    listarEtapasAtivas(),
    listarProdutosServicos(),
    listarContatosDaOrganizacao(negocio.organizacaoId),
    listarMotivosPerda(),
    listarTiposAtividade(),
    listarAtividadesDoNegocio(negocio.id),
    obterHistoricoDeEtapas(negocio.id),
    // Só o admin troca o dono, então só ele precisa da lista de membros.
    membro.papel === 'admin' ? listarMembrosAtivos() : Promise.resolve([]),
  ])

  return (
    <>
      <div className="mb-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-tinta-500 transition-colors hover:text-verde-700"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="size-3.5">
            <path d="M14 6l-6 6 6 6" />
          </svg>
          Voltar para o funil
        </Link>
      </div>

      <Cabecalho
        titulo={negocio.titulo}
        descricao={`${negocio.organizacaoNome}${negocio.contatoNome ? ` · ${negocio.contatoNome}` : ''}`}
        acao={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {negocio.valor != null && (
              <span className="numerico font-titulo text-xl font-extrabold text-verde-700">
                {formatarReais(negocio.valor)}
              </span>
            )}
            <Badge
              tom={
                negocio.status === 'ganho'
                  ? 'verde'
                  : negocio.status === 'perdido'
                    ? 'perigo'
                    : 'contorno'
              }
            >
              {negocio.status === 'aberto' ? negocio.etapaNome : negocio.status}
            </Badge>
            {negocio.atrasado && <Badge tom="perigo">previsão vencida</Badge>}
          </div>
        }
      />

      <EtapasDoNegocio
        negocioId={negocio.id}
        titulo={negocio.titulo}
        organizacaoNome={negocio.organizacaoNome}
        etapas={etapas}
        etapaAtualId={negocio.etapaId}
        status={negocio.status}
        motivoPerda={negocio.motivoPerda}
        fechadoEm={negocio.fechadoEm}
        motivosPerda={motivosPerda}
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardCabecalho
            titulo="Linha do tempo"
            descricao="Atividades registradas pelo time e as passagens de etapa, em ordem."
          />
          <LinhaDoTempo
            negocioId={negocio.id}
            atividades={atividades}
            historico={historico}
            tipos={tipos}
            fechado={negocio.status !== 'aberto'}
          />
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardCabecalho
              titulo="Dados do negócio"
              descricao="Vale para o cálculo do funil — mantenha valor e previsão em dia."
            />
            <DetalhesNegocio
              negocio={negocio}
              produtos={produtos}
              contatos={contatos}
              membros={membros}
              podeTrocarDono={membro.papel === 'admin'}
            />
          </Card>

          <Card>
            <CardCabecalho
              titulo="Empresa"
              descricao={
                negocio.leadOrigemCnpj
                  ? 'Veio de um lead da base.'
                  : 'Cadastrada direto no CRM.'
              }
            />
            <dl className="divide-y divide-tinta-100 text-sm">
              <Linha rotulo="Razão social" valor={negocio.organizacaoNome} />
              <Linha
                rotulo="CNPJ"
                valor={negocio.organizacaoCnpj ? formatarCNPJ(negocio.organizacaoCnpj) : null}
              />
              <Linha rotulo="Setor" valor={negocio.organizacaoSetor} />
              <Linha
                rotulo="Cidade"
                valor={
                  negocio.organizacaoCidade
                    ? `${negocio.organizacaoCidade}${negocio.organizacaoEstado ? `/${negocio.organizacaoEstado}` : ''}`
                    : null
                }
              />
              <Linha
                rotulo="Telefone"
                valor={
                  negocio.organizacaoTelefone
                    ? formatarTelefone(negocio.organizacaoTelefone)
                    : null
                }
              />
              <Linha
                rotulo="Site"
                valor={
                  negocio.organizacaoSite ? (
                    <a
                      href={
                        negocio.organizacaoSite.startsWith('http')
                          ? negocio.organizacaoSite
                          : `https://${negocio.organizacaoSite}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate font-semibold text-verde-700 hover:underline"
                    >
                      {negocio.organizacaoSite}
                    </a>
                  ) : null
                }
              />
            </dl>
          </Card>

          <Card>
            <CardCabecalho
              titulo="Contatos"
              descricao={`${contatos.length} na empresa. O marcado no negócio é o que aparece no cartão do funil.`}
            />
            {contatos.length === 0 ? (
              <p className="px-5 py-6 text-center text-xs text-tinta-500">
                Nenhum contato cadastrado nesta empresa ainda.
              </p>
            ) : (
              <ul className="divide-y divide-tinta-100">
                {contatos.map((contato) => (
                  <li key={contato.id} className="px-5 py-3.5">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className="text-sm font-semibold text-tinta-900">
                        {contato.nome}
                      </span>
                      {contato.id === negocio.contatoId && (
                        <Badge tom="verde">neste negócio</Badge>
                      )}
                      {contato.principal && contato.id !== negocio.contatoId && (
                        <Badge tom="contorno">principal</Badge>
                      )}
                    </div>
                    {contato.cargo && (
                      <p className="mt-0.5 text-xs text-tinta-500">
                        {contato.cargo}
                      </p>
                    )}
                    <p className="mt-1 space-x-2 text-xs text-tinta-600">
                      {contato.email && (
                        <a
                          href={`mailto:${contato.email}`}
                          className="hover:text-verde-700 hover:underline"
                        >
                          {contato.email}
                        </a>
                      )}
                      {contato.telefone && (
                        <span>{formatarTelefone(contato.telefone)}</span>
                      )}
                      {contato.linkedinUrl && (
                        <a
                          href={contato.linkedinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-verde-700 hover:underline"
                        >
                          LinkedIn
                        </a>
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardCabecalho titulo="Registro" />
            <dl className="divide-y divide-tinta-100 text-sm">
              <Linha
                rotulo="Origem"
                valor={
                  negocio.origem === 'promocao_lead'
                    ? 'Promoção de lead'
                    : 'Criado à mão'
                }
              />
              <Linha rotulo="Criado por" valor={negocio.criadoPorEmail} />
              <Linha rotulo="Criado em" valor={formatarDataHora(negocio.criadoEm)} />
              <Linha
                rotulo="Última alteração"
                valor={formatarDataHora(negocio.atualizadoEm)}
              />
              {negocio.fechadoEm && (
                <Linha
                  rotulo="Fechado em"
                  valor={formatarData(negocio.fechadoEm)}
                />
              )}
              {negocio.motivoPerda && (
                <Linha rotulo="Motivo da perda" valor={negocio.motivoPerda} />
              )}
            </dl>
          </Card>
        </div>
      </div>
    </>
  )
}

function Linha({
  rotulo,
  valor,
}: {
  rotulo: string
  valor: React.ReactNode | null
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-5 py-2.5">
      <dt className="shrink-0 text-xs font-semibold text-tinta-500">{rotulo}</dt>
      <dd className="min-w-0 truncate text-right text-tinta-800">
        {valor ?? <span className="text-tinta-400">—</span>}
      </dd>
    </div>
  )
}
