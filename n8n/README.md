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
| W9 | LH W9 - Tratamento Central de Falhas | `rJGKkgi2uSwjkaIj` | Error Trigger (**publicado**) — dispara quando W1–W8 falham |

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

### W5 também estava quebrado — corrigido em 19/08/2026

Exportando a planilha como xlsx deu para ler os nomes reais das abas e cabeçalhos. O W5 tinha **dois problemas independentes**, ambos corrigidos:

1. **Bug crítico de aba errada**: o nó *Ler Memoria de Paginacao* apontava para a aba `Leads Maps` em vez de `Maps Memory`. O offset nunca era recuperado, então toda busca recomeçaria da primeira página — quebrando a memória de paginação que o PRD manda preservar.
2. **Nomes de aba e coluna inventados**: o W5 usava `MAPS`/`MAPS_USAGE`/`MAPS_MEMORY` com colunas em snake_case. Os nomes reais são:
   - `Leads Maps`: Data | Empresa | Setor | Cidade | Endereço | Telefone BR | Telefone Internacional | Site | Horário | Potencial IA | Justificativa | Dores Típicas | Serviços Sugeridos | Melhor Canal | Melhor Horário | Argumento de Abertura | Status | Membro
   - `Maps Memory`: Filtro Hash | Setor | Cidade | Último Offset | Última Busca | Total Empresas Coletadas | Membro
   - `Maps Usage`: Data | Mês/Ano | Tipo Chamada | Custo Estimado USD | Custo Acumulado Mês | Empresa Pesquisada | Membro

Consequências das correções:
- **Dedupe** agora casa por `Empresa` + `Cidade` (a aba não tem coluna `chave_dedupe`).
- **Orçamento** filtra pela coluna `Mês/Ano` (formato `8/2026`), não por parsing de data, e alimenta o `Custo Acumulado Mês` linha a linha.
- **`crypto` não existe no Code node** do n8n Cloud — `crypto.subtle.digest` quebrava a execução na primeira linha. Substituído por SHA-1 em JS puro, **validado contra o hash real já gravado na aba** (`094547f9…` para `indústria química|são paulo`), contra os vetores padrão do SHA-1 e contra o `hashlib` do Python. Isso garante que a memória de paginação existente continue casando em vez de gerar hashes novos.
- Dados que o Places retorna mas não têm coluna (nota, nº de avaliações, `place_id`, status do negócio) alimentam o prompt da IA, mas não são gravados.

### Abas reais da planilha "Prospecção - Vendas"

12 abas de membro: `Anna`, `Daniel`, `Duda`, `Felipe`, `Gui Lima`, `Gui Midolli`, `Gustavo`, `Larissa`, `Léo`, `Letícia`, `Tiago`, `Caio Sperandio` — já configuradas no W6 e no W8.

⚠️ A aba `Caio Sperandio` tem um cabeçalho ligeiramente diferente (`Alvo (KPI)` em vez de `Alvo`, e **sem a coluna `Observações`**). W6 e W8 funcionam nela normalmente (só leem colunas que existem em ambas), mas o **W4 falharia** ao tentar escrever em `Observações` nessa aba específica.

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

### 2. Credenciais a conectar na UI do n8n — ✅ já conectadas
As sete credenciais abaixo já foram criadas na instância e vinculadas aos nós (auditado em 19/08/2026: nenhum nó autenticado ficou com o slot vazio).

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
- Documento já apontado direto pelo ID real (`1Lp2Yy_j1SKducGIDXfWpviXxxpao-m_JHjSI3Z5_wYg`) nos nós de W4/W5/W6/W7/W8 — não precisa selecionar na UI.
- Os 12 nomes reais de aba de membro já estão preenchidos na constante `ABAS_DE_MEMBRO` do nó *Separar Abas de Membro* (W6 e W8). ✅
- Abas do W5 (`Leads Maps`, `Maps Memory`, `Maps Usage`) já usam os cabeçalhos reais. ✅

Ainda **falta fazer na mão**, uma vez:

1. **`ID_Sync` na célula V1** de cada aba de membro. Sem isso, W4/W6/W8 dão erro "Nenhuma coluna encontrada" ao tentar gravar. Colunas A–U (o funil de KPI existente) não são tocadas.
2. **`Contexto Web` na célula S1** da aba `Leads Maps` — é onde o W5 grava o resumo da pesquisa Tavily. Sem o cabeçalho, a coluna é ignorada em silêncio.
3. **Criar a aba `Dashboard`** com os cabeçalhos `etapa | quantidade_atual | taxa_conversao | tempo_medio_dias | total_leads | atualizado_em`. O nó do W7 grava numa aba existente, **não cria a aba** — sem ela o W7 falha na primeira execução.
4. **Notion**: criar as databases `Pipeline Comercial` e `Dashboard Funil` com as propriedades da Seção 3 do PRD, compartilhar com a integração e **selecionar as data sources** nos nós de W6 e W7 (a credencial está conectada, mas a database em si precisa ser escolhida). O `Dashboard Funil` ganhou uma propriedade extra `Observações IA` (rich text) para as observações do agente.
5. **Destinatário do alerta do W9** (campo *To* do nó *Avisar o Responsavel*).

