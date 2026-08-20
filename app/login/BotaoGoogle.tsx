'use client'
import { useState } from 'react'
import { criarClienteNavegador } from '@/lib/supabase/browser'
import { Button } from '@/components/ui/Button'

export function BotaoGoogle({ proximo }: { proximo?: string }) {
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function entrar() {
    setCarregando(true)
    setErro(null)
    const supabase = criarClienteNavegador()
    const destino = new URL('/auth/callback', window.location.origin)
    if (proximo) destino.searchParams.set('proximo', proximo)

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: destino.toString(),
        queryParams: { hd: 'ufabcjr.com.br', prompt: 'select_account' },
      },
    })

    if (error) {
      setErro(error.message)
      setCarregando(false)
    }
  }

  return (
    <div>
      <Button
        onClick={entrar}
        carregando={carregando}
        tamanho="lg"
        variante="secundario"
        larguraTotal
      >
        {!carregando && (
          <svg viewBox="0 0 24 24" className="size-[18px]" aria-hidden="true">
            <path fill="#4285F4" d="M23.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.87c2.26-2.09 3.56-5.17 3.56-8.87Z" />
            <path fill="#34A853" d="M12 24c3.24 0 5.96-1.08 7.94-2.91l-3.87-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.28v3.09A12 12 0 0 0 12 24Z" />
            <path fill="#FBBC05" d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58V6.62H1.28a12 12 0 0 0 0 10.76l3.99-3.09Z" />
            <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.43-3.43C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.28 6.62l3.99 3.09C6.22 6.86 8.87 4.75 12 4.75Z" />
          </svg>
        )}
        Entrar com Google
      </Button>

      {erro && (
        <p className="mt-3 rounded-lg bg-perigo-50 px-3 py-2 text-xs text-perigo-700">
          {erro}
        </p>
      )}
    </div>
  )
}
