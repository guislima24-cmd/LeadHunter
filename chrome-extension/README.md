# Extensão do Chrome — Núcleo Comercial

Captura perfis do LinkedIn direto para a aba do membro na planilha
"Prospecção - Vendas", e detecta **aceite de conexão** e **resposta** — dois
eventos que hoje dependem de alguém marcar à mão.

Veio do repositório `ProjetoApollo`, onde estava presa ao app antigo. O que
mudou na migração está em [`n8n/README.md`](../n8n/README.md), seção
"Extensão do Chrome".

> **Estado dos detectores.** A captura de perfil funcionava no ProspectAI e
> continua funcionando. Aceite e resposta **nunca chegaram a funcionar lá** —
> ver "Por que tudo passa pelo background". O bloqueio foi removido, e a rota
> do CRM está testada contra o banco, mas a leitura do DOM do LinkedIn ainda
> não foi validada contra a página real. Os seletores de
> `acceptance-detector.js` e `reply-detector.js` são o ponto frágil: o
> LinkedIn muda o markup sem aviso.

## Distribuição

O time não instala a partir desta pasta: o `.zip` é gerado no `prebuild` por
[`scripts/empacotar-extensao.mjs`](../scripts/empacotar-extensao.mjs) e servido
em `/extensao-nucleo-comercial.zip`, com o passo a passo na tela **Extensão**
do CRM. Assim o que o time baixa é sempre o código deste diretório — não há
um zip separado para lembrar de atualizar.

Os ícones em `icons/` são PNG de verdade. Vieram do ProjetoApollo como buffers
RGBA crus com extensão `.png`, e o Chrome recusa o manifest inteiro quando não
consegue ler um ícone declarado.

## Instalar (desenvolvimento, direto desta pasta)

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

Os detectores chamavam a API direto na versão antiga, com
`credentials: 'include'`. O `next.config.ts` do ProjetoApollo respondia
`Access-Control-Allow-Origin: *` junto com `Access-Control-Allow-Credentials:
true` — combinação inválida pela especificação de CORS, que o navegador
rejeita. Toda chamada dos detectores morria antes de chegar ao servidor. A
captura de perfil escapava porque já passava pelo service worker.

Aqui os detectores mandam mensagem para o `background.js`, que faz a chamada.

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
