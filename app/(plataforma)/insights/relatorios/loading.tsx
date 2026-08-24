import {
  EsqueletoCabecalho,
  EsqueletoAbas,
  EsqueletoTabela,
} from '@/components/ui/Esqueleto'

export default function Carregando() {
  return (
    <>
      <EsqueletoCabecalho />
      <EsqueletoAbas quantas={4} />
      <EsqueletoTabela linhas={5} />
    </>
  )
}
