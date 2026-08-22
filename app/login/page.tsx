import type { Metadata } from 'next'
import { Logo, Simbolo, MarcaDagua } from '@/components/Logo'
import { DOMINIO_PERMITIDO } from '@/lib/sessao'
import { BotaoGoogle } from './BotaoGoogle'

export const metadata: Metadata = { title: 'Entrar' }

const MOTIVOS: Record<string, string> = {
  inativo: 'Seu acesso foi desativado. Fale com o time comercial.',
  dominio: `Use seu email @${DOMINIO_PERMITIDO} — contas pessoais não têm acesso.`,
  falha: 'Não foi possível concluir o login. Tente novamente.',
}

export default async function PaginaLogin({
  searchParams,
}: {
  searchParams: Promise<{ proximo?: string; motivo?: string }>
}) {
  const { proximo, motivo } = await searchParams
  const aviso = motivo ? MOTIVOS[motivo] : null

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* Painel de marca — uma frase só, no maior tamanho que couber, sobre o
          símbolo em marca d'água. A lista de recursos que ficava aqui saiu:
          quem chega nesta tela já trabalha no time e não precisa ser vendido. */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-tinta-950 p-12 lg:flex">
        <MarcaDagua className="-right-[14%] -bottom-[18%] w-[88%] opacity-[0.09]" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-verde-600/25 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -left-20 size-80 rounded-full bg-amarelo-500/10 blur-3xl"
        />

        <Logo emFundoEscuro className="relative" />

        <h1 className="font-titulo relative max-w-3xl text-5xl leading-[1.05] font-extrabold tracking-tight text-balance text-white xl:text-6xl 2xl:text-7xl">
          Toda a operação comercial
          <span className="text-amarelo-400"> em um lugar só.</span>
        </h1>

        <p className="relative text-xs text-tinta-500">
          Empresa Júnior de Ciência e Tecnologia da UFABC
        </p>
      </aside>

      {/* Painel de acesso */}
      <main className="relative flex items-center justify-center overflow-hidden bg-white px-6 py-12">
        {/* No celular o painel escuro some, então a marca d'água aparece aqui
            para a tela não ficar só formulário. */}
        <MarcaDagua className="-right-[22%] -bottom-[14%] w-[80%] opacity-[0.05] lg:hidden" />

        <div className="surgir relative w-full max-w-sm">
          <div className="lg:hidden">
            <Logo />
          </div>

          <div className="mt-10 lg:mt-0">
            <span className="hidden lg:inline-flex">
              <Simbolo className="size-12" />
            </span>
            <h2 className="font-titulo mt-5 text-2xl font-extrabold text-tinta-900">
              Entrar na plataforma
            </h2>
            <p className="mt-2 text-sm text-tinta-500">
              Acesso restrito a contas{' '}
              <span className="font-semibold text-tinta-700">
                @{DOMINIO_PERMITIDO}
              </span>
              .
            </p>
          </div>

          {aviso && (
            <p className="mt-6 rounded-lg border border-amarelo-200 bg-amarelo-50 px-3.5 py-2.5 text-xs leading-relaxed text-amarelo-700">
              {aviso}
            </p>
          )}

          <div className="mt-8">
            <BotaoGoogle proximo={proximo} />
          </div>

          <p className="mt-8 text-xs leading-relaxed text-tinta-400">
            Ao entrar, seu nome é vinculado à sua aba na planilha de prospecção
            para que os leads gerados fiquem no seu nome.
          </p>
        </div>
      </main>
    </div>
  )
}
