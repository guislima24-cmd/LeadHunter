'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Campo, Entrada, Selecao } from '@/components/ui/Campo'
import type {
  Contato,
  MembroResumido,
  NegocioDetalhado,
  ProdutoServico,
} from '@/lib/crm'

/**
 * Campos editáveis do negócio, salvos de uma vez.
 *
 * Não salva a cada tecla: metade das edições aqui são correções de digitação
 * em cima de valor e data, e um PATCH por caractere encheria o histórico do
 * banco de estados intermediários que ninguém quis registrar. O botão só
 * aparece quando algo mudou de verdade.
 *
 * Trocar o dono é ação de admin (Seção 5) — a API rejeita de qualquer jeito,
 * mas mostrar um select que sempre dá erro é pior do que não mostrar.
 */
export function DetalhesNegocio({
  negocio,
  produtos,
  contatos,
  membros,
  podeTrocarDono,
}: {
  negocio: NegocioDetalhado
  produtos: ProdutoServico[]
  contatos: Contato[]
  membros: MembroResumido[]
  podeTrocarDono: boolean
}) {
  const router = useRouter()

  const inicial = {
    titulo: negocio.titulo,
    valor: negocio.valor == null ? '' : String(negocio.valor),
    previsaoFechamento: negocio.previsaoFechamento ?? '',
    produtoServicoId: negocio.produtoServicoId ?? '',
    contatoId: negocio.contatoId ?? '',
    donoEmail: negocio.donoEmail,
  }

  const [forma, setForma] = useState(inicial)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [salvo, setSalvo] = useState(false)

  const sujo = (Object.keys(inicial) as Array<keyof typeof inicial>).some(
    (chave) => forma[chave] !== inicial[chave],
  )

  function alterar(chave: keyof typeof inicial, valor: string) {
    setForma((f) => ({ ...f, [chave]: valor }))
    setSalvo(false)
  }

  async function salvar(evento: React.FormEvent) {
    evento.preventDefault()
    setSalvando(true)
    setErro(null)
    try {
      const corpo: Record<string, unknown> = {
        titulo: forma.titulo.trim(),
        valor: forma.valor === '' ? null : Number(forma.valor),
        previsaoFechamento: forma.previsaoFechamento || null,
        produtoServicoId: forma.produtoServicoId || null,
        contatoId: forma.contatoId || null,
      }
      if (podeTrocarDono && forma.donoEmail !== inicial.donoEmail) {
        corpo.donoEmail = forma.donoEmail
      }

      const res = await fetch(`/api/crm/negocios/${negocio.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      })
      if (!res.ok) {
        const dados = await res.json().catch(() => ({}))
        setErro(dados.mensagem ?? 'Não foi possível salvar as alterações.')
        return
      }
      setSalvo(true)
      router.refresh()
    } catch {
      setErro('Falha de conexão ao salvar as alterações.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <form onSubmit={salvar} className="space-y-3.5 p-5">
      <Campo rotulo="Título" id="negocio-titulo">
        <Entrada
          id="negocio-titulo"
          value={forma.titulo}
          onChange={(e) => alterar('titulo', e.target.value)}
          required
        />
      </Campo>

      <div className="grid gap-3.5 sm:grid-cols-2">
        <Campo rotulo="Valor (R$)" id="negocio-valor">
          <Entrada
            id="negocio-valor"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={forma.valor}
            onChange={(e) => alterar('valor', e.target.value)}
            placeholder="a definir"
          />
        </Campo>
        <Campo
          rotulo="Previsão de fechamento"
          id="negocio-previsao"
          dica={negocio.atrasado ? 'venceu' : undefined}
        >
          <Entrada
            id="negocio-previsao"
            type="date"
            value={forma.previsaoFechamento}
            onChange={(e) => alterar('previsaoFechamento', e.target.value)}
          />
        </Campo>
      </div>

      <Campo rotulo="Serviço" id="negocio-produto">
        <Selecao
          id="negocio-produto"
          value={forma.produtoServicoId}
          onChange={(e) => alterar('produtoServicoId', e.target.value)}
        >
          <option value="">A definir</option>
          {produtos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </Selecao>
      </Campo>

      <Campo
        rotulo="Contato principal do negócio"
        id="negocio-contato"
        dica={contatos.length === 0 ? 'nenhum cadastrado' : undefined}
      >
        <Selecao
          id="negocio-contato"
          value={forma.contatoId}
          onChange={(e) => alterar('contatoId', e.target.value)}
          disabled={contatos.length === 0}
        >
          <option value="">Sem contato definido</option>
          {contatos.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
              {c.cargo ? ` — ${c.cargo}` : ''}
            </option>
          ))}
        </Selecao>
      </Campo>

      <Campo
        rotulo="Responsável"
        id="negocio-dono"
        dica={podeTrocarDono ? undefined : 'só admin troca'}
      >
        {podeTrocarDono ? (
          <Selecao
            id="negocio-dono"
            value={forma.donoEmail}
            onChange={(e) => alterar('donoEmail', e.target.value)}
          >
            {membros.map((m) => (
              <option key={m.email} value={m.email}>
                {m.nome}
              </option>
            ))}
          </Selecao>
        ) : (
          <p className="rounded-lg bg-tinta-50 px-3 py-2.5 text-sm text-tinta-700">
            {negocio.donoNome}
          </p>
        )}
      </Campo>

      {erro && (
        <p
          role="alert"
          className="rounded-lg bg-perigo-50 px-3 py-2 text-xs text-perigo-700"
        >
          {erro}
        </p>
      )}

      <div className="flex items-center justify-end gap-3 border-t border-tinta-100 pt-3.5">
        {salvo && !sujo && (
          <span className="text-xs font-semibold text-verde-700">Salvo.</span>
        )}
        <Button type="submit" tamanho="sm" disabled={!sujo} carregando={salvando}>
          Salvar alterações
        </Button>
      </div>
    </form>
  )
}
