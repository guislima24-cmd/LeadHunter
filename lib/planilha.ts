import 'server-only'
import { google, sheets_v4 } from 'googleapis'

/**
 * Escrita direta na planilha "Prospecção - Vendas", sem passar pelo n8n.
 *
 * O nó "Gravar na Aba do Membro" do W4 fazia isso — mas o W4 é um workflow
 * n8n, e o n8n Cloud fica pausado desde que o trial expirou (ver
 * `n8n/README.md`). Esta função reimplementa a mesma lógica corrigida que
 * está documentada lá (a estrutura real da planilha não bate com a do PRD
 * original), direto no servidor Next.js: sem serviço a mais para assinar.
 *
 * Estrutura de cada aba de membro, colunas A–V (linha 1 = cabeçalho, linha 2
 * = legenda, dados a partir da linha 3):
 *   A Alvo · B Mês · C Canal · D Setor · E Empresa contatada ·
 *   F Nome do contato · G Número/Link · H Quem respondeu? ·
 *   I Data de conexão · J Quantos contatos? · K Marcou RD? · L Data RD ·
 *   M No show? · N SQL · O Marcou RP? · P Data proposta · Q Contrato? ·
 *   R Data contrato · S Motivo da recusa · T Ciclo de conversão ·
 *   U Observações · V ID_Sync
 *
 * Só as colunas C, E, F, G, I, U e V são tocadas — nunca A, B, D, H nem J–T,
 * que são preenchidas à mão pelo time. Isso vale tanto para atualizar uma
 * linha existente quanto para uma nova: escrever em células isoladas em vez
 * de um intervalo contínuo evita apagar por engano o que a pessoa já digitou.
 */

const COL = {
  canal: 2, // C
  empresa: 4, // E
  nome: 5, // F
  numeroLink: 6, // G
  dataConexao: 8, // I
  observacoes: 20, // U
  idSync: 21, // V
} as const

const TOTAL_COLUNAS = 22 // A–V

export class PlanilhaNaoConfiguradaError extends Error {
  constructor(detalhe: string) {
    super(detalhe)
    this.name = 'PlanilhaNaoConfiguradaError'
  }
}

function normalizarChavePrivada(chave: string): string {
  let k = chave.trim()
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
    k = k.slice(1, -1)
  }
  k = k.replace(/\\n/g, '\n')
  return k
}

function obterCredenciais(): { client_email: string; private_key: string } {
  const bruto = process.env.GOOGLE_CREDENTIALS_JSON
  if (bruto) {
    let json: { client_email?: string; private_key?: string }
    try {
      json = JSON.parse(bruto.trim())
    } catch {
      throw new PlanilhaNaoConfiguradaError(
        'GOOGLE_CREDENTIALS_JSON não é um JSON válido.',
      )
    }
    if (!json.client_email || !json.private_key) {
      throw new PlanilhaNaoConfiguradaError(
        'GOOGLE_CREDENTIALS_JSON precisa ter client_email e private_key.',
      )
    }
    return { client_email: json.client_email, private_key: json.private_key }
  }

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const chave = process.env.GOOGLE_PRIVATE_KEY
  if (!email || !chave) {
    throw new PlanilhaNaoConfiguradaError(
      'Configure GOOGLE_CREDENTIALS_JSON, ou GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY, nas variáveis de ambiente.',
    )
  }
  return { client_email: email, private_key: normalizarChavePrivada(chave) }
}

function obterIdDaPlanilha(): string {
  const id = process.env.GOOGLE_SHEETS_ID
  if (!id) {
    throw new PlanilhaNaoConfiguradaError('GOOGLE_SHEETS_ID não configurado.')
  }
  return id
}

