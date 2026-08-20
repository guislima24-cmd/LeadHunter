import Link from 'next/link'
import { Cabecalho } from '@/components/layout/Cabecalho'
import { Card } from '@/components/ui/Card'
import { Tabela, Th, Td, Tr } from '@/components/ui/Tabela'
import { EstadoVazio } from '@/components/ui/Estado'
import { exigirMembro } from '@/lib/sessao'
import { listarListas } from '@/lib/dados'
import { formatarNumero, formatarDataHora, tempoRelativo } from '@/lib/formato'

export const metadata = { title: 'Minhas listas' }

export default async function PaginaListas() {
  const membro = await exigirMembro()
  const listas = membro.abaPlanilha ? await listarListas(membro.abaPlanilha) : []

  return (
    <>
      <Cabecalho
        titulo="Minhas listas"
        descricao="Cada lista reserva os leads no seu nome por 24 horas e passa pelo enriquecimento com IA."
        acao={
          <Link
            href="/buscar"
            className="inline-flex h-10 items-center rounded-lg bg-verde-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-verde-700"
          >
            Gerar nova lista
          </Link>
        }
      />

      <Card>
        {listas.length === 0 ? (
          <EstadoVazio
            titulo="Você ainda não gerou listas"
            descricao="Comece pela busca: escolha setor e cidade, confira a pré-visualização e gere a lista."
            acao={
              <Link
                href="/buscar"
                className="inline-flex h-9 items-center rounded-lg bg-verde-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-verde-700"
              >
                Buscar leads
              </Link>
            }
          />
        ) : (
          <Tabela>
            <thead>
              <tr>
                <Th>Setor</Th>
                <Th>Cidade</Th>
                <Th className="text-right">Leads</Th>
                <Th>Criada em</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {listas.map((lista) => (
                <Tr key={lista.id}>
                  <Td className="font-semibold text-tinta-900">
                    {lista.setor || 'Sem setor'}
                  </Td>
                  <Td className="text-tinta-600">{lista.cidade || '—'}</Td>
                  <Td className="numerico text-right font-semibold">
                    {formatarNumero(lista.quantidadeLeads)}
                  </Td>
                  <Td className="whitespace-nowrap text-tinta-600">
                    {formatarDataHora(lista.criadaEm)}
                    <span className="ml-1.5 text-xs text-tinta-400">
                      {tempoRelativo(lista.criadaEm)}
                    </span>
                  </Td>
                  <Td className="text-right">
                    <Link
                      href={`/listas/${lista.id}`}
                      className="text-xs font-semibold whitespace-nowrap text-verde-700 hover:text-verde-800 hover:underline"
                    >
                      Abrir →
                    </Link>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Tabela>
        )}
      </Card>
    </>
  )
}
