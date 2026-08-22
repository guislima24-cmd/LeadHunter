/** Formatadores compartilhados — sempre pt-BR. */

export function formatarCNPJ(valor: string | null | undefined): string {
  if (!valor) return '—'
  const digitos = valor.replace(/\D/g, '')
  if (digitos.length !== 14) return valor
  return digitos.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}

export function formatarTelefone(valor: string | null | undefined): string {
  if (!valor) return '—'
  const d = valor.replace(/\D/g, '')
  if (d.length === 11) return d.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3')
  if (d.length === 10) return d.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3')
  return valor
}

export function formatarNumero(valor: number | null | undefined): string {
  if (valor == null || Number.isNaN(valor)) return '—'
  return new Intl.NumberFormat('pt-BR').format(valor)
}

export function formatarDolar(valor: number | null | undefined): string {
  if (valor == null || Number.isNaN(valor)) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(valor)
}

export function formatarReais(valor: number | null | undefined): string {
  if (valor == null || Number.isNaN(valor)) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(valor)
}

export function formatarPercentual(valor: number | null | undefined): string {
  if (valor == null || Number.isNaN(valor)) return '—'
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(valor)}%`
}

export function formatarDataHora(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export function formatarData(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)
}

/** "há 3 dias", "há 2 h" — para listas de atividade recente. */
export function tempoRelativo(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const segundos = Math.round((Date.now() - d.getTime()) / 1000)
  const fmt = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' })
  const faixas: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['second', 60],
    ['minute', 60],
    ['hour', 24],
    ['day', 30],
    ['month', 12],
  ]
  let quantidade = segundos
  for (const [unidade, limite] of faixas) {
    if (Math.abs(quantidade) < limite) return fmt.format(-Math.round(quantidade), unidade)
    quantidade /= limite
  }
  return fmt.format(-Math.round(quantidade), 'year')
}
