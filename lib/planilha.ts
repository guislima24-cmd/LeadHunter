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

/** Linha 1 é o cabeçalho, linha 2 é a legenda; os dados começam na 3. */
const PRIMEIRA_LINHA_DE_DADOS = 3

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

/**
 * Escapa quebras de linha **cruas** que estejam dentro de um texto entre
 * aspas, para que `JSON.parse` aceite o valor.
 *
 * O arquivo de chave que o Google baixa traz a `private_key` com `\n`
 * escapado, que é o certo. Mas basta o JSON passar por um visualizador, um
 * formatador de editor ou o campo de texto de um painel — o da Vercel
 * inclusive — para esses `\n` virarem quebra de linha de verdade. Aí o
 * arquivo continua parecendo idêntico na tela e o `JSON.parse` recusa, porque
 * a especificação de JSON não permite caractere de controle cru dentro de uma
 * string. Consertar aqui é mais honesto do que exigir que quem for configurar
 * saiba dessa diferença invisível.
 */
function escaparQuebrasDentroDeStrings(bruto: string): string {
  let saida = ''
  let dentroDeString = false
  let escapado = false

  for (const ch of bruto) {
    if (escapado) {
      saida += ch
      escapado = false
      continue
    }
    if (ch === '\\') {
      saida += ch
      escapado = true
      continue
    }
    if (ch === '"') {
      dentroDeString = !dentroDeString
      saida += ch
      continue
    }
    if (dentroDeString && (ch === '\n' || ch === '\r' || ch === '\t')) {
      // `\r\n` vira um `\n` só: o `\r` é descartado e o `\n` seguinte escapa.
      if (ch !== '\r') saida += ch === '\n' ? '\\n' : '\\t'
      continue
    }
    saida += ch
  }

  return saida
}

/**
 * Formas em que o mesmo arquivo de chave costuma chegar aqui.
 *
 * Quem configura copia o JSON de algum lugar e cola num campo de painel, e
 * cada combinação dessas mutila o texto de um jeito que continua parecendo
 * certo na tela: visualizador de JSON copia os campos **sem** as chaves de
 * fora; editor ou campo de formulário transforma os `\n` da chave privada em
 * quebra de linha de verdade; painel guarda o valor entre aspas. Nenhuma
 * dessas é erro de quem colou — são detalhes invisíveis de ferramenta.
 *
 * Em vez de exigir a forma exata, tentamos as variantes e ficamos com a
 * primeira que produzir uma credencial completa. Só uma delas pode dar certo:
 * o critério de aceite é ter `client_email` e `private_key`, não só parsear.
 */
function* variantesDaCredencial(bruto: string): Generator<string> {
  const base = bruto.trim()
  const formas = [base]

  if (!base.startsWith('{')) formas.push(`{${base}}`)

  if (base.length > 1 && base.startsWith('"') && base.endsWith('"')) {
    const semAspas = base.slice(1, -1)
    formas.push(semAspas)
    if (!semAspas.startsWith('{')) formas.push(`{${semAspas}}`)
  }

  for (const forma of formas) {
    yield forma
    const escapada = escaparQuebrasDentroDeStrings(forma)
    if (escapada !== forma) yield escapada
  }
}

