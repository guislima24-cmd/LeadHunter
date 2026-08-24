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
| `/` | Panorama da operação: números do funil, gráficos e o volume bruto da prospecção (leads na base, listas, emails, reservas) | — |
| `/negocios` | **Kanban** — o funil do time, a visualização padrão da aba | — |
| `/negocios/lista` | **Lista** — tabela paginada e filtrável, a única que mostra também os fechados | — |
| `/negocios/funil` | **Funil** — o funil em formato de funil, largura proporcional por etapa | — |
| `/negocios/previsao` | **Previsão** — abertos agrupados pelo mês da previsão de fechamento | — |
| `/negocios/reagendados` | **Reagendados** — perdidos por "momento errado", com briefing e data de retomada | — |
| `/negocios/[id]` | Ficha do negócio: etapa, campos editáveis, empresa, contatos e linha do tempo (atividades + passagens de etapa) | — |
| `/buscar` | Filtra a base da Receita Federal, pré-visualiza e gera lista com dedupe + reserva de 24 h | W1 → W2 |
| `/listas` · `/listas/[id]` | Listas geradas, enriquecimento por lead, disparo da prospecção e registro de aceite/resposta | W2, W3 |
| `/maps` | Prospecção de negócios locais por setor e cidade, com análise da IA | W5 |
| `/insights` | Painel: funil de prospecção, conversão, ganhos × perdidos, ranking e metas, com filtro de período | — |
| `/insights/metas` | Metas e OKRs — leitura para todos, escrita **só administradores** | — |
| `/insights/relatorios` · `/insights/relatorios/[id]` | Relatórios mensais, com os números do mês congelados junto | — |
| `/insights/relatorios/gerar` | Gera o relatório do mês com IA (nasce rascunho) ou à mão | — |
| `/pipeline` | Redireciona para `/negocios` — o quadro deixou de ter aba própria | — |
| `/precificacao` | Orçamentos abertos e o resumo da régua de preço | — |
| `/precificacao/[id]` | Calculadora do orçamento: serviços, esforço, complexidade do escopo e os três níveis de preço | — |
| `/precificacao/referencia` | A régua editável — taxa/hora por porte, pontos de complexidade, capacidade e impostos — **só administradores** | — |
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

## Desempenho

Quatro coisas dominavam o tempo de resposta, e todas foram medidas antes de mexer:

**A aplicação rodava longe do banco.** Supabase em `sa-east-1` (São Paulo), funções da Vercel no padrão `iad1` (Washington) — ~120 ms de ida e volta em *toda* consulta. `vercel.json` fixa `regions: ["gru1"]` (São Paulo): banco, servidor e usuários no mesmo continente. Mexer nisso é uma linha e vale mais que qualquer otimização de consulta.

**A sessão era validada três vezes por navegação.** O `proxy.ts` valida (e precisa: é ele que renova o cookie), o layout da plataforma chama `exigirMembro()` e cada página chama de novo. Como `auth.getUser()` é chamada de rede, eram três idas e voltas antes de a página buscar o próprio dado. `obterMembro` agora é `cache()` do React, o que funde as duas do lado do React numa só — por requisição, nunca entre usuários.

**`count(*)` numa tabela de 1,67 milhão de linhas.** O card "leads na base" do Início custava 149 ms com as páginas quentes no cache e **2.776 ms** com elas frias — 20x mais que qualquer outra consulta da aplicação. Virou `contar_leads_estimado()`, que lê `pg_class.reltuples` (a mesma estimativa que o planejador usa) em **1,2 ms**. Na aferição, estimativa e contagem real batiam no dígito. O número só muda quando a base da Receita Federal é recarregada.

**A Previsão fazia uma consulta por mês.** Agora é uma só, agrupada em memória.

O resto do banco está saudável: nenhuma outra consulta da plataforma passa de 6 ms.

### Por que a tela parecia não responder ao clique

Sintoma relatado: "tenho que dar dois cliques para abrir qualquer coisa". Não era clique perdido — era ausência de resposta visual.

No App Router, navegar para uma página dinâmica não muda nada na tela até o servidor responder: a página antiga fica congelada, sem spinner nem barra de progresso. Para quem clicou, é indistinguível de um clique que não pegou.

Cada rota da plataforma tem agora um `loading.tsx` com um esqueleto no formato da página que vem depois. Isso resolve dois problemas de uma vez: a troca acontece no mesmo quadro do clique, e o `<Link>` do Next passa a conseguir pré-carregar a rota — sem uma fronteira de `loading`, rota dinâmica não é pré-carregada de jeito nenhum.

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
  precificacao.ts    a fórmula do orçamento (mesma no cliente e no servidor)
  orcamentos.ts      leituras do módulo de precificação
  negocios.ts        Lista, Funil, Previsão e Reagendados
  insights.ts        painel, metas e relatórios (server-only)
  tipos-insights.ts  os tipos e rótulos de Insights que o navegador também usa
  relatorio-ia.ts    redação do relatório mensal pela API da Anthropic
  cores-grafico.ts   a paleta validada dos gráficos
n8n/                 documentação e SQL das automações
proxy.ts             sessão + bloqueio de acesso anônimo
```

## Marca

As cores institucionais (verde, amarelo, branco e preto) estão como tokens do
Tailwind em `app/globals.css` — `verde-*`, `amarelo-*` e `tinta-*`.

O símbolo em `components/Logo.tsx` é um desenho próprio nessas cores. Para usar
o logotipo oficial, coloque o arquivo em `public/logo-ufabcjr.svg` e troque o
`<svg>` do componente `Simbolo` por um `<Image>` — nenhum outro arquivo muda.
