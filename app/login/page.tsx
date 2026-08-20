import type { Metadata } from 'next'
import { Logo, Simbolo } from '@/components/Logo'
import { DOMINIO_PERMITIDO } from '@/lib/sessao'
import { BotaoGoogle } from './BotaoGoogle'

export const metadata: Metadata = { title: 'Entrar' }

const MOTIVOS: Record<string, string> = {
  inativo: 'Seu acesso foi desativado. Fale com o time comercial.',
  dominio: `Use seu email @${DOMINIO_PERMITIDO} — contas pessoais não têm acesso.`,
  falha: 'Não foi possível concluir o login. Tente novamente.',
}

const DESTAQUES = [
  {
    titulo: 'Prospecção sem retrabalho',
    texto:
      'Listas da Receita Federal com dedupe automático — ninguém prospecta o mesmo lead duas vezes.',
  },
  {
    titulo: 'Contexto pronto pela IA',
    texto:
      'Cada lead chega com dor provável, gancho de abordagem e pesquisa da web já feita.',
  },
  {
    titulo: 'Funil sempre atualizado',
    texto:
      'Planilha, Notion e pipeline sincronizados a cada 15 minutos, sem ninguém copiar e colar.',
  },
]

export default async function PaginaLogin({
  searchParams,
}: {
  searchParams: Promise<{ proximo?: string; motivo?: string }>
}) {
  const { proximo, motivo } = await searchParams
  const aviso = motivo ? MOTIVOS[motivo] : null

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* Painel de marca */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-tinta-950 p-12 lg:flex">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-verde-600/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -left-20 size-80 rounded-full bg-amarelo-500/10 blur-3xl"
        />

        <Logo emFundoEscuro className="relative" />

        <div className="relative max-w-md">
          <h1 className="font-titulo text-4xl leading-tight font-extrabold text-white">
            Toda a operação comercial
            <span className="text-amarelo-400"> em um lugar só.</span>
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-tinta-400">
            Busca, enriquecimento, prospecção, funil e monitoramento — o que
            antes eram duas ferramentas e uma planilha solta.
          </p>

          <ul className="mt-10 space-y-5">
            {DESTAQUES.map((item) => (
              <li key={item.titulo} className="flex gap-3.5">
                <span
                  aria-hidden="true"
                  className="mt-1.5 size-1.5 shrink-0 rounded-full bg-amarelo-400"
                />
                <div>
                  <p className="text-sm font-semibold text-white">{item.titulo}</p>
                  <p className="mt-1 text-sm leading-relaxed text-tinta-400">
                    {item.texto}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-tinta-500">
          Empresa Júnior de Ciência e Tecnologia da UFABC
        </p>
      </aside>

      {/* Painel de acesso */}
      <main className="flex items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-sm surgir">
          <div className="lg:hidden">
            <Logo />
          </div>

          <div className="mt-10 lg:mt-0">
            <span className="hidden lg:inline-flex">
              <Simbolo className="size-10" />
            </span>
            <h2 className="mt-5 font-titulo text-2xl font-extrabold text-tinta-900">
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
