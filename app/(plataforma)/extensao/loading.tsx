import { EsqueletoCabecalho, EsqueletoCartao } from '@/components/ui/Esqueleto'

export default function Carregando() {
  return (
    <>
      <EsqueletoCabecalho />
      <div className="space-y-6">
        <EsqueletoCartao altura="h-24" />
        <EsqueletoCartao altura="h-40" />
      </div>
    </>
  )
}
