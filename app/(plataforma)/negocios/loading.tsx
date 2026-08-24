import {
  Bloco,
  EsqueletoCabecalho,
  EsqueletoMetricas,
  EsqueletoAbas,
} from '@/components/ui/Esqueleto'

export default function Carregando() {
  return (
    <>
      <EsqueletoCabecalho />
      <EsqueletoAbas />
      <EsqueletoMetricas />
      {/* Mesma casca de rolagem e mesma largura mínima de coluna do Kanban de
          verdade — se o esqueleto deixasse as colunas estourarem para fora, a
          barra de rolagem apareceria e sumiria na troca, dando um solavanco
          justo no quadro em que a página termina de carregar. */}
      <div className="rolagem-fina -mx-4 mt-6 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        <div className="flex gap-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="min-w-60 flex-1">
              <Bloco className="h-10 w-full" />
              <div className="mt-2 space-y-2">
                <Bloco className="h-24 w-full" />
                <Bloco className="h-24 w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
