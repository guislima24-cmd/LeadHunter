import { Bloco, EsqueletoCabecalho, EsqueletoCartao } from '@/components/ui/Esqueleto'

export default function Carregando() {
  return (
    <>
      <Bloco className="mb-4 h-4 w-40" />
      <EsqueletoCabecalho />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <EsqueletoCartao altura="h-[32rem]" />
        </div>
        <div className="space-y-6 lg:col-span-2">
          <EsqueletoCartao altura="h-48" />
          <EsqueletoCartao altura="h-40" />
        </div>
      </div>
    </>
  )
}
