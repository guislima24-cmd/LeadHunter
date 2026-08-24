import { Bloco, EsqueletoCabecalho, EsqueletoTabela } from '@/components/ui/Esqueleto'

export default function Carregando() {
  return (
    <>
      <Bloco className="mb-4 h-4 w-32" />
      <EsqueletoCabecalho />
      <EsqueletoTabela linhas={10} />
    </>
  )
}
