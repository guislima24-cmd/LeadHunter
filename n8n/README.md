# Automação n8n — Lead Hunter + Apollo (Prospect AI)

Implementação dos 7 workflows do PRD "Integração e Robustecimento: Lead Hunter + Apollo (Prospect AI) via n8n".

Instância: `https://guizo.app.n8n.cloud` (projeto pessoal). Todos os workflows foram criados como **rascunho** — nenhum está publicado/ativo ainda, porque as credenciais precisam ser conectadas primeiro.

## Workflows criados

| # | Workflow | ID | Gatilho |
|---|---|---|---|
| W1 | LH W1 - Geracao de Lista com Dedupe | `SiW3XEMBSFoiSJKG` | Webhook `POST /webhook/leadhunter/gerar-lista` |
| W2 | LH W2 - Enriquecimento IA + Tavily | `zsUCKJ18MDrGXZY1` | Sub-workflow (chamado pelo W1) |
| W3 | LH W3 - Prospeccao via Email | `76oYiX0Stj26jhVO` | Webhook `POST /webhook/leadhunter/prospectar` |
| W4 | LH W4 - Captura LinkedIn para Planilha | `pMVr41xkYHSWokFW` | Webhook `POST /webhook/apollo/linkedin-captura` |
| W5 | LH W5 - Busca Google Maps com IA | `jxcZgqkK7oIPYkQN` | Webhook `POST /webhook/apollo/maps` |
| W6 | LH W6 - Sync Planilha e Notion | `A8wIagN8job8JwxQ` | Schedule a cada 15 min |
| W7 | LH W7 - Analise de Funil e Dashboard | `GwcRMRupfARc0Phj` | Schedule diário às 8h |

## Contratos dos webhooks

### W1 — gerar lista
```jsonc
// POST /webhook/leadhunter/gerar-lista
{ "setor": "Tecnologia", "cidade": "Santo André", "estado": "SP",
  "nomeEmpresa": "", "quantidade": 20, "filtroContato": "comContato",
  "membro": "guilherme" }

// resposta
{ "lista_id": "uuid", "quantidade": 18, "bloqueados_por_contato": 1,
  "bloqueados_por_reserva": 4, "leads": [ /* mesmo formato do /api/search */ ] }
```
Ao responder, o W1 dispara o W2 (enriquecimento) sem esperar o resultado.

### W3 — prospectar por email
```jsonc
// POST /webhook/leadhunter/prospectar
{ "lista_id": "uuid", "membro": "guilherme", "conta_gmail": "comercial@ufabcjr.com.br" }
// ou { "lead_cnpjs": ["1111...", "2222..."], "membro": "guilherme" }

// resposta
{ "lista_id": "uuid", "membro": "guilherme", "enviados": 12, "erros": 1,
  "pulados_ja_contatados_ou_sem_email": 3, "total_processado": 13 }
```

### W4 — captura do LinkedIn (extensão Chrome)
```jsonc
// POST /webhook/apollo/linkedin-captura
{ "nome": "Maria Silva", "empresa": "Alfa Tech", "cargo": "Sócia",
  "linkedin_url": "https://www.linkedin.com/in/maria-silva", "membro": "guilherme" }

// 200 -> { "ok": true, "atualizado": true, "linha": 12, "id_sync": "uuid", "aba": "guilherme" }
// 400 -> { "ok": false, "erro": "campos_obrigatorios_ausentes", "faltando": ["empresa"] }
// 422 -> { "ok": false, "erro": "falha_na_planilha", "detalhe": "..." }
```

### W5 — busca no Maps
```jsonc
// POST /webhook/apollo/maps
{ "setor": "academias", "cidades": ["São Paulo", "Santo André"],
  "limite": 10, "useAI": true, "membro": "guilherme" }

// resposta
{ "setor": "academias", "cidades_processadas": 2,
  "cidades_bloqueadas_por_orcamento": 0, "mensagem_orcamento": "",
  "total_acumulado_por_filtro": 30, "concluido_em": "..." }
```

## Pré-requisitos antes de ativar

### 1. Banco (Supabase `leadhunter`)
Rodar `n8n/sql/001_pipeline_n8n.sql` uma vez (SQL Editor do Supabase ou `psql`). São só colunas novas e tabelas novas — nada é apagado. **O projeto está pausado (INACTIVE); é preciso reativá-lo antes.**

### 2. Credenciais a conectar na UI do n8n
Nenhuma credencial existia na instância, então cada nó autenticado está com o slot vazio.

| Credencial | Tipo n8n | Usada em |
|---|---|---|
| Supabase Lead Hunter | Postgres | W1, W2, W3 |
| Google Gemini Lead Hunter | Google Gemini (PaLM) API | W2, W3, W5, W7 |
| Tavily API | Header Auth (`Authorization: Bearer <key>`) | W2, W5 |
| Gmail Comercial UFABC Junior | Gmail OAuth2 | W3 |
| Google Service Account Prospect AI | Google API (service account) | W4, W5, W6, W7 |
| Google Places API Key | HTTP Templated Custom Auth — `{"headers":{"X-Goog-Api-Key":"{{api_key}}"}}` | W5 |
| Notion Comercial UFABC Junior | Notion API (internal integration token) | W6, W7 |

