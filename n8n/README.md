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
| W8 | LH W8 - Migracao Retroativa de ID Sync | `otFxiPJPXSRooYQ4` | Manual (execução única, antes de W4/W6) |

## ⚠️ Descoberta: a planilha real não bate com o schema do PRD

Ao configurar as credenciais, abrimos a planilha real (`1Lp2Yy...wYg`) e as abas de membro **não têm** as colunas que o PRD assumia (`nome`, `empresa`, `cargo`, `linkedin_url`, `etapa_funil`, `id_sync`). Elas têm um funil de KPI comercial próprio, ocupando as colunas A–U:

`Alvo | Mês | Canal | Setor | Empresa contatada | Nome do contato | Número/Link | Quem respondeu? | Data de conexão | Quantos contatos? | Marcou RD? | Data RD | No show? | SQL | Marcou RP? | Data proposta | Contrato? | Data contrato | Motivo da recusa | Ciclo de conversão | Observações`

Isso afetava W4, W6, W7 e W8, que foram **corrigidos** (18–19/08/2026) para essa realidade:

- **`ID_Sync`** vira uma coluna nova **V** (não reaproveita a U, que já é "Observações"). É um pré-requisito manual, único, por aba de membro — ver seção 3 abaixo.
- **`etapa_funil` deixou de ser uma coluna armazenada.** O W6 agora **deriva** a etapa a cada ciclo a partir do funil de KPI existente, nesta ordem de prioridade:
  1. `Motivo da recusa` preenchido → `fechado_perdido`
  2. `Contrato?` = Sim OU `Data contrato` preenchida → `fechado_ganho`
  3. `Marcou RP?` = Sim OU `Data proposta` preenchida → `proposta`
  4. `Data RD` preenchida e `No show?` ≠ TRUE → `reuniao`
  5. `Quem respondeu?` preenchido OU `Marcou RD?` em (Sim/Conversando/Pediu pra retornar/Passou outro contato) → `respondeu`
  6. `Data de conexão` preenchida → `contatado`
  7. Nenhum dos anteriores → `novo_lead`

  Essa lógica foi construída lendo os valores reais de cada coluna na planilha (não é um mapeamento adivinhado) — ver `n8n/README.md` git blame ou o sticky note do W6 para o detalhe.
- **Sincronização de etapa passou a ser só planilha → Notion.** Como a etapa é sempre recalculada da planilha, mudar a etapa direto no Notion não volta mais pra planilha (não há onde gravar isso sem reescrever o funil de KPI manual do time). A branch `atualizar_na_planilha` e o nó correspondente foram removidos do W6.
- **W4** (captura LinkedIn) escreve em `Empresa contatada`, `Nome do contato`, `Número/Link` (guarda a URL do LinkedIn), `Canal`="LinkedIn", `Data de conexão`=hoje. `cargo` não tem coluna própria — vira texto em `Observações` ("Cargo: ..."). `Alvo`/`Setor`/resto do funil ficam em branco para o time preencher.
- **W8** simplificou: só gera e grava `ID_Sync`; não mexe mais em etapa (não há mais o que escrever ali).
- **Bug de parsing corrigido durante o teste**: as datas da planilha são `DD/MM/AAAA`, mas `Date.parse()` do JS lê como `MM/DD/AAAA` (americano) e troca dia/mês em silêncio sempre que o dia é ≤ 12. O W6 usa agora um parser manual para esse formato.

**Pendente:** W5 (`MAPS`/`MAPS_USAGE`/`MAPS_MEMORY`) muito provavelmente tem o mesmo problema — vimos cabeçalhos reais diferentes dos que o W5 usa hoje (ex.: `MAPS_MEMORY` real parece ser `Filtro Hash | Setor | Cidade | Último Offset | Última Busca | Total Empresas Coletadas | Membro`, não os nomes em inglês que o W5 escreve). Ainda não corrigido.

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

### 1. Banco (Supabase `leadhunter`) — ✅ já aplicado
`n8n/sql/001_pipeline_n8n.sql` foi aplicado em 18/08/2026 no projeto `dulpeemmwhudcjqwbolr`, em quatro migrações (`n8n_pipeline_colunas_leads`, `n8n_pipeline_tabelas_dedupe_e_emails`, `n8n_pipeline_indice_cnpj_leads`, `n8n_pipeline_validar_constraints_leads`).