### 4. Reenriquecer uma lista

O W2 atende dois gatilhos: a chamada do W1 (`Execute Workflow`, na criação da lista) e o webhook `POST leadhunter/enriquecer` com `{ lista_id }`, que a plataforma usa no botão **Tentar enriquecer de novo**. O webhook responde na hora e o processamento segue em segundo plano.

A consulta pula quem já está `enriquecimento_status = 'ok'`, então reenviar é barato e idempotente: só os leads em erro, pendentes ou nunca processados voltam para a fila.

### 5. Front-ends
Trocar as chamadas diretas pelos webhooks: `/api/search` → W1, botão "Prospectar via email" → W3, `/api/agent/start-maps` → W5, e a extensão Chrome passa a dar `fetch` no webhook do W4.

## Decisões de implementação

- **Postgres em vez do nó Supabase** nos workflows 1–3: o dedupe precisa de `NOT EXISTS`, `unnest`, CTEs e inserts com `RETURNING` em uma única transação — coisas que a API REST do Supabase não expressa bem. Mesmo banco, só outro protocolo.
- **`filtro_hash`**: `sha1(setor|cidade)` normalizado (minúsculo, sem espaços nas pontas), igual ao `getFilterHash` do Apollo. No W1 é calculado por expressão n8n (`.hash("sha1")`) e no W5 por `crypto.subtle` no Code node — os dois produzem o mesmo hex.
- **Busca do W1 varre 3× a quantidade pedida** e filtra os bloqueados em memória, para não pagar o `COUNT` que já causava timeout no `/api/search`.
- **Rate limit do Gemini**: W2 processa em série com `Wait` de 15 s entre leads e W3 com 5 s entre envios; no W5 o agente usa `batching` com 4,5 s entre itens. Os 15 s do W2 não são folga: cada rodada do agente dispara várias chamadas ao modelo (prompt + uma por chamada da Tavily), então o RPM real é um múltiplo do número de leads por minuto.
- **Orçamento do Maps**: o W5 relê `Maps Usage` antes de **cada cidade** e para em US$ 150 (aviso em US$ 100), com a mesma mensagem de hoje. Os custos por chamada (`0.032` text search / `0.017` place details) estão no nó *Montar Linhas de Uso* — ajuste lá se a tabela de preços mudar.
- **Paginação do Places**: usa a paginação nativa do nó HTTP (até 5 páginas de 20), e o `Último Offset` de `Maps Memory` pula o que já foi coletado, com reset após 60 dias.
- **Gmail no modo institucional**: uma credencial única para todos. Para o modo individual, duplicar o nó Gmail por membro e colocar um Switch por `membro` antes dele — está anotado no sticky do W3.
- **Modelo Gemini**: `models/gemini-3.1-flash-lite`, **explícito nos três nós de modelo** (W2, W3, W5). Deixar o campo vazio não é neutro: o nó cai no default dele, hoje `models/gemini-3-flash-preview`, e modelo *preview* tem cota de free tier muito menor que a de um GA. Foi exatamente isso que derrubou 4 de 5 leads de uma lista com `The service is receiving too many requests from you` — o sintoma aparecia como "enriquecimento falhou", sem nenhuma pista do modelo. Se trocar de modelo, troque nos três.
- **Sync sem cursor**: o W6 compara `etapa_atualizada_em` (planilha) com `Data Última Atualização Etapa` (Notion) e vence o mais recente — não precisa guardar timestamp da última execução.

## Trava de orçamento da Tavily (W2)

Implementa o "contador de uso + bloqueio preventivo" que a seção 5 do PRD pede, no mesmo padrão do Maps.

Antes de **cada lead**, o nó *Checar Cota Tavily* soma o consumo do mês corrente na tabela `tavily_uso`. Se não couber mais um lead dentro do limite, o lead recebe `enriquecimento_status = 'pendente'` e o loop segue — o agente com Tavily nem chega a ser invocado. Cada lead enriquecido grava seu consumo.

Os dois números ficam no SQL do próprio nó, fáceis de ajustar:
- `limite_mes` = 1000 (free tier da Tavily)
- `creditos_por_lead` = 6 (até 3 buscas × 2 créditos da busca `advanced`)

É uma **estimativa conservadora**, não a contagem exata de chamadas — o agente decide quantas buscas faz. Por ser conservadora, ela bloqueia antes de estourar, não depois. Leads marcados como `pendente` podem ser reenriquecidos rodando o W2 de novo com o mesmo `lista_id` quando a cota renovar.

## Tratamento central de falhas (W9)

