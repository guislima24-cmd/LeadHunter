import { redirect } from 'next/navigation'

/**
 * O quadro de negócios agora vive em `/negocios`.
 *
 * A rota continua existindo porque links antigos (e o selo de "já virou
 * negócio" na lista de leads) apontavam para cá. Chegou a apontar para `/`,
 * quando o quadro era a página inicial; desde que o funil ganhou aba própria,
 * o destino certo é a aba.
 */
export default function PaginaPipeline() {
  redirect('/negocios')
}
