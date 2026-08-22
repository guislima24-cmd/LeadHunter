# Núcleo Comercial — UFABC Júnior

Plataforma comercial única, que substitui o **Lead Hunter** e o **Prospect AI**
como ferramentas separadas. Toda a operação — buscar, enriquecer, prospectar,
acompanhar o funil e monitorar as automações — mora aqui.

O trabalho pesado continua no n8n (nove workflows, documentados em
[`n8n/README.md`](n8n/README.md)). A plataforma é a porta de entrada: dispara os
workflows com a identidade certa e mostra o resultado.

## Stack

- **Next.js 16.2** (App Router) + React 19
- **Tailwind CSS 4** — tokens de marca em `app/globals.css`
- **Supabase** — Postgres e autenticação
- **n8n** — automações (instância `guizo.app.n8n.cloud`)

> ⚠️ No Next.js 16 o antigo `middleware.ts` passou a se chamar **`proxy.ts`**.
> É lá que a sessão é renovada e o acesso anônimo é barrado.

## Módulos

| Rota | O que faz | Workflow |
|---|---|---|
| `/` | Quadro de negócios (kanban) do time e, abaixo, o panorama da operação: leads na base, listas, emails, reservas, enriquecimento e funil de prospecção | — |
| `/negocios/[id]` | Ficha do negócio: etapa, campos editáveis, empresa, contatos e linha do tempo (atividades + passagens de etapa) | — |
| `/buscar` | Filtra a base da Receita Federal, pré-visualiza e gera lista com dedupe + reserva de 24 h | W1 → W2 |
| `/listas` · `/listas/[id]` | Listas geradas, enriquecimento por lead e disparo da prospecção por email | W2, W3 |
| `/maps` | Prospecção de negócios locais por setor e cidade, com análise da IA | W5 |
| `/pipeline` | Redireciona para `/` — o quadro deixou de ter aba própria | — |
| `/monitoramento` | Falhas das automações e consumo de Tavily/Maps — **só administradores** | W9 |

## Como rodar

```bash
npm install
cp .env.example .env.local   # preencha as chaves
npm run dev
```

Todas as variáveis estão descritas em [`.env.example`](.env.example). Duas
merecem atenção:

- `SUPABASE_SERVICE_ROLE_KEY` — **nunca** prefixe com `NEXT_PUBLIC_`. Ela ignora
  RLS e só pode existir no servidor.
- `N8N_WEBHOOK_BASE` — base dos webhooks, sem barra no final.

## Decisões de arquitetura

**Os webhooks do n8n são sempre chamados pelo servidor.** A URL da instância não
vai para o navegador, não há CORS no caminho e — o principal — o campo `membro`
é injetado a partir da sessão. Ninguém dispara automação em nome de outra pessoa
mexendo no corpo da requisição.

**Nenhum dado de negócio é lido com a chave anon.** As páginas rodam no servidor
e usam a service role, sempre depois de `exigirMembro()`. O navegador recebe a
chave anon apenas para autenticar. O import de `server-only` em
`lib/supabase/admin.ts` faz o build quebrar se alguém tentar usar o cliente
privilegiado no cliente.

**A identidade do membro é o nome da aba da planilha.** Login com Google
restrito ao domínio `ufabcjr.com.br`; `member_profiles.aba_planilha` liga o
email à aba. Quem entra sem vínculo navega e consulta normalmente, mas não
dispara automação — a plataforma explica isso na tela em vez de dar erro.

O parâmetro `hd` do Google é só uma dica e pode ser removido da URL: a checagem
de domínio que vale é a do `app/auth/callback/route.ts`, depois da troca do
código pela sessão.

**O dashboard do funil vem do Supabase, não do Notion.** O W7 calcula as
métricas e agora grava uma fotografia na tabela `funil_metricas` além da
planilha e do Notion. Assim o app web não precisa de credencial do Google nem do
Notion para mostrar o dashboard.

## O que ainda depende de configuração

A plataforma sobe e funciona sem isso, mas alguns pedaços só se completam depois:

1. **Google como provedor no Supabase Auth** — Authentication → Providers →
   Google, com a URL de callback `<domínio>/auth/callback`. Sem isso, o botão de
   login não conclui.
2. **Vínculos de aba que faltam** — `maria.almeida@ufabcjr.com.br` ficou sem aba
   de propósito (nenhuma das 12 corresponde ao nome com certeza; a suspeita é
   `Duda`), e as abas `Daniel`, `Letícia` e `Caio Sperandio` não têm email
   cadastrado. O SQL para corrigir está em
   [`n8n/sql/002_plataforma_web.sql`](n8n/sql/002_plataforma_web.sql).
3. **Pré-requisitos dos workflows** — aba `Dashboard`, cabeçalhos `ID_Sync` e
   `Contexto Web`, data sources do Notion. A lista completa está na seção 3 do
   [`n8n/README.md`](n8n/README.md).
4. **RLS desligada em quatro tabelas** — decisão de segurança pendente,
   explicada no fim de `002_plataforma_web.sql`. A plataforma não depende dela
   para funcionar.

## Estrutura

```
app/
  (plataforma)/      páginas autenticadas (shell com barra lateral)
  api/               rotas de servidor: busca e proxies dos webhooks
  auth/              callback do OAuth e logout
  login/             porta de entrada
components/ui/       primitivos de interface
lib/
  supabase/          clientes: navegador (auth), servidor (sessão), admin (dados)
  sessao.ts          quem está logado e o que pode fazer
  n8n.ts             chamadas aos webhooks
  dados.ts           leituras da plataforma
n8n/                 documentação e SQL das automações
proxy.ts             sessão + bloqueio de acesso anônimo
```

## Marca

As cores institucionais (verde, amarelo, branco e preto) estão como tokens do
Tailwind em `app/globals.css` — `verde-*`, `amarelo-*` e `tinta-*`.

O símbolo em `components/Logo.tsx` é um desenho próprio nessas cores. Para usar
o logotipo oficial, coloque o arquivo em `public/logo-ufabcjr.svg` e troque o
`<svg>` do componente `Simbolo` por um `<Image>` — nenhum outro arquivo muda.
