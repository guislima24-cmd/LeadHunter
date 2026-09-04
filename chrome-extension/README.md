# Extensão do Chrome — Núcleo Comercial

Captura perfis do LinkedIn direto para a aba do membro na planilha
"Prospecção - Vendas", e detecta sozinha dois eventos que antes dependiam de
alguém marcar à mão: **aceite de conexão** e **resposta**.

Veio do repositório `ProjetoApollo`, onde estava presa ao app antigo. O que
mudou na migração está em [`n8n/README.md`](../n8n/README.md), seção
"Extensão do Chrome".

## Instalar

1. No CRM, abra **Extensão** e gere um token. Ele aparece uma vez só.
2. `chrome://extensions` → ative o **Modo do desenvolvedor**.
3. **Carregar sem compactação** → aponte para esta pasta.
4. Abra o popup da extensão, cole o token e clique em **Conectar**.

A `key` no `manifest.json` fixa o ID da extensão. Quem já tinha a versão
antiga instalada continua com o mesmo ID — é atualização, não instalação nova.

## O que cada arquivo faz

| Arquivo | Papel |
|---|---|
| `background.js` | **Único ponto que fala com o CRM.** Guarda o token, envia captura e eventos, mantém a fila de quando falta rede |
| `content.js` | Lê o perfil aberto no LinkedIn (nome, empresa, cargo) |
| `interceptor.js` | Roda no mundo da página e avisa quando um convite é enviado |
| `acceptance-detector.js` | Em `/mynetwork`, compara conexões aceitas com os seus contatos |
| `reply-detector.js` | Em `/messaging`, detecta quem respondeu (ignora o que você mesmo enviou) |
| `popup.js` · `popup.html` | Conectar/desconectar e ver as últimas capturas |

## Por que tudo passa pelo background

No Manifest V3, um `fetch` disparado de content script sai com a origem da
página (`linkedin.com`) e é barrado por CORS. O mesmo `fetch` disparado do
service worker, para um host declarado em `host_permissions`, não passa por
CORS nenhum.

Os detectores chamavam a API direto na versão antiga. Aqui eles mandam
mensagem para o `background.js`, que faz a chamada.

## Rotas que ela usa no CRM

| Rota | Quando |
|---|---|
| `POST /api/extensao/prospeccao` | Captura de perfil → repassa ao W4, que grava na planilha e no Postgres |
| `POST /api/extensao/eventos` | Aceite e resposta → `funil_prospeccao_eventos` |

Todas exigem o cabeçalho `X-Extensao-Token`. O token é revogável a qualquer
momento na tela **Extensão** do CRM.

## Ambiente

O padrão é produção. Para apontar para o `localhost:3000` durante o
desenvolvimento, no console do service worker:

```js
chrome.storage.local.set({ usarProducao: false })
```
