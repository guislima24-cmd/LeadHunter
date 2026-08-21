'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'

interface Previa {
  assunto: string
  corpo: string
  para: string
  empresa: string
}

/**
 * Botão por lead que redige o email e mostra numa janela, sem enviar.
 *
 * O texto vem do mesmo workflow e do mesmo prompt do envio real. Como o
 * modelo roda com temperatura acima de zero, o email disparado depois não sai
 * palavra por palavra igual a esta prévia — o aviso no rodapé diz isso, para
 * ninguém aprovar um texto achando que é exatamente aquele que vai sair.
 */
export function PreviaEmail({
  listaId,
  cnpj,
  empresa,
  temEmail,
}: {
  listaId: string
  cnpj: string
  empresa: string
  temEmail: boolean
}) {
  const [aberto, setAberto] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [previa, setPrevia] = useState<Previa | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function gerar() {
    setAberto(true)
    if (previa || carregando) return

    setCarregando(true)
    setErro(null)
    try {
      const res = await fetch(`/api/listas/${listaId}/previa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cnpj }),
      })
      const dados = await res.json()
      if (!res.ok) {
        setErro(dados.mensagem ?? 'Não foi possível gerar a prévia.')
        return
      }
      setPrevia(dados)
    } catch {
      setErro('Falha de conexão ao gerar a prévia.')
    } finally {
      setCarregando(false)
    }
  }

  if (!temEmail) {
    return <span className="text-xs text-tinta-400">—</span>
  }

  return (
    <>
      <Button
        variante="secundario"
        tamanho="sm"
        onClick={gerar}
        aria-haspopup="dialog"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-3.5"
          aria-hidden="true"
        >
          <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
          <path d="m3.5 7 8.5 6 8.5-6" />
        </svg>
        Ver email
      </Button>

      {aberto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Prévia do email para ${empresa}`}
          // `text-left` explícito: este modal é renderizado dentro de um <td> que
          // alinha o botão à direita, e `text-align` é herdada — `position:
          // fixed` tira o elemento do fluxo, mas não da cadeia de herança.
          className="fixed inset-0 z-50 flex items-end justify-center p-0 text-left sm:items-center sm:p-6"
        >
          <button
            type="button"
            aria-label="Fechar prévia"
            onClick={() => setAberto(false)}
            className="absolute inset-0 bg-tinta-950/50"
          />

          <div className="surgir relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-cartao bg-white shadow-flutuante sm:rounded-cartao">
            <div className="flex items-start justify-between gap-3 border-b border-tinta-200 px-5 py-4">
              <div className="min-w-0">
                <h2 className="font-titulo text-sm font-bold text-tinta-900">
                  Prévia do email
                </h2>
                <p className="mt-0.5 truncate text-xs text-tinta-500">
                  {empresa}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAberto(false)}
                aria-label="Fechar"
                className="-m-1.5 rounded-lg p-1.5 text-tinta-500 transition-colors hover:bg-tinta-100 hover:text-tinta-800"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="size-4">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <div className="rolagem-fina flex-1 overflow-y-auto">
              {carregando && (
                <div className="flex items-center justify-center gap-2.5 px-6 py-16 text-tinta-500">
                  <Spinner className="size-4 text-verde-600" />
                  <span className="text-sm">A IA está escrevendo o email…</span>
                </div>
              )}

              {erro && !carregando && (
                <div className="px-5 py-8 text-center">
                  <p className="text-sm text-perigo-700">{erro}</p>
                </div>
              )}

              {previa && !carregando && (
                <>
                  <dl className="divide-y divide-tinta-100 border-b border-tinta-200">
                    <div className="flex gap-3 px-5 py-2.5">
                      <dt className="w-16 shrink-0 text-xs font-semibold text-tinta-500">
                        Para
                      </dt>
                      <dd className="min-w-0 truncate text-xs text-tinta-800">
                        {previa.para || '—'}
                      </dd>
                    </div>
                    <div className="flex gap-3 px-5 py-2.5">
                      <dt className="w-16 shrink-0 text-xs font-semibold text-tinta-500">
                        Assunto
                      </dt>
                      <dd className="min-w-0 text-xs font-semibold text-tinta-900">
                        {previa.assunto || '—'}
                      </dd>
                    </div>
                  </dl>

                  <div
                    className="px-5 py-5 text-sm leading-relaxed text-tinta-800 [&_p]:mb-3 [&_strong]:font-semibold [&_strong]:text-tinta-900 [&_a]:text-verde-700 [&_a]:underline"
                    dangerouslySetInnerHTML={{ __html: previa.corpo }}
                  />
                </>
              )}
            </div>

            <div className="border-t border-tinta-200 bg-tinta-50 px-5 py-3">
              <p className="text-xs leading-relaxed text-tinta-500">
                Escrita agora, pelo mesmo prompt do envio real. O email
                disparado depois segue esta estrutura, mas não sai palavra por
                palavra igual — a IA reescreve a cada envio.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
