import { Bloco, EsqueletoCabecalho, EsqueletoCartao } from '@/components/ui/Esqueleto'

export default function Carregando() {
  return (
    <>
      <Bloco className="mb-4 h-4 w-44" />
      <EsqueletoCabecalho />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <EsqueletoCartao altura="h-32" />
          <EsqueletoCartao altura="h-64" />
        </div>
        <EsqueletoCartao altura="h-72" />
      </div>
    </>
  )
}