function obterCredenciais(): { client_email: string; private_key: string } {
  const bruto = process.env.GOOGLE_CREDENTIALS_JSON
  if (bruto) {
    for (const variante of variantesDaCredencial(bruto)) {
      let json: { client_email?: string; private_key?: string }
      try {
        json = JSON.parse(variante)
      } catch {
        continue
      }
      if (json?.client_email && json?.private_key) {
        return {
          client_email: json.client_email,
          private_key: normalizarChavePrivada(json.private_key),
        }
      }
    }

    const texto = bruto.trim()
    throw new PlanilhaNaoConfiguradaError(
      `GOOGLE_CREDENTIALS_JSON não pôde ser lida como credencial de conta de serviço. ` +
        `Tamanho recebido: ${texto.length} caracteres; começa com "${texto.slice(0, 1)}" e termina com "${texto.slice(-1)}". ` +
        `Esperado um JSON com client_email e private_key.`,
    )
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

export interface DiagnosticoPlanilha {
  ok: boolean
  etapa: 'credencial' | 'autenticacao' | 'acesso' | 'pronto'
  detalhe?: string
  /** Endereço da conta de serviço — é com ele que a planilha precisa ser compartilhada. */
  contaDeServico?: string
  totalDeAbas?: number
}

/**
 * Confere, de ponta a ponta e sem escrever nada, se a integração com a
 * planilha está de pé: credencial legível, autenticação aceita pelo Google e
 * planilha acessível pela conta de serviço.
 *
 * Existe porque o caminho normal de teste é caro demais para depurar: exige
 * alguém abrir o LinkedIn e mandar um convite de verdade para descobrir se a
 * configuração está certa. As três etapas falham por motivos bem diferentes
 * (JSON malformado, conta apagada, planilha não compartilhada) e a mensagem
 * de cada uma diz o que fazer.
 */
export async function verificarAcessoAPlanilha(): Promise<DiagnosticoPlanilha> {
  let credenciais: { client_email: string; private_key: string }
  try {
    credenciais = obterCredenciais()
  } catch (erro) {
    return {
      ok: false,
      etapa: 'credencial',
      detalhe: erro instanceof Error ? erro.message : 'falha desconhecida',
    }
  }

  let spreadsheetId: string
  try {
    spreadsheetId = obterIdDaPlanilha()
  } catch (erro) {
    return {
      ok: false,
      etapa: 'credencial',
      detalhe: erro instanceof Error ? erro.message : 'falha desconhecida',
      contaDeServico: credenciais.client_email,
    }
  }

  try {
    const sheets = obterSheets()
    const meta = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties.title',
    })
    return {
      ok: true,
      etapa: 'pronto',
      contaDeServico: credenciais.client_email,
      totalDeAbas: meta.data.sheets?.length ?? 0,
    }
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : 'falha desconhecida'
    // "account not found" é conta de serviço apagada; 403 é planilha não
    // compartilhada com ela. São problemas diferentes, com correções
    // diferentes, e confundir um com o outro custa uma rodada inteira.
    const ehAutenticacao =
      mensagem.includes('invalid_grant') || mensagem.includes('Invalid JWT')
    return {
      ok: false,
      etapa: ehAutenticacao ? 'autenticacao' : 'acesso',
      detalhe: mensagem,
      contaDeServico: credenciais.client_email,
    }
  }
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

  // Linha nova: calculada aqui, não pelo `values.append` do Google.
  //
  // O `append` decide sozinho onde a tabela termina, e essa decisão é uma
  // heurística que não dá para inspecionar nem prever — com a coluna A vazia
  // na maior parte das linhas desta planilha, ele já colocou captura em lugar
  // que ninguém achou. Como a aba inteira já foi lida acima para procurar
  // duplicata, o fim dos dados sai de graça, e escrever numa linha escolhida
  // por nós torna o destino previsível e conferível.
  const numeroDaLinha = Math.max(PRIMEIRA_LINHA_DE_DADOS, ultimaLinhaDoBloco(linhas) + 1)

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
        { range: `${citarAba(aba)}!U${numeroDaLinha}`, values: [[cargo ? `Cargo: ${sanear(cargo)}` : '']] },
        { range: `${citarAba(aba)}!V${numeroDaLinha}`, values: [[crypto.randomUUID()]] },
      ],
    },
  })

  await garantirCabecalhoIdSync(sheets, spreadsheetId, aba, linhas)
  return { linha: numeroDaLinha, novaLinha: true }
}

/**
 * Quantas linhas vazias seguidas significam que a tabela do time acabou.
 *
 * Não é um número mágico: é a diferença entre "a pessoa pulou uma linha" e
 * "aqui embaixo é outra coisa". Vinte linhas em branco não acontecem no meio
 * de uma lista de prospecção.
 */
const LINHAS_VAZIAS_QUE_ENCERRAM_O_BLOCO = 20

/**
 * Número (1-based) da última linha do bloco de dados que começa na linha 3.
 *
 * Para de contar ao atravessar uma sequência longa de linhas vazias, em vez
 * de pegar a última linha com conteúdo da aba inteira. O que vem depois de um
 * buraco desses não faz parte da tabela do time — é sobra lá no fim: lista de
 * apoio de dropdown, anotação solta, ou captura que uma versão anterior deste
 * código gravou no lugar errado.
 *
 * Foi exatamente essa distinção que faltou: a aba da Anna tem conteúdo perto
 * da linha 1003, então "última linha com conteúdo" mandava a captura nova para
 * a linha 1004 — fora do limite da grade, e antes disso para a 1002, onde
 * ninguém ia procurar.
 *
 * Olha a linha inteira, não uma coluna só: nesta planilha a coluna A (`Alvo`)
 * fica vazia na maioria das linhas preenchidas.
 */
function ultimaLinhaDoBloco(linhas: string[][]): number {
  let ultima = PRIMEIRA_LINHA_DE_DADOS - 1
  let vaziasSeguidas = 0

  for (let i = PRIMEIRA_LINHA_DE_DADOS - 1; i < linhas.length; i++) {
    if (linhas[i]?.some((celula) => String(celula ?? '').trim())) {
      ultima = i + 1
      vaziasSeguidas = 0
      continue
    }
    if (++vaziasSeguidas >= LINHAS_VAZIAS_QUE_ENCERRAM_O_BLOCO) break
  }

  return ultima
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
