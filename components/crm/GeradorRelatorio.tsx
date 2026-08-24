'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Campo, Entrada, AreaTexto } from '@/components/ui/Campo'
import { Card, CardCabecalho } from '@/components/ui/Card'
import { formatarMesAno } from '@/lib/formato'

/**
 * Cria o relatório do mês — pela IA ou à mão.
 *
 * As duas portas ficam na mesma tela porque a escolha entre elas é do
 * momento, não do fluxo: quem tem o texto pronto na cabeça escreve; quem
 * quer um ponto de partida pede o rascunho. Nos dois casos o resultado nasce
 * como rascunho e passa pela mesma revisão.
 */
export function GeradorRelatorio() {
  const router = useRouter()

  const agora = new Date()
  const mesPassado = new Date(
    Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() - 1, 1),
  )
  // O mês passado, não o corrente: relatório mensal se escreve sobre mês
  // fechado, e o corrente ainda vai mudar de número até o dia 30.
  const [periodo, setPeriodo] = useState(mesPassado.toISOString().slice(0, 7))

  const [gerando, setGerando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const [manual, setManual] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [conteudo, setConteudo] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function gerarComIa() {
    setGerando(true)
    setErro(null)
    try {
      const res = await fetch('/api/crm/insights/relatorios/gerar-ia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodoReferencia: `${periodo}-01` }),
      })
      const dados = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErro(dados.mensagem ?? 'Não foi possível gerar o relatório.')
        return
      }
      router.push(`/insights/relatorios/${dados.relatorioId}`)
    } catch {
      setErro('Falha de conexão ao gerar o relatório.')
    } finally {
      setGerando(false)
    }
  }

  async function criarManual(evento: React.FormEvent) {
    evento.preventDefault()
    setSalvando(true)
    setErro(null)
    try {
      const res = await fetch('/api/crm/insights/relatorios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periodoReferencia: `${periodo}-01`,
          titulo,
          conteudo,
        }),
      })
      const dados = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErro(dados.mensagem ?? 'Não foi possível criar o relatório.')
        return
      }
      router.push(`/insights/relatorios/${dados.relatorioId}`)
    } catch {
      setErro('Falha de conexão ao criar o relatório.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardCabecalho
          titulo="Mês do relatório"
          descricao="Todos os números do relatório saem deste mês, do dia 1º ao último dia."
        />
        <div className="p-5">
          <Campo rotulo="Competência" id="periodo-relatorio">
            <Entrada
              id="periodo-relatorio"
              type="month"
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              className="w-48"
            />
          </Campo>
          <p className="mt-2 text-xs text-tinta-500">
            Relatório de {formatarMesAno(`${periodo}-01`)}.
          </p>
        </div>
      </Card>

      <Card>
        <CardCabecalho
          titulo="Gerar com IA"
          descricao="A IA recebe só os números já apurados pelo CRM e os escreve em prosa. Ela não tem acesso ao banco, não calcula nem estima nada."
        />
        <div className="p-5">
          <ul className="mb-4 space-y-1.5 text-sm leading-relaxed text-tinta-600">
            <li>
              · O rascunho nasce <strong>sempre como rascunho</strong> — nada
              publica sozinho.
            </li>
            <li>
              · Os números usados ficam congelados junto com o texto, então o
              relatório não muda de história depois.
            </li>
            <li>· Você edita livremente antes de publicar.</li>
          </ul>

          <Button onClick={gerarComIa} carregando={gerando}>
            Gerar rascunho de {formatarMesAno(`${periodo}-01`)}
          </Button>

          {gerando && (
            <p className="mt-2 text-xs text-tinta-500">
              Escrevendo — costuma levar de vinte segundos a um minuto.
            </p>
          )}
        </div>
      </Card>

      <Card>
        <CardCabecalho
          titulo="Escrever à mão"
          descricao="Os números do mês são congelados junto do mesmo jeito."
          acao={
            !manual && (
              <Button
                variante="secundario"
                tamanho="sm"
                onClick={() => setManual(true)}
              >
                Escrever
              </Button>
            )
          }
        />
        {manual && (
          <form onSubmit={criarManual} className="space-y-3.5 p-5">
            <Campo rotulo="Título" id="titulo-relatorio">
              <Entrada
                id="titulo-relatorio"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder={`Relatório comercial — ${formatarMesAno(`${periodo}-01`)}`}
                required
              />
            </Campo>
            <Campo rotulo="Texto" id="conteudo-relatorio">
              <AreaTexto
                id="conteudo-relatorio"
                rows={12}
                value={conteudo}
                onChange={(e) => setConteudo(e.target.value)}
                required
              />
            </Campo>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variante="secundario"
                tamanho="sm"
                onClick={() => setManual(false)}
                disabled={salvando}
              >
                Cancelar
              </Button>
              <Button type="submit" tamanho="sm" carregando={salvando}>
                Criar rascunho
              </Button>
            </div>
          </form>
        )}
      </Card>

      {erro && (
        <p role="alert" className="rounded-lg bg-perigo-50 px-3.5 py-2.5 text-sm text-perigo-700">
          {erro}
        </p>
      )}
    </div>
  )
}
