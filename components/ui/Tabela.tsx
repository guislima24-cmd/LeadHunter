import { cn } from '@/lib/cn'

export function Tabela({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className="rolagem-fina overflow-x-auto">
      <table className={cn('w-full min-w-full border-collapse text-sm', className)}>
        {children}
      </table>
    </div>
  )
}

export function Th({
  className,
  children,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      {...props}
      className={cn(
        'sticky top-0 z-10 border-b border-tinta-200 bg-tinta-50 px-3 py-2.5 text-left',
        'text-[0.7rem] font-semibold tracking-wide text-tinta-500 uppercase whitespace-nowrap',
        className,
      )}
    >
      {children}
    </th>
  )
}

export function Td({
  className,
  children,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      {...props}
      className={cn('border-b border-tinta-100 px-3 py-2.5 align-middle', className)}
    >
      {children}
    </td>
  )
}

export function Tr({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr {...props} className={cn('transition-colors hover:bg-tinta-50', className)}>
      {children}
    </tr>
  )
}
