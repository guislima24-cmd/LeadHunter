import {
  Bloco,
  EsqueletoCabecalho,
  EsqueletoAbas,
  EsqueletoTabela,
} from '@/components/ui/Esqueleto'

export default function Carregando() {
  return (
    <>
      <EsqueletoCabecalho />
      <EsqueletoAbas />
      <div className="mb-4 flex flex-wrap gap-2">
        <Bloco className="h-10 flex-1" />
        <Bloco className="h-10 w-36" />
        <Bloco className="h-10 w-44" />
        <Bloco className="h-10 w-44" />
      </div>
      <EsqueletoTabela linhas={8} />
    </>
  )
}
