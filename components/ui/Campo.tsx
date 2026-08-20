import { cn } from '@/lib/cn'

const baseControle =
  'w-full rounded-lg border border-tinta-200 bg-white px-3 text-sm text-tinta-900 ' +
  'placeholder:text-tinta-400 transition-colors ' +
  'hover:border-tinta-300 focus:border-verde-600 focus:outline-none focus:ring-2 focus:ring-verde-600/20 ' +
  'disabled:cursor-not-allowed disabled:bg-tinta-50 disabled:text-tinta-400'

export function Rotulo({
  htmlFor,
  children,
  dica,
}: {
  htmlFor?: string
  children: React.ReactNode
  dica?: string
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 flex items-baseline justify-between gap-2 text-xs font-semibold text-tinta-700"
    >
      <span>{children}</span>
      {dica && <span className="font-normal text-tinta-400">{dica}</span>}
    </label>
  )
}

export function Campo({
  rotulo,
  dica,
  erro,
  children,
  id,
}: {
  rotulo?: string
  dica?: string
  erro?: string
  children: React.ReactNode
  id?: string
}) {
  return (
    <div>
      {rotulo && (
        <Rotulo htmlFor={id} dica={dica}>
          {rotulo}
        </Rotulo>
      )}
      {children}
      {erro && <p className="mt-1 text-xs text-perigo-600">{erro}</p>}
    </div>
  )
}

export function Entrada({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(baseControle, 'h-10', className)} />
}

export function AreaTexto({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea {...props} className={cn(baseControle, 'py-2 leading-relaxed', className)} />
  )
}

export function Selecao({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        baseControle,
        'h-10 cursor-pointer appearance-none bg-no-repeat pr-9',
        className,
      )}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%236b736d' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m4 6 4 4 4-4'/%3E%3C/svg%3E\")",
        backgroundPosition: 'right 0.75rem center',
      }}
    >
      {children}
    </select>
  )
}
