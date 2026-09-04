// background.js — o único ponto da extensão que fala com o CRM.
//
// Tudo passa por aqui de propósito, e não é organização: é exigência do
// Manifest V3. Um `fetch` disparado de content script sai com a origem da
// página (linkedin.com) e é barrado por CORS; o mesmo `fetch` disparado do
// service worker, para um host declarado em `host_permissions`, não passa por
// CORS nenhum. Os detectores, então, mandam mensagem para cá em vez de
// chamarem a API direto — que é o que faziam na versão do ProspectAI.

const API_BASE_DEV = 'http://localhost:3000'
const API_BASE_PROD = 'https://lead-hunter-eight.vercel.app'

async function getApiBase() {
  const { usarProducao } = await chrome.storage.local.get('usarProducao')
  return usarProducao === false ? API_BASE_DEV : API_BASE_PROD
}

/**
 * O token que o membro gerou em Configurações → Extensão no CRM.
 *
 * Substitui o `sessionToken` da versão antiga, que era um cookie do NextAuth
 * copiado do navegador. Aquele caminho não existe aqui: o CRM autentica com
 * Supabase, cujo cookie é httpOnly e rotaciona — o service worker nunca teria
 * como acompanhar. O token é credencial própria, revogável na tela do CRM.
 */
async function getToken() {
  const { extensaoToken } = await chrome.storage.local.get('extensaoToken')
  return extensaoToken ?? null
}

async function chamarCrm(caminho, corpo) {
  const [token, apiBase] = await Promise.all([getToken(), getApiBase()])
  if (!token) return { ok: false, erro: 'sem_token' }

  try {
    const res = await fetch(`${apiBase}${caminho}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Extensao-Token': token,
      },
      body: JSON.stringify(corpo),
    })

    const dados = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { ok: false, erro: dados.erro ?? 'falha', mensagem: dados.mensagem }
    }
    return { ok: true, dados }
  } catch {
    return { ok: false, erro: 'sem_conexao' }
  }
}

// ── Fila local ──────────────────────────────────────────────────────────────
// Capturar um perfil é um gesto que a pessoa faz uma vez; se a rede cair ou o
// token estiver faltando, perder a captura em silêncio seria o pior desfecho.

async function getFila() {
  const { filaPendente = [] } = await chrome.storage.local.get('filaPendente')
  return filaPendente
}

async function enfileirar(payload) {
  const fila = await getFila()
  fila.push({ ...payload, enfileiradoEm: Date.now() })
  await chrome.storage.local.set({ filaPendente: fila })
}

async function esvaziarFila() {
  const fila = await getFila()
  if (!fila.length) return
  const falharam = []
  for (const item of fila) {
    const r = await enviarCaptura(item)
    if (!r.ok) falharam.push(item)
  }
  await chrome.storage.local.set({ filaPendente: falharam })
}

// ── Captura de perfil ───────────────────────────────────────────────────────

async function salvarRecente(lead) {
  const { leadsRecentes = [] } = await chrome.storage.local.get('leadsRecentes')
  await chrome.storage.local.set({
    leadsRecentes: [lead, ...leadsRecentes].slice(0, 10),
  })
}

async function enviarCaptura(payload) {
  return chamarCrm('/api/extensao/prospeccao', {
    nome: payload.nome ?? '',
    empresa: payload.empresa ?? '',
    cargo: payload.cargo ?? '',
    linkedinUrl: payload.pageUrl ?? payload.linkedinUrl ?? '',
  })
}

function avisar(titulo, mensagem) {
  chrome.notifications?.create({
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon48.png'),
    title: titulo,
    message: mensagem,
  })
}

// ── Listener ────────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'SALVAR_TOKEN') {
    chrome.storage.local.set({ extensaoToken: message.token })
    sendResponse({ ok: true })
    return false
  }

  if (message.type === 'PROSPECCAO_DETECTADA') {
    ;(async () => {
      if (!navigator.onLine) {
        await enfileirar(message.payload)
        sendResponse({ enfileirado: true })
        return
      }

      const r = await enviarCaptura(message.payload)

      if (r.ok) {
        await salvarRecente({
          ...message.payload,
          linha: r.dados?.linha ?? null,
          salvoEm: Date.now(),
        })
        avisar(
          'Registrado',
          `${message.payload.nome || 'Lead'} salvo na aba ${r.dados?.aba ?? 'da planilha'}.`,
        )
        sendResponse({ ok: true })
        return
      }

      // Token ausente ou recusado não é problema de rede: enfileirar só
      // adiaria o mesmo erro. A pessoa precisa saber agora.
      if (r.erro === 'sem_token' || r.erro === 'token_invalido') {
        avisar(
          'Conecte a extensão',
          'Abra o popup e cole o token gerado no CRM, em Extensão.',
        )
        sendResponse({ ok: false, erro: r.erro })
        return
      }

      await enfileirar(message.payload)
      avisar(
        'Na fila',
        r.mensagem ?? 'Sem conexão agora — vai ser enviado automaticamente.',
      )
      sendResponse({ enfileirado: true })
    })()
    return true
  }

  // Aceites de conexão e respostas, vindos dos detectores. Eles não chamam a
  // API direto por causa do CORS explicado no topo deste arquivo.
  if (message.type === 'EVENTOS_LINKEDIN') {
    ;(async () => {
      const r = await chamarCrm('/api/extensao/eventos', {
        tipoEvento: message.tipoEvento,
        pessoas: message.pessoas,
      })
      sendResponse(r)
    })()
    return true
  }

  return false
})

chrome.runtime.onInstalled.addListener(esvaziarFila)
chrome.runtime.onStartup.addListener(esvaziarFila)
