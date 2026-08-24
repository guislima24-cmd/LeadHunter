import {
  EsqueletoCabecalho,
  EsqueletoAbas,
  EsqueletoMetricas,
  EsqueletoCartao,
} from '@/components/ui/Esqueleto'

export default function Carregando() {
  return (
    <>
      <EsqueletoCabecalho />
      <EsqueletoAbas quantas={4} />
      <EsqueletoMetricas />
      <div className="mt-6 space-y-6">
        <EsqueletoCartao altura="h-56" />
        <div className="grid gap-6 xl:grid-cols-2">
          <EsqueletoCartao />
          <EsqueletoCartao />
        </div>
      </div>
    </>
  )
}
