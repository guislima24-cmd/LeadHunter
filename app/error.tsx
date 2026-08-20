'use client'
import { useEffect } from 'react'
import { Simbolo } from '@/components/Logo'

/**
 * Captura falhas do layout da plataforma — inclusive a de configuração
 * ausente, que é a mais provável logo depois de um deploy novo.
 */
export default function Erro({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  const faltaChave = error.message.includes('SUPABASE_SERVICE_ROLE_KEY')

  return (
    <div className="flex min-h-screen items-center justify-center bg-tinta-50 px-6 py-12">
      <div className="w-full max-w-lg">
        <Simbolo className="size-10" />

        {faltaChave ? (
          <>
            <h1 className="mt-6 font-titulo text-2xl font-extrabold text-tinta-900">
              Falta uma variável de ambiente
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-tinta-600">
              A plataforma lê os dados pelo servidor, com a chave privilegiada
              do Supabase — e ela ainda não está configurada neste ambiente.
              O login funciona; as telas com dado, não.
            </p>

            <div className="mt-6 rounded-cartao border border-tinta-200 bg-white p-5">
              <p className="text-xs font-semibold tracking-wide text-tinta-500 uppercase">
                Como resolver
              </p>
              <ol className="mt-3 space-y-2.5 text-sm leading-relaxed text-tinta-600">
                <li>
                  <span className="font-semibold text-tinta-800">1.</span> No
                  Supabase, copie a chave <em>service_role</em> em{' '}
                  <span className="rounded bg-tinta-100 px-1.5 py-0.5 font-mono text-xs">
                    Settings → API
                  </span>
                  .
                </li>
                <li>
                  <span className="font-semibold text-tinta-800">2.</span> Na
                  Vercel, adicione em{' '}
                  <span className="rounded bg-tinta-100 px-1.5 py-0.5 font-mono text-xs">
                    Settings → Environment Variables
                  </span>{' '}
                  a variável{' '}
                  <span className="rounded bg-tinta-100 px-1.5 py-0.5 font-mono text-xs">
                    SUPABASE_SERVICE_ROLE_KEY
                  </span>
                  .
                </li>
                <li>
                  <span className="font-semibold text-tinta-800">3.</span>{' '}
                  Refaça o deploy para a variável entrar.
                </li>
              </ol>
              <p className="mt-4 border-t border-tinta-100 pt-3 text-xs leading-relaxed text-tinta-500">
                Nunca prefixe essa chave com <code>NEXT_PUBLIC_</code>: ela
                ignora as regras de acesso do banco e só pode existir no
                servidor.
              </p>
            </div>
          </>
        ) : (
          <>
            <h1 className="mt-6 font-titulo text-2xl font-extrabold text-tinta-900">
              Algo deu errado
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-tinta-600">
              A página não carregou. Se continuar acontecendo, avise o
              responsável técnico com o código abaixo.
            </p>
            {error.digest && (
              <p className="mt-4 rounded-lg bg-tinta-100 px-3 py-2 font-mono text-xs text-tinta-600">
                {error.digest}
              </p>
            )}
          </>
        )}

        <button
          onClick={reset}
          className="mt-6 inline-flex h-10 items-center rounded-lg bg-verde-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-verde-700"
        >
          Tentar de novo
        </button>
      </div>
    </div>
  )
}
