import { Bloco, EsqueletoCabecalho, EsqueletoCartao } from '@/components/ui/Esqueleto'

export default function Carregando() {
  return (
    <>
      <Bloco className="mb-4 h-4 w-36" />
      <EsqueletoCabecalho />
      <Bloco className="h-12 w-full" />
      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <EsqueletoCartao altura="h-96" />
        </div>
        <div className="space-y-6 lg:col-span-2">
          <EsqueletoCartao altura="h-40" />
          <EsqueletoCartao altura="h-40" />
        </div>
      </div>
    </>
  )
}
