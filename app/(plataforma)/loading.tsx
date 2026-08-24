import {
  EsqueletoCabecalho,
  EsqueletoMetricas,
  EsqueletoCartao,
} from '@/components/ui/Esqueleto'

export default function Carregando() {
  return (
    <>
      <EsqueletoCabecalho />
      <EsqueletoMetricas />
      <div className="mt-10 grid gap-6 xl:grid-cols-2">
        <EsqueletoCartao />
        <EsqueletoCartao />
      </div>
    </>
  )
}