- 12 colunas novas em `leads` (1,65M linhas / 350 MB) + as CHECKs de `etapa_funil` e `enriquecimento_status`, criadas como `NOT VALID` e validadas em seguida para não travar escrita durante o scan.
- Tabelas `lead_reservas`, `listas_geradas` e `emails_enviados`, com RLS ligado e sem policies — as chaves anon/authenticated não enxergam nada; o n8n entra por conexão Postgres direta (role `postgres`), que ignora RLS.
- Índice `leads_cnpj_idx` (os de setor, cidade, estado e porte já existiam).
- Queries do W1, W2 e W3 rodadas contra os dados reais como teste de fumaça; as linhas de teste foram removidas (`leads` segue com 0 registros marcados como contatados).

⚠️ **Formato do CNPJ**: a coluna `leads.cnpj` guarda o valor formatado (`06.370.174/0003-94`), não só dígitos. O dedupe e o casamento entre W1/W2/W3 usam sempre esse mesmo valor, mas qualquer integração externa precisa respeitar o formato.

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
- Documento já apontado direto pelo ID real (`1Lp2Yy_j1SKducGIDXfWpviXxxpao-m_JHjSI3Z5_wYg`) nos nós de W4/W6/W8 — não precisa selecionar na UI.
- **Pré-requisito manual, uma vez por aba de membro:** adicionar o cabeçalho `ID_Sync` na célula **V1**. Sem isso, W4/W6/W8 dão erro "Nenhuma coluna encontrada" ao tentar gravar. Colunas A–U (o funil de KPI existente) não são tocadas.
- Cabeçalhos reais das abas de membro (ver seção "Descoberta" acima) — W4/W6/W8 já usam esses nomes exatos.
- ⚠️ **Abas usadas pelo W5** (`MAPS`, `MAPS_USAGE`, `MAPS_MEMORY`) — ainda usam os nomes de coluna do PRD original (em inglês/genéricos), que **provavelmente não batem** com os cabeçalhos reais dessas abas (não corrigido ainda, ver seção "Descoberta").
- Aba `Dashboard` (W7): `etapa`, `quantidade_atual`, `taxa_conversao`, `tempo_medio_dias`, `total_leads`, `atualizado_em` — aba nova, ainda não existe na planilha, o W7 cria ao rodar.
- Notion: criar as databases `Pipeline Comercial` e `Dashboard Funil` com as propriedades da Seção 3 do PRD, compartilhar com a integração, e selecionar as data sources nos nós. O `Dashboard Funil` ganhou uma propriedade extra `Observações IA` (rich text) para as observações do agente.
- No W6 e no W8, editar a constante `ABAS_DE_MEMBRO` no nó *Separar Abas de Membro* com os nomes reais das abas.

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
- W4: `Resolver ID Sync` casou a linha existente por `Número/Link`, preservou o `ID_Sync`, formatou a data em `DD/MM/AAAA` e anexou o cargo em `Observações`.
- W6: com dados no formato real da planilha, as 7 regras de derivação de etapa (`fechado_perdido` → `fechado_ganho` → `proposta` → `reuniao` → `respondeu` → `contatado` → `novo_lead`) e as ações `criar_no_notion`/`atualizar_no_notion`/`nada` conferidas linha a linha, incluindo o caso de `No show?`=TRUE não avançar para `reuniao`. Achado e corrigido nesse teste: `Date.parse()` trocava dia/mês nas datas `DD/MM/AAAA`.
- W7: métricas por etapa conferidas (quantidade, acumulado, taxa de conversão em cascata, tempo médio, etapas terminais sem tempo médio).
- W8: pulou a linha já migrada, ignorou a linha totalmente vazia e gerou `ID_Sync` só nas linhas com conteúdo real.

No banco real (Supabase), com literais no lugar dos parâmetros:
- W1 *Buscar Candidatos* e *Registrar Lista e Reservas* (lista + 2 reservas criadas e depois removidas).
- W2 *Buscar Leads da Lista* (join por `cnpj = any(lead_cnpjs)`).
- W3 *Buscar Leads Elegíveis* e *Registrar Envio* (validado contra CNPJ inexistente, sem marcar lead real).

Falta a execução real ponta a ponta pelo n8n, que só é possível depois das credenciais conectadas.

## Ajuste pós-teste

Os nós Postgres que fecham os loops do W2 e do W3 (`Gravar Enriquecimento`, `Marcar Enriquecimento com Erro`, `Registrar Envio`, `Registrar Falha de Envio`) ficaram com `alwaysOutputData` ligado: se um `UPDATE ... RETURNING` não casar nenhuma linha, o nó ainda emite um item e o `nextBatch` continua o loop, em vez de a execução parar no meio e o webhook ficar sem resposta.
