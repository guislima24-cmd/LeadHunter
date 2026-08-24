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
      <div className="space-y-6">
        <EsqueletoCartao altura="h-24" />
        <EsqueletoCartao altura="h-40" />
        <EsqueletoCartao altura="h-20" />
      </div>
    </>
  )
}