A conexão com o Postgres do Supabase usa o **pooler**: host `aws-…pooler.supabase.com`, porta `6543` (ou `5432` na conexão direta), database `postgres`, usuário `postgres.dulpeemmwhudcjqwbolr`, SSL habilitado. A senha é a do banco (Settings → Database), não a service role key.

### 3. Planilha e Notion
- Selecionar a planilha comercial real nos nós Google Sheets (todos estão com o seletor "From list" vazio e o rótulo `Planilha Comercial Prospect AI`).
- Conferir os cabeçalhos usados no mapeamento das abas por membro: `nome`, `empresa`, `cargo`, `linkedin_url`, `origem`, `data_captura`, `membro`, `etapa_funil`, `etapa_atualizada_em`, `id_sync`. Colunas não mapeadas (preenchidas à mão) nunca são tocadas.
- Abas usadas pelo W5: `MAPS`, `MAPS_USAGE` (`data`, `tipo`, `empresa`, `cidade`, `setor`, `membro`, `custo_usd`) e `MAPS_MEMORY` (`filtro_hash`, `setor`, `cidade`, `last_offset`, `total_coletado`, `ultima_busca`).
- Aba `Dashboard` (W7): `etapa`, `quantidade_atual`, `taxa_conversao`, `tempo_medio_dias`, `total_leads`, `atualizado_em`.
- Notion: criar as databases `Pipeline Comercial` e `Dashboard Funil` com as propriedades da Seção 3 do PRD, compartilhar com a integração, e selecionar as data sources nos nós. O `Dashboard Funil` ganhou uma propriedade extra `Observações IA` (rich text) para as observações do agente.
- No W6, editar a constante `ABAS_DE_MEMBRO` no nó *Separar Abas de Membro* com os nomes reais das abas.

### 4. Front-ends
Trocar as chamadas diretas pelos webhooks: `/api/search` → W1, botão "Prospectar via email" → W3, `/api/agent/start-maps` → W5, e a extensão Chrome passa a dar `fetch` no webhook do W4.

## Decisões de implementação

- **Postgres em vez do nó Supabase** nos workflows 1–3: o dedupe precisa de `NOT EXISTS`, `unnest`, CTEs e inserts com `RETURNING` em uma única transação — coisas que a API REST do Supabase não expressa bem. Mesmo banco, só outro protocolo.
- **`filtro_hash`**: `sha1(setor|cidade)` normalizado (minúsculo, sem espaços nas pontas), igual ao `getFilterHash` do Apollo. No W1 é calculado por expressão n8n (`.hash("sha1")`) e no W5 por `crypto.subtle` no Code node — os dois produzem o mesmo hex.
- **Busca do W1 varre 3× a quantidade pedida** e filtra os bloqueados em memória, para não pagar o `COUNT` que já causava timeout no `/api/search`.
- **Rate limit do Gemini**: W2 e W3 processam em série com `Wait` de 5 s (≈12 RPM, abaixo dos 15 do free tier); no W5 o agente usa `batching` com 4,5 s entre itens.
- **Orçamento do Maps**: o W5 relê `MAPS_USAGE` antes de **cada cidade** e para em US$ 150 (aviso em US$ 100), com a mesma mensagem de hoje. Os custos por chamada (`0.032` text search / `0.017` place details) estão no nó *Montar Linhas de Uso* — ajuste lá se a tabela de preços mudar.
- **Paginação do Places**: usa a paginação nativa do nó HTTP (até 5 páginas de 20), e o `last_offset` de `MAPS_MEMORY` pula o que já foi coletado, com reset após 60 dias.
- **Gmail no modo institucional**: uma credencial única para todos. Para o modo individual, duplicar o nó Gmail por membro e colocar um Switch por `membro` antes dele — está anotado no sticky do W3.
- **Modelo Gemini**: `models/gemini-2.0-flash-lite`, como no PRD. O n8n recomenda modelos mais novos; se a API recusar o 2.0, é trocar no dropdown dos nós de modelo.
- **Sync sem cursor**: o W6 compara `etapa_atualizada_em` (planilha) com `Data Última Atualização Etapa` (Notion) e vence o mais recente — não precisa guardar timestamp da última execução.

## Testes já feitos

Executados com pin data (sem tocar em serviço externo):
- W1: 4 candidatos → 2 disponíveis, 1 bloqueado por contato, 1 por reserva; `filtro_hash` e payload da resposta corretos.
- W6: as três ações (`criar_no_notion`, `atualizar_no_notion`, `atualizar_na_planilha`) roteadas corretamente pelo comparador de timestamps.
- W7: métricas por etapa conferidas (quantidade, acumulado, taxa de conversão em cascata, tempo médio, etapas terminais sem tempo médio).

Falta a execução real ponta a ponta, que só é possível depois das credenciais conectadas.
