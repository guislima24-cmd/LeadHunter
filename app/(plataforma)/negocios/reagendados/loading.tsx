import {
  Bloco,
  EsqueletoCabecalho,
  EsqueletoAbas,
  EsqueletoMetricas,
} from '@/components/ui/Esqueleto'

export default function Carregando() {
  return (
    <>
      <EsqueletoCabecalho />
      <EsqueletoAbas />
      <EsqueletoMetricas quantas={3} />
      <div className="mt-6 grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Bloco key={i} className="h-72 w-full" />
        ))}
      </div>
    </>
  )
}
