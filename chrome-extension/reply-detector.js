// reply-detector.js — Detecta respostas no LinkedIn Messaging e marca o lead como respondeu
// Ativado em: https://www.linkedin.com/messaging/
// REGRA: leads com status=respondeu jamais recebem followup (aplicada no servidor)

const SCAN_INTERVAL_MS = 30_000
const STORAGE_KEY      = 'respostasReportadas'

async function getReportados() {
  const { [STORAGE_KEY]: arr = [] } = await chrome.storage.local.get(STORAGE_KEY)
  return new Set(arr)
}

async function saveReportados(set) {
  await chrome.storage.local.set({ [STORAGE_KEY]: [...set] })
}

function normalizeText(t) {
  return (t ?? '').toLowerCase().trim()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
}

function myNameNormalized() {
  const el = document.querySelector('.global-nav__me-photo')
    ?? document.querySelector('[data-control-name="nav.settings"]')
  return normalizeText(el?.getAttribute('alt') ?? '')
}

// ── Scan da lista de threads (painel esquerdo) ────────────────────────────────

function scanThreadList() {
  const replies = []
  const myName  = myNameNormalized()

  const threads = document.querySelectorAll(
    '.msg-conversation-listitem, .msg-conversations-container__convo-item',
  )

  for (const thread of threads) {
    const nomeEl = thread.querySelector(
      '.msg-conversation-listitem__participant-names, .msg-conversation-card__participant-names',
    )
    const nome = nomeEl?.innerText?.trim()
    if (!nome) continue

    const snippetEl = thread.querySelector(
      '.msg-conversation-listitem__message-snippet, .msg-conversation-card__message-snippet',
    )
    const snippet = (snippetEl?.innerText ?? '').trim()

    // Ignora mensagens enviadas pelo usuário logado
    const normSnippet = normalizeText(snippet)
    const ehMinha =
      snippet.startsWith('Você:') ||
      snippet.startsWith('You:') ||
      (myName && normSnippet.startsWith(myName + ':'))

    if (!ehMinha && snippet.length > 0) {
      replies.push(nome)
    }
  }

  return replies
}

// ── Scan da conversa aberta (painel direito) ──────────────────────────────────

function scanActiveConversation() {
  const myName = myNameNormalized()

  // Título da conversa aberta
  const headerEl = document.querySelector(
    '.msg-thread__link-to-profile, .msg-entity-lockup__entity-title, [data-control-name="overlay.view_thread_profile_page"]',
  )
  const nomeContato = headerEl?.innerText?.trim()
  if (!nomeContato) return null

  // Busca a última mensagem visível
  const bubbles = Array.from(document.querySelectorAll(
    '.msg-s-event-listitem, .msg-s-message-list__event',
  ))

  const ultimaBolha = bubbles[bubbles.length - 1]
  if (!ultimaBolha) return null

  const msgEl = ultimaBolha.querySelector(
    '.msg-s-event__content, .msg-s-message-group__meta',
  )
  const texto = (msgEl?.innerText ?? '').trim()

  // Verifica se é mensagem do CONTATO (não minha)
  const senderEl = ultimaBolha.querySelector(
    '.msg-s-message-group__profile-link, .msg-s-event__profile-link',
  )
  const senderName = normalizeText(senderEl?.innerText ?? '')
  const ehMinha = senderName === myName || senderName === '' // empty sender = self in some layouts

  if (!ehMinha && texto.length > 0) {
    return nomeContato
  }
  return null
}

// ── Reporta ao servidor ───────────────────────────────────────────────────────

// Via background: um fetch daqui sairia com a origem do LinkedIn e o CORS o
// barraria. O service worker não tem esse limite (ver background.js).
async function reportarRespostas(nomes) {
  const r = await chrome.runtime.sendMessage({
    type: 'EVENTOS_LINKEDIN',
    tipoEvento: 'resposta',
    pessoas: nomes.map(n => ({ nome: n })),
  }).catch(() => null)

  if (!r?.ok) {
    if (r?.erro) console.warn('[Núcleo Comercial] Respostas não enviadas:', r.erro)
    return false
  }

  if (r.dados?.registrados > 0) {
    console.log(`[Núcleo Comercial] ${r.dados.registrados} resposta(s) registrada(s)`)
  }
  return true
}

// ── Loop principal ────────────────────────────────────────────────────────────

async function scan() {
  const reportados = await getReportados()

  // Coleta candidatos de ambas as fontes
  const fromList   = scanThreadList()
  const fromActive = scanActiveConversation()
  const todos      = [...new Set([...fromList, ...(fromActive ? [fromActive] : [])])]

  const novos = todos.filter(n => !reportados.has(normalizeText(n)))
  if (!novos.length) return

  const enviou = await reportarRespostas(novos)
  if (!enviou) return

  for (const n of novos) reportados.add(normalizeText(n))
  await saveReportados(reportados)
}

// Aguarda DOM carregar e inicia
setTimeout(scan, 3000)
setInterval(scan, SCAN_INTERVAL_MS)
