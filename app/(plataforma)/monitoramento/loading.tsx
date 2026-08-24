import {
  EsqueletoCabecalho,
  EsqueletoMetricas,
  EsqueletoTabela,
} from '@/components/ui/Esqueleto'

export default function Carregando() {
  return (
    <>
      <EsqueletoCabecalho />
      <EsqueletoMetricas />
      <div className="mt-6">
        <EsqueletoTabela />
      </div>
    </>
  )
}
