import { redirect } from 'next/navigation'

/**
 * O quadro de negócios virou a página inicial — ficar escondido atrás de uma
 * aba era exatamente o problema. A rota continua existindo porque links
 * antigos (e o selo de "já virou negócio" na lista de leads) apontavam para
 * cá; quem cair aqui vai parar no quadro do mesmo jeito.
 */
export default function PaginaPipeline() {
  redirect('/')
}
