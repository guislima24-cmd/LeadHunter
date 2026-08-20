/** Junta classes condicionais sem depender de biblioteca externa. */
export function cn(...partes: Array<string | false | null | undefined>): string {
  return partes.filter(Boolean).join(' ')
}
