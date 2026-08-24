import {
  EsqueletoCabecalho,
  EsqueletoAbas,
  EsqueletoCartao,
} from '@/components/ui/Esqueleto'

export default function Carregando() {
  return (
    <>
      <EsqueletoCabecalho />
      <EsqueletoAbas />
      <EsqueletoCartao altura="h-96" />
    </>
  )
}
