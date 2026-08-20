export function AvisoSemAba() {
  return (
    <div className="mb-6 flex gap-3 rounded-cartao border border-amarelo-200 bg-amarelo-50 px-4 py-3.5">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className="mt-0.5 size-5 shrink-0 text-amarelo-600">
        <path d="M12 8.5v4M12 16.5h.01" />
        <circle cx="12" cy="12" r="9" />
      </svg>
      <div className="text-sm">
        <p className="font-semibold text-amarelo-700">
          Seu login ainda não está vinculado a uma aba da planilha
        </p>
        <p className="mt-1 leading-relaxed text-amarelo-700/85">
          Você pode navegar e consultar tudo normalmente, mas ainda não
          consegue gerar listas, prospectar ou buscar no Maps — essas ações
          gravam na sua aba de <em>Prospecção — Vendas</em>. Peça para um
          administrador fazer o vínculo.
        </p>
      </div>
    </div>
  )
}
