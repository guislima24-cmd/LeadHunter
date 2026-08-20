'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardCabecalho } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Campo, Entrada, Selecao } from '@/components/ui/Campo'
import { Badge } from '@/components/ui/Badge'
import { Tabela, Th, Td, Tr } from '@/components/ui/Tabela'
import { EstadoVazio, EstadoCarregando } from '@/components/ui/Estado'
import { SETORES, PORTES, ESTADOS } from '@/data/cnaes'
import { formatarCNPJ, formatarTelefone, formatarNumero } from '@/lib/formato'
import type { LeadBusca } from '@/app/api/leads/buscar/route'

interface Filtros {
  setor: string
  cidade: string
  estado: string
  porte: string
  nomeEmpresa: string
  filtroContato: 'todos' | 'comContato' | 'apenasEmail' | 'apenasTelefone'
  quantidade: number
}

const FILTROS_INICIAIS: Filtros = {
  setor: '',
  cidade: '',
  estado: 'SP',
  porte: '',
  nomeEmpresa: '',
  filtroContato: 'comContato',
  quantidade: 20,
}

const POR_PAGINA = 25

interface ResultadoGeracao {
  listaId: string
  quantidade: number
  bloqueadosPorContato: number
  bloqueadosPorReserva: number
}

export function PainelBusca({ podeGerar }: { podeGerar: boolean }) {
  const router = useRouter()
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INICIAIS)
  const [leads, setLeads] = useState<LeadBusca[]>([])
  const [pagina, setPagina] = useState(1)
  const [temProxima, setTemProxima] = useState(false)
  const [buscando, setBuscando] = useState(false)
  const [gerando, setGerando] = useState(false)
  const [buscou, setBuscou] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [resultado, setResultado] = useState<ResultadoGeracao | null>(null)

  function alterar<C extends keyof Filtros>(campo: C, valor: Filtros[C]) {
    setFiltros((atual) => ({ ...atual, [campo]: valor }))
  }

  async function buscar(novaPagina = 1) {
    setBuscando(true)
    setErro(null)
    setResultado(null)
    try {
      const resposta = await fetch('/api/leads/buscar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...filtros, pagina: novaPagina, porPagina: POR_PAGINA }),
      })
      const dados = await resposta.json()
      if (!resposta.ok) {
        setErro(dados.mensagem ?? 'Não foi possível buscar agora.')
        setLeads([])
        return
      }
      setLeads(dados.leads)
      setPagina(dados.pagina)
      setTemProxima(dados.temProxima)
    } catch {
      setErro('Falha de conexão. Tente novamente.')
    } finally {
      setBuscando(false)
      setBuscou(true)
    }
  }

  async function gerarLista() {
    setGerando(true)
    setErro(null)
    try {
      const resposta = await fetch('/api/listas/gerar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filtros),
      })
      const dados = await resposta.json()
      if (!resposta.ok) {
        setErro(dados.mensagem ?? 'Não foi possível gerar a lista.')
        return
      }
      setResultado(dados)
      router.refresh()
    } catch {
      setErro('Falha de conexão ao gerar a lista.')
    } finally {
      setGerando(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_1fr] lg:items-start">
      {/* Filtros */}
      <Card className="lg:sticky lg:top-6">
        <CardCabecalho titulo="Filtros" descricao="Base pública da Receita Federal." />
        <div className="space-y-4 p-5">
          <Campo rotulo="Setor" id="setor">
            <Selecao
              id="setor"
              value={filtros.setor}
              onChange={(e) => alterar('setor', e.target.value)}
            >
              <option value="">Todos os setores</option>
              {SETORES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Selecao>
          </Campo>

          <div className="grid grid-cols-[1fr_88px] gap-3">
            <Campo rotulo="Cidade" id="cidade">
              <Entrada
                id="cidade"
                value={filtros.cidade}
                placeholder="Santo André"
                onChange={(e) => alterar('cidade', e.target.value)}
              />
            </Campo>
            <Campo rotulo="UF" id="estado">
              <Selecao
                id="estado"
                value={filtros.estado}
                onChange={(e) => alterar('estado', e.target.value)}
              >
                <option value="">—</option>
                {ESTADOS.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </Selecao>
            </Campo>
          </div>

          <Campo rotulo="Nome da empresa" id="nome" dica="opcional">
            <Entrada
              id="nome"
              value={filtros.nomeEmpresa}
              placeholder="Parte do nome"
              onChange={(e) => alterar('nomeEmpresa', e.target.value)}
            />
          </Campo>

          <Campo rotulo="Porte" id="porte">
            <Selecao
              id="porte"
              value={filtros.porte}
              onChange={(e) => alterar('porte', e.target.value)}
            >
              {PORTES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </Selecao>
          </Campo>

          <Campo rotulo="Contato" id="contato">
            <Selecao
              id="contato"
              value={filtros.filtroContato}
              onChange={(e) =>
                alterar('filtroContato', e.target.value as Filtros['filtroContato'])
              }
            >
              <option value="comContato">Com email ou telefone</option>
              <option value="apenasEmail">Só com email</option>
              <option value="apenasTelefone">Só com telefone</option>
              <option value="todos">Qualquer um</option>
            </Selecao>
          </Campo>

          <Button
            onClick={() => buscar(1)}
            carregando={buscando}
            larguraTotal
            variante="secundario"
          >
            Pré-visualizar
          </Button>

          <div className="border-t border-tinta-200 pt-4">
            <Campo
              rotulo="Leads na lista"
              id="quantidade"
              dica="máx. 200"
            >
              <Entrada
                id="quantidade"
                type="number"
                min={1}
                max={200}
                value={filtros.quantidade}
                onChange={(e) => alterar('quantidade', Number(e.target.value))}
              />
            </Campo>
            <Button
              onClick={gerarLista}
              carregando={gerando}
              disabled={!podeGerar}
              larguraTotal
              className="mt-3"
            >
              Gerar lista
            </Button>
            <p className="mt-2 text-xs leading-relaxed text-tinta-500">
              {podeGerar
                ? 'Remove quem já foi contatado ou está reservado por outro membro, reserva os leads no seu nome por 24 h e dispara o enriquecimento com IA.'
                : 'Disponível assim que sua aba da planilha for vinculada.'}
            </p>
          </div>
        </div>
      </Card>

      {/* Resultados */}
      <div className="min-w-0 space-y-4">
        {erro && (
          <div className="rounded-cartao border border-perigo-100 bg-perigo-50 px-4 py-3 text-sm text-perigo-700">
            {erro}
          </div>
        )}

        {resultado && (
          <Card className="border-verde-200 bg-verde-50/50 surgir">
            <div className="p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tom="verde">Lista criada</Badge>
                <span className="font-titulo text-sm font-bold text-tinta-900">
                  {formatarNumero(resultado.quantidade)} leads reservados no seu nome
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-tinta-600">
                O enriquecimento com IA já está rodando em segundo plano — os
                dados do decisor aparecem na lista conforme ficam prontos.
              </p>
              {(resultado.bloqueadosPorContato > 0 ||
                resultado.bloqueadosPorReserva > 0) && (
                <p className="mt-2 text-xs text-tinta-500">
                  Descartados no dedupe:{' '}
                  {formatarNumero(resultado.bloqueadosPorContato)} já contatados
                  · {formatarNumero(resultado.bloqueadosPorReserva)} reservados
                  por outro membro.
                </p>
              )}
              <Button
                className="mt-4"
                tamanho="sm"
                onClick={() => router.push(`/listas/${resultado.listaId}`)}
              >
                Abrir a lista
              </Button>
            </div>
          </Card>
        )}

        <Card>
          <CardCabecalho
            titulo="Pré-visualização"
            descricao={
              buscou && leads.length > 0
                ? `Mostrando ${leads.length} leads — página ${pagina}. A lista final aplica o dedupe.`
                : 'Confira o perfil dos leads antes de gerar a lista.'
            }
          />

          {buscando ? (
            <EstadoCarregando texto="Consultando a base…" />
          ) : !buscou ? (
            <EstadoVazio
              titulo="Nada buscado ainda"
              descricao="Ajuste os filtros ao lado e clique em Pré-visualizar."
            />
          ) : leads.length === 0 ? (
            <EstadoVazio
              titulo="Nenhuma empresa encontrada"
              descricao="Tente ampliar a cidade, trocar o setor ou aceitar leads sem contato."
            />
          ) : (
            <>
              <Tabela>
                <thead>
                  <tr>
                    <Th>Empresa</Th>
                    <Th>CNPJ</Th>
                    <Th>Cidade</Th>
                    <Th>Contato</Th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <Tr key={lead.cnpj}>
                      <Td>
                        <span className="block max-w-xs truncate font-semibold text-tinta-900">
                          {lead.razaoSocial}
                        </span>
                        <span className="mt-0.5 block text-xs text-tinta-500">
                          {[lead.setor, lead.porte].filter(Boolean).join(' · ') || '—'}
                        </span>
                      </Td>
                      <Td className="numerico text-xs whitespace-nowrap text-tinta-600">
                        {formatarCNPJ(lead.cnpj)}
                      </Td>
                      <Td className="text-tinta-600 whitespace-nowrap">
                        {lead.cidade || '—'}
                        {lead.estado ? `/${lead.estado}` : ''}
                      </Td>
                      <Td>
                        <div className="flex flex-col gap-0.5 text-xs">
                          {lead.email && (
                            <span className="max-w-[16rem] truncate text-tinta-700">
                              {lead.email}
                            </span>
                          )}
                          {lead.telefone && (
                            <span className="numerico text-tinta-500">
                              {formatarTelefone(lead.telefone)}
                            </span>
                          )}
                          {!lead.email && !lead.telefone && (
                            <span className="text-tinta-400">Sem contato</span>
                          )}
                        </div>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Tabela>

              <div className="flex items-center justify-between gap-3 border-t border-tinta-200 px-5 py-3">
                <Button
                  tamanho="sm"
                  variante="secundario"
                  disabled={pagina <= 1}
                  onClick={() => buscar(pagina - 1)}
                >
                  Anterior
                </Button>
                <span className="text-xs text-tinta-500">Página {pagina}</span>
                <Button
                  tamanho="sm"
                  variante="secundario"
                  disabled={!temProxima}
                  onClick={() => buscar(pagina + 1)}
                >
                  Próxima
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
