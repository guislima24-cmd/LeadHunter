/**
 * Preferência de largura da barra lateral.
 *
 * Cookie em vez de `localStorage` porque o layout é um Server Component: lendo
 * no servidor, a primeira pintura já sai com a barra na largura escolhida.
 */
export const COOKIE_BARRA = 'barra'