Único workflow **publicado**. Não roda sozinho: o n8n o dispara automaticamente quando qualquer um dos outros oito falha em produção (já configurado como *Error Workflow* de W1 a W8).

A cada falha: normaliza o evento (o nome do nó vem de `error.node.name` ou de `lastNodeExecuted`, conforme o tipo de falha), grava em `n8n_erros` no Supabase e envia um email com link direto para a execução que quebrou. Gravação e email são independentes — se o email falhar, o log continua.

⚠️ **Falta preencher o destinatário** no campo *To* do nó *Avisar o Responsavel*. Enquanto estiver vazio, o log no Supabase funciona mas o email não sai.

Só dispara em execuções de produção; testes manuais no editor não acionam.

## Integração com a plataforma web

Desde 20/08/2026 os workflows são disparados pela plataforma (`/buscar`,
`/listas/[id]`, `/maps`) em vez de chamadas soltas. Duas consequências:

- **O campo `membro` vem da sessão**, não do corpo da requisição. A plataforma
  resolve email do Google → aba da planilha (`member_profiles.aba_planilha`) e
  injeta o valor no servidor, então ninguém dispara automação em nome de outro.
- **O W7 ganhou um ramo novo** (`Montar Metricas para o Supabase` →
  `Gravar Metricas no Supabase`), paralelo à gravação no Notion/planilha. Ele
  grava uma fotografia das métricas na tabela `funil_metricas` do Supabase, que
  é o que a tela `/pipeline` lê. Fica em paralelo de propósito: a gravação
  acontece mesmo se o Notion falhar.

Os webhooks continuam funcionando sozinhos — nada impede chamá-los direto.

## Testes já feitos

Executados com pin data (sem tocar em serviço externo):
- W1: 4 candidatos → 2 disponíveis, 1 bloqueado por contato, 1 por reserva; `filtro_hash` e payload da resposta corretos.
- W4: `Resolver ID Sync` casou a linha existente por `Número/Link`, preservou o `ID_Sync`, formatou a data em `DD/MM/AAAA` e anexou o cargo em `Observações`.
- W6: com dados no formato real da planilha, as 7 regras de derivação de etapa (`fechado_perdido` → `fechado_ganho` → `proposta` → `reuniao` → `respondeu` → `contatado` → `novo_lead`) e as ações `criar_no_notion`/`atualizar_no_notion`/`nada` conferidas linha a linha, incluindo o caso de `No show?`=TRUE não avançar para `reuniao`. Achado e corrigido nesse teste: `Date.parse()` trocava dia/mês nas datas `DD/MM/AAAA`.
- W7: métricas por etapa conferidas (quantidade, acumulado, taxa de conversão em cascata, tempo médio, etapas terminais sem tempo médio).
- W8: pulou a linha já migrada, ignorou a linha totalmente vazia e gerou `ID_Sync` só nas linhas com conteúdo real.
- W5 (após as correções): `filtro_hash` bateu com a linha real de `Maps Memory` → offset recuperado e aplicado; dedupe pulou a empresa já existente; orçamento somou só o mês corrente (excluiu corretamente uma linha de US$ 99 de julho); custo acumulado somou linha a linha.
- W2 (trava da Tavily): com a cota estourada, os dois leads foram para `pendente` **sem invocar Gemini/Tavily**; com cota livre, o lead passou pelo agente e o consumo foi registrado.
- W9: normalização do evento de erro conferida (workflow, nó, mensagem, id e URL da execução extraídos corretamente).
- W7 (ramo do Supabase): com 8 páginas de pin data cobrindo as 7 etapas, o nó de código montou o JSON com `ordem` correta e um único `calculado_em`; o SQL do `insert ... select from jsonb_array_elements` foi rodado contra o banco real (incluindo observação da IA com aspas e observação vazia virando `null`) e a leitura que a plataforma faz devolveu as 7 etapas na ordem. As linhas de teste foram removidas.

No banco real (Supabase), com literais no lugar dos parâmetros:
- W1 *Buscar Candidatos* e *Registrar Lista e Reservas* (lista + 2 reservas criadas e depois removidas).
- W2 *Buscar Leads da Lista* (join por `cnpj = any(lead_cnpjs)`).
- W3 *Buscar Leads Elegíveis* e *Registrar Envio* (validado contra CNPJ inexistente, sem marcar lead real).

Falta a execução real ponta a ponta pelo n8n, que depende dos pré-requisitos manuais da planilha e do Notion (seção 3).

## Ajuste pós-teste

Os nós Postgres que fecham os loops do W2 e do W3 (`Gravar Enriquecimento`, `Marcar Enriquecimento com Erro`, `Registrar Envio`, `Registrar Falha de Envio`) ficaram com `alwaysOutputData` ligado: se um `UPDATE ... RETURNING` não casar nenhuma linha, o nó ainda emite um item e o `nextBatch` continua o loop, em vez de a execução parar no meio e o webhook ficar sem resposta.
