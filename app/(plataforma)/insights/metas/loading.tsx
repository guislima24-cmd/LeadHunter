import {
  EsqueletoCabecalho,
  EsqueletoAbas,
  EsqueletoCartao,
} from '@/components/ui/Esqueleto'

export default function Carregando() {
  return (
    <>
      <EsqueletoCabecalho />
      <EsqueletoAbas quantas={4} />
      <div className="space-y-4">
        <EsqueletoCartao altura="h-40" />
        <EsqueletoCartao altura="h-40" />
      </div>
    </>
  )
}
