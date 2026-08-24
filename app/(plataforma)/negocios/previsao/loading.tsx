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
      <EsqueletoAbas />
      <EsqueletoMetricas quantas={3} />
      <div className="mt-6 space-y-4">
        <EsqueletoCartao altura="h-40" />
        <EsqueletoCartao altura="h-40" />
      </div>
    </>
  )
}