function obterSheets(): sheets_v4.Sheets {
  const auth = new google.auth.GoogleAuth({
    credentials: obterCredenciais(),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
  return google.sheets({ version: 'v4', auth })
}

function citarAba(nome: string): string {
  return `'${nome.replace(/'/g, "''")}'`
}

/** Blinda contra formula injection: uma célula começando com =, +, - ou @ vira fórmula ao abrir no Sheets/Excel. */
function sanear(valor: string): string {
  return /^[=+\-@]/.test(valor) ? `'${valor}` : valor
}

function dataDeHojeBr(): string {
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(new Date())
  const pegar = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? ''
  return `${pegar('day')}/${pegar('month')}/${pegar('year')}`
}

export interface CapturaLinkedIn {
  nome: string
  empresa: string
  cargo?: string
  linkedinUrl?: string
}

export interface ResultadoCaptura {
  linha: number
  novaLinha: boolean
}

/**
 * Grava (ou atualiza, se já existir pelo `linkedin_url`) a captura na aba do
 * membro. Espelha o que o teste do W4 documentado no `n8n/README.md`
 * validou: "casou a linha existente por Número/Link, preservou o ID_Sync,
 * formatou a data em DD/MM/AAAA e anexou o cargo em Observações".
 */
export async function registrarCapturaNaPlanilha(
  aba: string,
  captura: CapturaLinkedIn,
): Promise<ResultadoCaptura> {
  const sheets = obterSheets()
  const spreadsheetId = obterIdDaPlanilha()
  const intervalo = `${citarAba(aba)}!A1:V`

  const leitura = await sheets.spreadsheets.values.get({ spreadsheetId, range: intervalo })
  const linhas = leitura.data.values ?? []

  const linkedinUrl = captura.linkedinUrl?.trim() || ''
  const cargo = captura.cargo?.trim() || ''

  // Dados começam na linha 3 (índice 2): linha 1 é cabeçalho, linha 2 é legenda.
  let indiceExistente = -1
  if (linkedinUrl) {
    indiceExistente = linhas.findIndex(
      (l, i) => i >= 2 && (l[COL.numeroLink] ?? '').trim() === linkedinUrl,
    )
  }

  const dataConexao = dataDeHojeBr()

  if (indiceExistente >= 0) {
    const linhaAtual = linhas[indiceExistente]
    const numeroDaLinha = indiceExistente + 1 // 1-based, igual à planilha

    const idSyncExistente = (linhaAtual[COL.idSync] ?? '').trim()
    const idSync = idSyncExistente || crypto.randomUUID()

    const obsExistente = (linhaAtual[COL.observacoes] ?? '').trim()
    const linhaCargo = cargo ? `Cargo: ${sanear(cargo)}` : ''
    const novaObs =
      linhaCargo && !obsExistente.includes(linhaCargo)
        ? [obsExistente, linhaCargo].filter(Boolean).join(' | ')
        : obsExistente

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'RAW',
        data: [
          { range: `${citarAba(aba)}!C${numeroDaLinha}`, values: [['LinkedIn']] },
          { range: `${citarAba(aba)}!E${numeroDaLinha}`, values: [[sanear(captura.empresa)]] },
          { range: `${citarAba(aba)}!F${numeroDaLinha}`, values: [[sanear(captura.nome)]] },
          { range: `${citarAba(aba)}!G${numeroDaLinha}`, values: [[linkedinUrl]] },
          { range: `${citarAba(aba)}!I${numeroDaLinha}`, values: [[dataConexao]] },
          { range: `${citarAba(aba)}!U${numeroDaLinha}`, values: [[novaObs]] },
          { range: `${citarAba(aba)}!V${numeroDaLinha}`, values: [[idSync]] },
        ],
      },
    })

    await garantirCabecalhoIdSync(sheets, spreadsheetId, aba, linhas)
    return { linha: numeroDaLinha, novaLinha: false }
  }

  const novaLinha = new Array(TOTAL_COLUNAS).fill('')
  novaLinha[COL.canal] = 'LinkedIn'
  novaLinha[COL.empresa] = sanear(captura.empresa)
  novaLinha[COL.nome] = sanear(captura.nome)
  novaLinha[COL.numeroLink] = linkedinUrl
  novaLinha[COL.dataConexao] = dataConexao
  novaLinha[COL.observacoes] = cargo ? `Cargo: ${sanear(cargo)}` : ''
  novaLinha[COL.idSync] = crypto.randomUUID()

  const anexo = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${citarAba(aba)}!A:V`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [novaLinha] },
  })

  await garantirCabecalhoIdSync(sheets, spreadsheetId, aba, linhas)

  const intervaloEscrito = anexo.data.updates?.updatedRange ?? ''
  const numeroDaLinha = Number(intervaloEscrito.match(/(\d+)(?::|$)/)?.[1] ?? 0)
  return { linha: numeroDaLinha || linhas.length + 1, novaLinha: true }
}

/**
 * `ID_Sync` na célula V1 é um pré-requisito manual documentado em
 * `n8n/README.md` que nem sempre foi feito em toda aba. Como esta função já
 * está escrevendo na aba mesmo assim (a coluna V funciona sem cabeçalho),
 * aproveita para corrigir o cabeçalho que falta, em vez de deixar a mesma
 * pegadinha esperando o próximo workflow que precisar dela.
 */
async function garantirCabecalhoIdSync(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  aba: string,
  linhasOriginais: string[][],
): Promise<void> {
  const cabecalho = (linhasOriginais[0]?.[COL.idSync] ?? '').trim()
  if (cabecalho) return
  try {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${citarAba(aba)}!V1`,
      valueInputOption: 'RAW',
      requestBody: { values: [['ID_Sync']] },
    })
  } catch {
    // Não crítico: a captura em si já foi gravada.
  }
}
