'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Entrada, AreaTexto } from '@/components/ui/Campo'
import type { RelatorioMensal } from '@/lib/tipos-insights'

/**
 * Leitura, edição e publicação de um relatório.
 *
 * Um relatório gerado por IA chega aqui como rascunho e **precisa** passar
 * por gente antes de virar o registro do mês. Por isso a tela abre em modo
 * leitura, com o botão de publicar ao lado do de editar: publicar é uma
 * decisão, não a continuação natural de rolar a página até o fim.
 */
export function EditorRelatorio({ relatorio }: { relatorio: RelatorioMensal }) {
  const router = useRouter()
  const [editando, setEditando] = useState(false)
  const [titulo, setTitulo] = useState(relatorio.titulo)
  const [conteudo, setConteudo] = useState(relatorio.conteudo)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function chamar(corpo: Record<string, unknown>, aoDarCerto: () => void) {
    setOcupado(true)
    setErro(null)
    try {
      const res = await fetch(`/api/crm/insights/relatorios/${relatorio.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      })
      const dados = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErro(dados.mensagem ?? 'Não foi possível concluir a operação.')
        return
      }
      aoDarCerto()
      router.refresh()
    } catch {
      setErro('Falha de conexão.')
    } finally {
      setOcupado(false)
    }
  }

  async function apagar() {
    setOcupado(true)
    setErro(null)
    try {
      const res = await fetch(`/api/crm/insights/relatorios/${relatorio.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const dados = await res.json().catch(() => ({}))
        setErro(dados.mensagem ?? 'Não foi possível apagar o relatório.')
        return
      }
      router.push('/insights/relatorios')
    } catch {
      setErro('Falha de conexão.')
    } finally {
      setOcupado(false)
    }
  }

  if (editando) {
    return (
      <div className="space-y-3.5">
        <Entrada
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          className="font-titulo text-lg font-bold"
          aria-label="Título do relatório"
        />
        <AreaTexto
          rows={24}
          value={conteudo}
          onChange={(e) => setConteudo(e.target.value)}
          className="leading-relaxed"
          aria-label="Texto do relatório"
        />
        {erro && (
          <p role="alert" className="rounded-lg bg-perigo-50 px-3 py-2 text-xs text-perigo-700">
            {erro}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button
            variante="secundario"
            tamanho="sm"
            onClick={() => {
              setTitulo(relatorio.titulo)
              setConteudo(relatorio.conteudo)
              setEditando(false)
            }}
            disabled={ocupado}
          >
            Descartar alterações
          </Button>
          <Button
            tamanho="sm"
            carregando={ocupado}
            onClick={() => chamar({ titulo, conteudo }, () => setEditando(false))}
          >
            Salvar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* `whitespace-pre-line` porque o texto é prosa em parágrafos separados
          por quebra de linha, não markdown — renderizar como HTML exigiria
          sanitizar conteúdo que a IA escreveu, sem ganho nenhum aqui. */}
      <div className="text-[0.95rem] leading-[1.75] whitespace-pre-line text-tinta-800">
        {relatorio.conteudo}
      </div>

      {erro && (
        <p role="alert" className="mt-4 rounded-lg bg-perigo-50 px-3 py-2 text-xs text-perigo-700">
          {erro}
        </p>
      )}

      <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-tinta-100 pt-4">
        {relatorio.status === 'rascunho' && (
          <Button
            variante="secundario"
            tamanho="sm"
            onClick={apagar}
            disabled={ocupado}
          >
            Apagar rascunho
          </Button>
        )}
        <Button
          variante="secundario"
          tamanho="sm"
          onClick={() => setEditando(true)}
          disabled={ocupado}
        >
          Editar texto
        </Button>
        {relatorio.status === 'rascunho' && (
          <Button
            tamanho="sm"
            carregando={ocupado}
            onClick={() => chamar({ acao: 'publicar' }, () => {})}
          >
            Publicar como relatório do mês
          </Button>
        )}
      </div>
    </div>
  )
}
