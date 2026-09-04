'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Entrada } from '@/components/ui/Campo'
import { Card, CardCabecalho } from '@/components/ui/Card'
import { formatarDataHora, tempoRelativo } from '@/lib/formato'
import type { TokenNaLista } from '@/lib/extensao'

/**
 * Geração e revogação do token da extensão.
 *
 * O segredo aparece **uma vez**, logo depois de gerado, e some assim que a
 * pessoa sai da tela — o banco tem só o hash dele. É o mesmo contrato de um
 * token pessoal do GitHub, e a tela precisa dizer isso antes, não depois:
 * quem fecha sem copiar não tem como recuperar, só gerar outro.
 */
export function TokensDaExtensao({ tokens }: { tokens: TokenNaLista[] }) {
  const router = useRouter()
  const [nome, setNome] = useState('')
  const [gerando, setGerando] = useState(false)
  const [novoToken, setNovoToken] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function gerar() {
    setGerando(true)
    setErro(null)
    try {
      const res = await fetch('/api/crm/extensao/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nomeDispositivo: nome }),
      })
      const dados = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErro(dados.mensagem ?? 'Não foi possível gerar o token.')
        return
      }
      setNovoToken(dados.token)
      setNome('')
      router.refresh()
    } catch {
      setErro('Falha de conexão ao gerar o token.')
    } finally {
      setGerando(false)
    }
  }

  async function revogar(id: string) {
    setErro(null)
    try {
      const res = await fetch(`/api/crm/extensao/tokens/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const dados = await res.json().catch(() => ({}))
        setErro(dados.mensagem ?? 'Não foi possível revogar o token.')
        return
      }
      router.refresh()
    } catch {
      setErro('Falha de conexão.')
    }
  }

  async function copiar() {
    if (!novoToken) return
    try {
      await navigator.clipboard.writeText(novoToken)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2500)
    } catch {
      // Área de transferência bloqueada (acontece em http sem TLS): o campo
      // é selecionável, então dá para copiar à mão.
      setErro('Não consegui copiar sozinho — selecione o texto e copie.')
    }
  }

  return (
    <div className="space-y-6">
      {novoToken && (
        <div className="rounded-cartao border-2 border-verde-500 bg-verde-50 p-5">
          <p className="font-titulo text-sm font-bold text-verde-800">
            Token gerado — copie agora
          </p>
          <p className="mt-1 text-xs leading-relaxed text-verde-700">
            Ele não vai aparecer de novo. Se perder, é só gerar outro e revogar
            este.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              readOnly
              value={novoToken}
              onFocus={(e) => e.currentTarget.select()}
              className="numerico min-w-0 flex-1 rounded-lg border border-verde-300 bg-white px-3 py-2 font-mono text-xs text-tinta-900"
              aria-label="Token da extensão"
            />
            <Button tamanho="sm" onClick={copiar}>
              {copiado ? 'Copiado' : 'Copiar'}
            </Button>
          </div>
          <ol className="mt-4 space-y-1 text-xs leading-relaxed text-verde-800">
            <li>1. Clique no ícone da extensão na barra do Chrome.</li>
            <li>2. Cole o token no campo de conexão e clique em Conectar.</li>
            <li>
              3. Pronto — as capturas do LinkedIn passam a cair na sua aba da
              planilha e no CRM.
            </li>
          </ol>
          <button
            type="button"
            onClick={() => setNovoToken(null)}
            className="mt-3 text-xs font-semibold text-verde-800 underline"
          >
            Já copiei, pode esconder
          </button>
        </div>
      )}

      <Card>
        <CardCabecalho
          titulo="2. Gerar o seu token"
          descricao="Dê um nome ao computador para reconhecer o token depois — “Notebook”, “PC do lab”."
        />
        <div className="flex flex-wrap items-end gap-2 p-5">
          <label className="min-w-52 flex-1">
            <span className="mb-1 block text-xs font-semibold text-tinta-700">
              Nome do dispositivo
            </span>
            <Entrada
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Meu notebook"
              maxLength={60}
            />
          </label>
          <Button onClick={gerar} carregando={gerando}>
            Gerar token
          </Button>
        </div>
      </Card>

      {erro && (
        <p role="alert" className="rounded-lg bg-perigo-50 px-3.5 py-2.5 text-sm text-perigo-700">
          {erro}
        </p>
      )}

      <Card>
        <CardCabecalho
          titulo="Tokens ativos"
          descricao="Revogue o de um computador que você não usa mais — a extensão dele para de enviar na hora seguinte."
        />
        {tokens.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-tinta-500">
            Nenhum token ativo. Gere um acima para conectar a extensão.
          </p>
        ) : (
          <ul className="divide-y divide-tinta-100">
            {tokens.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-tinta-900">
                    {t.nomeDispositivo || 'Sem nome'}
                  </span>
                  <span className="block text-xs text-tinta-500">
                    <span className="numerico font-mono">{t.prefixo}…</span> ·
                    criado em {formatarDataHora(t.criadoEm)}
                  </span>
                  <span className="block text-xs text-tinta-500">
                    {t.ultimoUsoEm
                      ? `último uso ${tempoRelativo(t.ultimoUsoEm)}`
                      : 'nunca usado — a extensão ainda não se conectou com ele'}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => revogar(t.id)}
                  className="shrink-0 text-xs font-semibold text-tinta-600 hover:text-perigo-700 hover:underline"
                >
                  Revogar
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
