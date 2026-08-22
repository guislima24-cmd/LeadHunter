'use client'
import { useId, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Campo, Entrada, Selecao } from '@/components/ui/Campo'
import type { OrganizacaoConhecida, ProdutoServico } from '@/lib/crm'

/**
 * Cria um negócio direto no quadro, sem passar por lead.
 *
 * O caminho de entrada do funil que a plataforma não cobria: indicação,
 * evento, alguém que ligou. Promover lead continua sendo o caminho principal
 * (é o que já traz CNPJ, decisor e enriquecimento de graça), por isso o
 * formulário insiste na empresa e no título e deixa todo o resto opcional —
 * quem está com o cliente na linha não pára para preencher ficha.
 *
 * Empresa é campo livre com sugestão das que já existem: a função do banco
 * reaproveita a organização quando o nome (ou o CNPJ) bate, então escolher da
 * lista não fragmenta o histórico e digitar um nome novo simplesmente cria.
 */
export function NovoNegocio({
  organizacoes,
  produtos,
  variante = 'primario',
}: {
  organizacoes: OrganizacaoConhecida[]
  produtos: ProdutoServico[]
  variante?: 'primario' | 'secundario'
}) {
  const [aberto, setAberto] = useState(false)

  return (
    <>
      <Button tamanho="sm" variante={variante} onClick={() => setAberto(true)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="size-3.5">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Novo negócio
      </Button>

      {aberto && (
        <Formulario
          organizacoes={organizacoes}
          produtos={produtos}
          aoFechar={() => setAberto(false)}
        />
      )}
    </>
  )
}

function Formulario({
  organizacoes,
  produtos,
  aoFechar,
}: {
  organizacoes: OrganizacaoConhecida[]
  produtos: ProdutoServico[]
  aoFechar: () => void
}) {
  const router = useRouter()
  const idBase = useId()
  const listaEmpresas = `${idBase}-empresas`

  const [empresa, setEmpresa] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [titulo, setTitulo] = useState('')
  const [produtoServicoId, setProdutoServicoId] = useState('')
  const [valor, setValor] = useState('')
  const [previsao, setPrevisao] = useState('')

  const [comContato, setComContato] = useState(false)
  const [contatoNome, setContatoNome] = useState('')
  const [contatoEmail, setContatoEmail] = useState('')
  const [contatoTelefone, setContatoTelefone] = useState('')

  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const jaExiste = organizacoes.some(
    (o) => o.nome.trim().toLowerCase() === empresa.trim().toLowerCase(),
  )

  async function criar(evento: React.FormEvent) {
    evento.preventDefault()
    setSalvando(true)
    setErro(null)
    try {
      const res = await fetch('/api/crm/negocios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizacaoNome: empresa,
          // Sem título digitado, o nome da empresa serve — é o que a
          // promoção de lead já faz, e evita travar o formulário num campo
          // que quase sempre repetiria a empresa.
          titulo: titulo.trim() || empresa.trim(),
          cnpj,
          produtoServicoId,
          valor,
          previsaoFechamento: previsao,
          contatoNome: comContato ? contatoNome : '',
          contatoEmail: comContato ? contatoEmail : '',
          contatoTelefone: comContato ? contatoTelefone : '',
        }),
      })
      const dados = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErro(dados.mensagem ?? 'Não foi possível criar o negócio.')
        return
      }
      aoFechar()
      // Vai direto para a ficha: quem acabou de criar quase sempre quer
      // registrar a primeira atividade em seguida.
      router.push(`/negocios/${dados.negocioId}`)
      router.refresh()
    } catch {
      setErro('Falha de conexão ao criar o negócio.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Novo negócio"
      className="fixed inset-0 z-50 flex items-end justify-center bg-tinta-900/40 p-0 text-left sm:items-center sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget && !salvando) aoFechar()
      }}
    >
      <form
        onSubmit={criar}
        className="surgir max-h-[92vh] w-full max-w-lg overflow-y-auto rolagem-fina rounded-t-cartao bg-white p-5 shadow-lg sm:rounded-cartao"
      >
        <h2 className="font-titulo text-base font-bold text-tinta-900">
          Novo negócio
        </h2>
        <p className="mt-0.5 text-sm text-tinta-500">
          Entra na primeira etapa do funil, com você como responsável.
        </p>

        <div className="mt-4 space-y-3.5">
          <Campo
            rotulo="Empresa"
            id={`${idBase}-empresa`}
            dica={jaExiste ? 'já está no CRM' : 'obrigatório'}
          >
            <Entrada
              id={`${idBase}-empresa`}
              list={listaEmpresas}
              value={empresa}
              onChange={(e) => setEmpresa(e.target.value)}
              placeholder="Razão social ou nome que o time usa"
              required
              autoFocus
            />
            <datalist id={listaEmpresas}>
              {organizacoes.map((o) => (
                <option key={o.id} value={o.nome} />
              ))}
            </datalist>
          </Campo>

          <Campo
            rotulo="Título do negócio"
            id={`${idBase}-titulo`}
            dica="opcional"
          >
            <Entrada
              id={`${idBase}-titulo`}
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder={empresa.trim() || 'Ex.: Diagnóstico de processos'}
            />
          </Campo>

          <div className="grid gap-3.5 sm:grid-cols-2">
            <Campo rotulo="Valor (R$)" id={`${idBase}-valor`} dica="opcional">
              <Entrada
                id={`${idBase}-valor`}
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0,00"
              />
            </Campo>
            <Campo
              rotulo="Previsão de fechamento"
              id={`${idBase}-previsao`}
              dica="opcional"
            >
              <Entrada
                id={`${idBase}-previsao`}
                type="date"
                value={previsao}
                onChange={(e) => setPrevisao(e.target.value)}
              />
            </Campo>
          </div>

          <div className="grid gap-3.5 sm:grid-cols-2">
            <Campo rotulo="Serviço" id={`${idBase}-produto`} dica="opcional">
              <Selecao
                id={`${idBase}-produto`}
                value={produtoServicoId}
                onChange={(e) => setProdutoServicoId(e.target.value)}
              >
                <option value="">A definir</option>
                {produtos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </Selecao>
            </Campo>
            <Campo
              rotulo="CNPJ"
              id={`${idBase}-cnpj`}
              dica={jaExiste ? 'já vinculado' : 'opcional'}
            >
              <Entrada
                id={`${idBase}-cnpj`}
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
                placeholder="00.000.000/0000-00"
                inputMode="numeric"
              />
            </Campo>
          </div>

          {comContato ? (
            <fieldset className="rounded-lg border border-tinta-200 p-3.5">
              <legend className="px-1 text-xs font-semibold text-tinta-700">
                Contato na empresa
              </legend>
              <div className="space-y-3">
                <Campo rotulo="Nome" id={`${idBase}-contato`}>
                  <Entrada
                    id={`${idBase}-contato`}
                    value={contatoNome}
                    onChange={(e) => setContatoNome(e.target.value)}
                    placeholder="Quem decide, ou quem atendeu"
                  />
                </Campo>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Campo rotulo="E-mail" id={`${idBase}-contato-email`}>
                    <Entrada
                      id={`${idBase}-contato-email`}
                      type="email"
                      value={contatoEmail}
                      onChange={(e) => setContatoEmail(e.target.value)}
                    />
                  </Campo>
                  <Campo rotulo="Telefone" id={`${idBase}-contato-tel`}>
                    <Entrada
                      id={`${idBase}-contato-tel`}
                      value={contatoTelefone}
                      onChange={(e) => setContatoTelefone(e.target.value)}
                      inputMode="tel"
                    />
                  </Campo>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setComContato(false)}
                className="mt-3 text-xs font-semibold text-tinta-500 hover:text-tinta-800 hover:underline"
              >
                Remover contato
              </button>
            </fieldset>
          ) : (
            <button
              type="button"
              onClick={() => setComContato(true)}
              className="text-xs font-semibold text-verde-700 hover:text-verde-800 hover:underline"
            >
              + Adicionar contato agora
            </button>
          )}
        </div>

        {erro && (
          <p
            role="alert"
            className="mt-3 rounded-lg bg-perigo-50 px-3 py-2 text-xs text-perigo-700"
          >
            {erro}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <Button
            type="button"
            variante="secundario"
            tamanho="sm"
            onClick={aoFechar}
            disabled={salvando}
          >
            Cancelar
          </Button>
          <Button type="submit" tamanho="sm" carregando={salvando}>
            Criar negócio
          </Button>
        </div>
      </form>
    </div>
  )
}
