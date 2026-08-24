import { Bloco, EsqueletoCabecalho, EsqueletoCartao } from '@/components/ui/Esqueleto'

export default function Carregando() {
  return (
    <>
      <Bloco className="mb-4 h-4 w-48" />
      <EsqueletoCabecalho />
      <div className="grid gap-6 lg:grid-cols-2">
        <EsqueletoCartao altura="h-64" />
        <EsqueletoCartao altura="h-64" />
      </div>
    </>
  )
}
