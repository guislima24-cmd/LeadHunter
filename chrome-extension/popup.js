// popup.js — conectar a extensão ao CRM e ver o que foi capturado.
//
// A versão do ProspectAI tentava ler o cookie de sessão do app com a permissão
// `cookies` e copiá-lo para o storage. Aqui não: o CRM autentica com Supabase,
// cujo cookie é httpOnly e rotaciona sozinho — o service worker nunca
// conseguiria acompanhar. Em vez disso, o membro gera um token no CRM e cola
// aqui uma vez. Foi por isso que a permissão `cookies` saiu do manifest.

const CRM_URL = 'https://lead-hunter-eight.vercel.app/extensao'

const $ = (id) => document.getElementById(id)

function formatarQuando(ms) {
  const s = Math.round((Date.now() - ms) / 1000)
  if (s < 60) return 'agora'
  if (s < 3600) return `há ${Math.round(s / 60)} min`
  if (s < 86400) return `há ${Math.round(s / 3600)} h`
  return `há ${Math.round(s / 86400)} d`
}

async function pintarEstado() {
  const { extensaoToken } = await chrome.storage.local.get('extensaoToken')
  const conectado = Boolean(extensaoToken)

  $('estado').className = `estado ${conectado ? 'ok' : 'off'}`
  $('estadoTexto').textContent = conectado
    ? 'Conectado ao CRM'
    : 'Não conectado'
  $('blocoToken').hidden = conectado
  $('blocoConectado').hidden = !conectado
}

async function pintarRecentes() {
  const { leadsRecentes = [], filaPendente = [] } =
    await chrome.storage.local.get(['leadsRecentes', 'filaPendente'])

  const lista = $('recentes')
  lista.innerHTML = ''
  $('semRecentes').hidden = leadsRecentes.length > 0

  for (const lead of leadsRecentes) {
    const li = document.createElement('li')
    const b = document.createElement('b')
    b.textContent = lead.nome || 'Sem nome'
    const span = document.createElement('span')
    span.textContent = [lead.empresa, formatarQuando(lead.salvoEm)]
      .filter(Boolean)
      .join(' · ')
    li.append(b, span)
    lista.appendChild(li)
  }

  const fila = $('fila')
  fila.hidden = filaPendente.length === 0
  if (filaPendente.length) {
    fila.textContent =
      filaPendente.length === 1
        ? '1 captura na fila, aguardando conexão.'
        : `${filaPendente.length} capturas na fila, aguardando conexão.`
  }
}

$('salvar').addEventListener('click', async () => {
  const token = $('token').value.trim()
  if (!token.startsWith('lhx_')) {
    $('estado').className = 'estado off'
    $('estadoTexto').textContent = 'Token inválido — ele começa com lhx_'
    return
  }
  await chrome.runtime.sendMessage({ type: 'SALVAR_TOKEN', token })
  $('token').value = ''
  await pintarEstado()
})

$('desconectar').addEventListener('click', async () => {
  await chrome.storage.local.remove('extensaoToken')
  await pintarEstado()
})

$('abrirCrm').addEventListener('click', (e) => {
  e.preventDefault()
  chrome.tabs.create({ url: CRM_URL })
})

pintarEstado()
pintarRecentes()
