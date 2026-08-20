'use client'
import { useState } from 'react'
import { Card, CardCabecalho } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Campo, Entrada, AreaTexto } from '@/components/ui/Campo'
import { Badge } from '@/components/ui/Badge'
import { formatarNumero, formatarDataHora } from '@/lib/formato'
import { PLANILHA_URL } from '@/lib/constantes'

interface Resultado {
  setor: string
  cidadesProcessadas: number
  cidadesBloqueadas: number
  mensagemOrcamento: string
  totalAcumulado: number
  concluidoEm: string
}

export function FormularioMaps({ habilitado }: { habilitado: boolean }) {
  const [setor, setSetor] = useState('')
  const [cidadesTexto, setCidadesTexto] = useState('')
  const [limite, setLimite] = useState(10)
  const [usarIA, setUsarIA] = useState(true)
  const [rodando, setRodando] = useState(false)
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const cidades = cidadesTexto
    .split(/[\n,;]/)
    .map((c) => c.trim())
    .filter(Boolean)

  async function buscar() {
    setRodando(true)
    setErro(null)
    setResultado(null)
    try {
      const resposta = await fetch('/api/maps/buscar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setor, cidades, limite, useAI: usarIA }),
      })
      const dados = await resposta.json()
      if (!resposta.ok) {
        setErro(dados.mensagem ?? 'Não foi possível concluir a busca.')
        return
      }
      setResultado(dados)
    } catch {
      setErro(
        'A busca perdeu a conexão. Ela pode ter continuado rodando no n8n — confira a planilha antes de disparar de novo.',
      )
    } finally {
      setRodando(false)
    }
  }

  const podeEnviar = habilitado && setor.trim() !== '' && cidades.length > 0

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr] lg:items-start">
      <Card>
        <CardCabecalho
          titulo="Nova busca"
          descricao="Uma busca por setor, em quantas cidades você quiser."
        />
        <div className="space-y-4 p-5">
          <Campo rotulo="Setor" id="setor-maps" dica="como no Maps">
            <Entrada
              id="setor-maps"
              value={setor}
              placeholder="academias, clínicas odontológicas…"
              onChange={(e) => setSetor(e.target.value)}
            />
          </Campo>

          <Campo
            rotulo="Cidades"
            id="cidades"
            dica={cidades.length > 0 ? `${cidades.length} de 10` : 'até 10'}
          >
            <AreaTexto
              id="cidades"
              rows={4}
              value={cidadesTexto}
              placeholder={'São Paulo\nSanto André\nSão Bernardo do Campo'}
              onChange={(e) => setCidadesTexto(e.target.value)}
            />
          </Campo>
          <p className="-mt-2 text-xs text-tinta-500">
            Uma por linha (ou separadas por vírgula).
          </p>

          <Campo rotulo="Empresas por cidade" id="limite" dica="máx. 60">
            <Entrada
              id="limite"
              type="number"
              min={1}
              max={60}
              value={limite}
              onChange={(e) => setLimite(Number(e.target.value))}
            />
          </Campo>

          <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-tinta-200 p-3 transition-colors hover:bg-tinta-50">
            <input
              type="checkbox"
              checked={usarIA}
              onChange={(e) => setUsarIA(e.target.checked)}
              className="mt-0.5 size-4 accent-[#0b7a3b]"
            />
            <span>
              <span className="block text-sm font-semibold text-tinta-800">
                Analisar com IA
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-tinta-500">
                Preenche potencial, dores típicas, serviços sugeridos e
                argumento de abertura de cada empresa.
              </span>
            </span>
          </label>

          <Button
            onClick={buscar}
            carregando={rodando}
            disabled={!podeEnviar}
            larguraTotal
          >
            Buscar no Maps
          </Button>

          {!habilitado && (
            <p className="text-xs text-tinta-500">
              Disponível assim que sua aba da planilha for vinculada.
            </p>
          )}
          {rodando && (
            <p className="text-xs leading-relaxed text-tinta-500">
              Pode levar alguns minutos: cada cidade é uma rodada de busca no
              Places somada à análise da IA. Não feche a aba.
            </p>
          )}
        </div>
      </Card>

      <div className="min-w-0 space-y-4">
        {erro && (
          <div className="rounded-cartao border border-perigo-100 bg-perigo-50 px-4 py-3 text-sm leading-relaxed text-perigo-700">
            {erro}
          </div>
        )}

        {resultado && (
          <Card className="surgir border-verde-200">
            <CardCabecalho
              titulo="Busca concluída"
              descricao={`${resultado.setor} · ${formatarDataHora(resultado.concluidoEm)}`}
            />
            <div className="grid gap-4 p-5 sm:grid-cols-3">
              <div>
                <p className="text-[0.7rem] font-semibold tracking-wide text-tinta-500 uppercase">
                  Cidades processadas
                </p>
                <p className="numerico mt-1 font-titulo text-2xl font-extrabold text-verde-700">
                  {formatarNumero(resultado.cidadesProcessadas)}
                </p>
              </div>
              <div>
                <p className="text-[0.7rem] font-semibold tracking-wide text-tinta-500 uppercase">
                  Bloqueadas por orçamento
                </p>
                <p className="numerico mt-1 font-titulo text-2xl font-extrabold text-tinta-900">
                  {formatarNumero(resultado.cidadesBloqueadas)}
                </p>
              </div>
              <div>
                <p className="text-[0.7rem] font-semibold tracking-wide text-tinta-500 uppercase">
                  Total já coletado
                </p>
                <p className="numerico mt-1 font-titulo text-2xl font-extrabold text-tinta-900">
                  {formatarNumero(resultado.totalAcumulado)}
                </p>
              </div>
            </div>

            {resultado.mensagemOrcamento && (
              <div className="mx-5 mb-5 rounded-lg border border-amarelo-200 bg-amarelo-50 px-3.5 py-2.5">
                <Badge tom="amarelo">Orçamento</Badge>
                <p className="mt-1.5 text-xs leading-relaxed text-amarelo-700">
                  {resultado.mensagemOrcamento}
                </p>
              </div>
            )}

            <div className="border-t border-tinta-200 px-5 py-4">
              <a
                href={`${PLANILHA_URL}#gid=0`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold text-verde-700 hover:underline"
              >
                Abrir os leads na aba “Leads Maps” →
              </a>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
