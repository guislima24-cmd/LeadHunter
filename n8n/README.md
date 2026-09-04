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
  é o que a página inicial lê (o quadro de negócios era `/pipeline` e passou a
  ser `/`). Fica em paralelo de propósito: a gravação acontece mesmo se o
  Notion falhar.

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

## CRM sobre a Lead Hunter

Implementação de `leadhunter-crm-especificacao-tecnica.md`. Schema e RPCs em `sql/003_crm.sql` a `008_crm_negocio_manual.sql`; a lógica de negócio (promover lead, criar negócio, mover etapa, fechar negócio) vive em funções Postgres chamadas via `.rpc()` pelas rotas `app/api/crm/*` da plataforma — não em novos webhooks n8n, exceto o ajuste do W4 abaixo.

Cinco funções transacionais, uma por fluxo que grava em mais de uma tabela:

| Função | Migração | Quando |
|---|---|---|
| `crm_promover_lead` | 004 | "Iniciar negócio" num lead da lista |
| `crm_criar_negocio_avulso` | 004 | Negócio novo para organização que já está no CRM |
| `crm_criar_negocio_manual` | 008 | Botão "Novo negócio" do quadro — cria organização e contato junto, se preciso |
| `crm_mover_etapa` | 004 | Arraste no quadro, ou a esteira da ficha |
| `crm_fechar_negocio` | 004 | Marcar como ganho/perdido |

`crm_criar_negocio_manual` reaproveita a organização pelo CNPJ quando há um e, quando não há, pelo nome (comparação sem caixa nem espaços nas pontas) — inclusive contra organizações que têm CNPJ, para que escolher uma empresa existente na sugestão do formulário não crie uma segunda linha para o mesmo cliente. Homônimas de verdade se separam informando o CNPJ.

`008` também acrescenta colunas a `vw_quadro_negocios` (ids de produto/serviço e motivo de perda, origem, dados de contato e da empresa) — a ficha do negócio precisa delas para preencher os campos de edição.

### Ajustes exigidos pelo schema real (a especificação assumia diferente)

- `member_profiles` é chaveado por **`email`** (texto), não tem coluna `id`/uuid. Toda FK que a especificação desenhava para `member_profiles(id)` virou `*_email text references member_profiles(email)`.
- `member_profiles.papel` já existia com o check `'membro'/'admin'` — a migração 4.1 da especificação (criar `role`) foi descartada.
- A tabela de reserva de 24h do W1 é `lead_reservas` (confirmado por inspeção direta do schema).
- `organizacoes.cnpj` **não é obrigatório**: a especificação previa `not null unique`, mas uma organização capturada via LinkedIn (W4) não tem CNPJ, só nome. Ver `006_crm_organizacoes_cnpj_opcional.sql`.
- `organizacoes.lead_origem_cnpj` e `negocios.lead_origem_cnpj` **não são foreign key** para `leads.cnpj`: essa coluna não tem constraint de unicidade em produção (está de fato única — 1.674.987 linhas, 0 duplicatas, auditado antes de decidir — mas criar um índice único nela é lock desnecessário numa tabela de 1,6M linhas que W1/W2/W3 escrevem o tempo todo). Ficam como referência indexada, não uma FK estrita.

### RLS

As 4 tabelas legadas que estavam sem RLS (`leads`, `activity_log`, `member_profiles`, `configuracoes`) foram habilitadas nesta rodada, junto com todas as tabelas novas do CRM — decisão que estava pendente desde a plataforma web (documento de referência, Seção 5/6) e que a especificação do CRM pedia para resolver junto.

Antes de habilitar, foi auditado que **nenhum código da aplicação lê essas tabelas com a chave anon**: o cliente ligado à sessão do navegador (`lib/supabase/servidor.ts`) só é usado para `auth.getUser()`/`signOut()`, nunca para consulta de dado — toda leitura/escrita real passa pela chave de service role (`lib/supabase/admin.ts`), que ignora RLS. Por isso habilitar RLS não quebra nada em produção; é defesa em profundidade contra a chave anon (pública, repositório público) sendo usada fora da aplicação.

A policy de leitura checa o domínio institucional direto do JWT (`auth.jwt()->>'email' ilike '%@ufabcjr.com.br'`), não só "está autenticado" — o provedor Google do Supabase Auth aceita qualquer conta Google, então sem esse filtro uma conta fora do domínio com a chave anon leria tudo.

Rodado `get_advisors` (security) depois da migração: 4 ERROR (views de funil rodando como `SECURITY DEFINER` do dono, ignorando a RLS de baixo) e 6 WARN (search_path mutável nas funções, `is_membro_ufabcjr`/`is_admin_ufabcjr` executáveis por anon como definer) — todos corrigidos em `005_crm_correcoes_advisor.sql`. Os 57 WARN restantes ("tabela visível no schema GraphQL para anon/authenticated") são o mesmo padrão de grant default que já existe em toda tabela do projeto, não algo introduzido aqui.

### W4 passa a gravar também no Postgres central

Além da aba do membro na planilha (como sempre fez), o nó novo **Gravar Organizacao e Contato no CRM** faz upsert em `organizacoes`/`contatos` com dedupe por `linkedin_url` — mesma lógica que o nó `Resolver ID Sync` já usa para a planilha. Roda em paralelo, com `onError: continueRegularOutput`: se o Postgres falhar, a gravação na planilha (o caminho que já funciona em produção) segue intacta e a resposta ao webhook não muda.

Resolve `criado_por_email` fazendo `member_profiles.aba_planilha = membro` (o payload da extensão manda o nome da aba, não o email) — se a aba não corresponder a nenhum membro cadastrado, a gravação no CRM é pulada silenciosamente (nada quebra, só não gera organização/contato).

**Bug de produção encontrado durante o teste e já corrigido:** o nó `Gravar na Aba do Membro` usava a credencial `Google Sheets account` (`y7Qjl9cVell53bFu`), cujo token OAuth está inválido (`Unable to sign without access token`) — toda captura de LinkedIn caía no branch de erro (`Responder Erro de Planilha`, HTTP 422).

O nó de leitura do **mesmo** workflow (`Buscar Linha do Perfil`), lendo a **mesma** planilha, já usava `Google Sheets account 3` (`UFpfZzKr5o3LOeKw`), que está saudável e é a credencial que o W5 também usa. A escrita foi apontada para ela: resolve o 422 sem depender de reconectar OAuth e elimina a incoerência de um workflow ler e escrever a mesma planilha com contas diferentes. Verificado com execução real — `Responder Sucesso`, linha gravada na aba.

`Google Sheets account` (`y7Qjl9cVell53bFu`) ficou órfã: nenhum nó de nenhum workflow a referencia mais. Dá para reconectar na UI do n8n se quiser reaproveitá-la, ou excluir.

### Notificação de atividade com prazo vencendo

`GET /api/cron/atividades-vencendo` (agendado em `vercel.json`, uma vez por dia — o plano Hobby do Vercel não permite cron mais frequente que diário) cria uma linha em `notificacoes` para toda atividade não concluída com prazo nas próximas 24h ou já vencido, sem duplicar enquanto a notificação anterior seguir não lida. **Só cria a notificação in-app** — não envia email. A especificação pede o mesmo padrão de alerta do W9 (email com link direto), mas isso é um novo fluxo de envio dentro do n8n, fora do que uma rota Next.js sozinha resolve; fica registrado como próximo passo.

## Precificação

Implementação de `leadhunter-crm-precificacao-prd.md` — a calculadora de proposta que o time mantinha numa página HTML avulsa, trazida para dentro do CRM e ligada ao funil. Schema em `sql/009_crm_portes_catalogo_historico.sql` e `sql/010_crm_precificacao.sql`, aplicados em 23/08/2026 no projeto `dulpeemmwhudcjqwbolr`.

A fórmula não virou função Postgres, ao contrário do resto do CRM: ela precisa rodar no navegador para dar prévia ao vivo enquanto se mexe nos controles. Vive em `lib/precificacao.ts`, sem `server-only`, e é importada pelos dois lados — a tela para mostrar, `PATCH /api/crm/precificacao/orcamentos/[id]` para gravar. A rota **sempre recalcula a partir dos parâmetros do banco** e ignora qualquer valor que o cliente mande: senão bastaria um `fetch` à mão para gravar o preço que se quisesse.

### 009 — os pré-requisitos que faltavam

A Seção 14 do PRD assume três coisas que nunca tinham sido criadas:

- **`portes_empresa`** — 7 portes com `taxa_hora_padrao`, mais `organizacoes.porte_empresa_id`. Só três faixas de taxa apareciam na calculadora antiga (180 / 250 / 320); os portes sem taxa própria (Empresa Júnior, Para abrir, Indefinido) receberam a menor, 180. Erra para baixo de propósito — cobrar a menos de um cliente pequeno é recuperável, e o número é editável na tela de referência.
- **Catálogo de serviços** — de 4 para 22. Os 4 que já existiam foram **renomeados no lugar**, não recriados, para que as FKs de negócios em andamento continuassem válidas.
- **Histórico** — 242 projetos do PDF "Banco de Dados de Projetos UFABC Jr." em `historico_precificacao`, com 282 vínculos em `historico_precificacao_servicos` (0 órfãos). A extração foi feita por coordenada de palavra (`pdftotext -bbox-layout`), não pelo modo `-layout`: nomes de serviço longos transbordavam a célula e colavam no ano da linha vizinha, chegando a fundir dois registros. 18 linhas em que o nome do projeto ficou interleavado no texto do serviço foram conferidas à mão contra o layout original.

`vw_ticket_medio_servico` fecha a média por serviço, mas **só conta projeto de um serviço só**: num projeto que empacotou vários por um preço fechado não há como saber quanto coube a cada um, e ratear inventaria uma precisão que o dado não tem. A view expõe `amostra` junto com a média para que a tela possa qualificar um número apoiado em poucos projetos. As bases maiores são Pesquisa de Mercado — Secundária (73), Plano de Negócios (23), Mapeamento de Processos (20) e Estruturação Comercial (14).

### 010 — a régua e os orçamentos

`precificacao_parametros_globais` (linha única, `id boolean primary key default true`), `precificacao_faixas_capacidade` (5 faixas, 0,75× a 1,30×), `precificacao_dimensoes` + `precificacao_dimensao_opcoes` (11 dimensões, 25 opções) e o orçamento em si: `negocio_orcamentos` → `negocio_orcamento_itens` → `negocio_orcamento_item_valores`.

As dimensões são dados, não código — a tela de orçamento monta o formulário a partir delas. Três tipos:

| Tipo | Como entra na conta | Exemplo |
|---|---|---|
| `selecao_unica` | soma pontos percentuais; o markup é `1 + pontos/100` | Complexidade do Setor: 0 / 20 / 40 |
| `contagem_linear` | multiplica por `1 + ((valor − mínimo) × incremento)/100` | Entrevistados, 1 a 20, 5,263158% cada (= 100/19, reproduz o `1 + (n−1)/19` da calculadora antiga) |
| `contagem_valor_fixo` | soma `valor × valor_unitário` **depois** dos multiplicadores | POPs a R$ 200 cada |

A ordem importa: custo fixo entra depois da complexidade e da capacidade, senão um POP de R$ 200 sairia por R$ 350 num escopo complexo. O imposto fecha a conta por **divisão** — `subtotal / ((100 − imposto)/100)` —, não por soma, que é o erro comum de embutir imposto e sair com margem menor que a pretendida.

`limiar_desvio_percentual` (padrão 40) é coluna, não constante: é a partir de quanta diferença para o histórico o orçamento avisa que o preço está fora do padrão, e esse é um número de política comercial, que muda sem deploy.

Finalizar um orçamento grava `negocios.valor` e aponta `produto_servico_id` para o item de maior valor. Orçamento finalizado não recalcula: ele guardou o próprio cálculo, então mexer na régua depois muda os orçamentos novos e deixa o histórico intacto. Apagar só é possível enquanto for rascunho.

## Navegação, Negócios e Insights

Implementação de `leadhunter-crm-navegacao-insights-prd.md`. Schema em `sql/011_crm_reagendamento_previsao.sql` e `sql/012_crm_insights.sql`, aplicados em 24/08/2026 no projeto `dulpeemmwhudcjqwbolr`.

### O motivo de perda virou uma coluna, não um `if` por nome

O PRD pede uma entrada nova em `motivos_perda` chamada "Momento errado", que ao ser escolhida obriga o preenchimento de um plano de retomada. Duas decisões mudaram como isso foi feito:

1. **Já existia "Timing ruim"** (ordem 5) — o mesmo motivo com outro nome. Criar a nova ao lado deixaria dois sinônimos na mesma lista e racharia o histórico entre eles. Foi renomeado no lugar, preservando o uuid e portanto os negócios que já apontavam para ele.
2. **A ligação com o formulário é `motivos_perda.exige_reagendamento`**, não o texto do nome. Casar por string (`if motivo = 'Momento errado'`) quebraria em silêncio no dia em que alguém reescrevesse o rótulo na tela de configuração — e o rótulo existe justamente para ser editável.

A obrigatoriedade mora em `crm_fechar_negocio`, não na rota HTTP: a função é chamada do quadro e da ficha, e um dia pode ser chamada de um workflow. Exigir na função é exigir em todas as portas. Os parâmetros novos têm default `null` para não quebrar chamadas existentes, mas fechar sem eles com um motivo que os exige levanta `reagendamento_obrigatorio` e a transação inteira volta atrás.

**Atenção ao recriar a função:** em Postgres a assinatura faz parte da identidade, então `create or replace` com parâmetros novos cria uma *segunda* função em vez de substituir a primeira. A migração faz `drop function ... (uuid, text, text, uuid)` antes — sem isso, uma chamada com quatro argumentos (como a rota de fechar fazia até agora) casaria com a versão antiga, que não sabe nada de reagendamento, e a regra nova passaria despercebida exatamente no caminho que ela precisa cobrir.

### O alerta de retomada vai para todos os admins

`GET /api/cron/reagendamentos-proximos` (agendado no `vercel.json`, diário às 11h UTC) notifica retomadas que vencem em até 5 dias. Vai para **todos os administradores ativos**, não para quem registrou a perda: o ponto do reagendamento é que a retomada não dependa da memória — nem da presença — de uma pessoa só, e quem perdeu o negócio pode ter saído da EJ entre a perda e a data de voltar.

`negocio_reagendamentos.notificado_em` marca o que já foi avisado. A coluna existe em vez de a rota conferir `notificacoes` porque a notificação é por admin e o aviso é por retomada — contar linhas de uma para decidir a outra erraria assim que o time mudasse de tamanho. A marcação acontece **depois** da inserção: se viesse antes e a inserção falhasse, a retomada ficaria marcada como avisada sem ninguém ter sido avisado, e nunca mais entraria na consulta.

Sem admin ativo, a rota não marca nada e devolve um aviso — assim o alerta sai de verdade assim que existir um, em vez de a retomada ser silenciosamente dada como avisada.

### Os dois funis são separados, e os números não fecham entre si

O funil de prospecção (Prospecção → Aceite → Resposta → Reuniões → RD → RP → Contratos) é métrica de topo de funil, **separada** de `etapas_funil`/`negocios`. Prospecção, aceite e resposta acontecem enquanto o lead ainda é lead, antes de existir negócio algum.

Isso significa que "Reuniões" no funil de prospecção conta reuniões realizadas no período, enquanto o funil de negócios conta negócios parados na etapa Reunião agora. São perguntas diferentes e os totais não batem — de propósito. O PRD registra a sobreposição como ponto a revalidar com uso real (Bloqueador 1); até lá a tela diz de onde cada número sai, e marca com um selo os que dependem de registro manual.

**Aceite e Resposta são manuais** (`funil_prospeccao_eventos`, botões na tela do lead) porque nenhum workflow lê a caixa de entrada institucional: o W3 grava que o email saiu e o que veio depois só quem conversou sabe. A tabela nasce preparada para o dia em que a automação existir — `registrado_por_email` nulo passa a significar "detectado automaticamente". Índice único por `(lead_cnpj, tipo_evento)`: dois cliques no botão não inflam a taxa de aceite do mês.

RD e RP entraram como **tipos de atividade**, não etapas do funil de negócios — mexer em `etapas_funil` obrigaria a remapear todo negócio em andamento, e o PRD prefere adiar essa decisão até ver os dois funis lado a lado com dado real.

### Metas: o progresso é calculado na leitura, não gravado por job

`metas.valor_atual` só é lido quando `metrica_fonte = 'manual'`. Para as outras cinco fontes o número é **calculado toda vez que a tela abre**, a partir da fonte real.

O PRD previa um job periódico atualizando a coluna. Um valor gravado por job fica errado entre uma execução e a seguinte, e uma meta que mostra progresso velho é pior que uma que não mostra nada — ninguém desconfia de um número que está ali. O custo de calcular é um `count`/`sum` sobre índice existente; não vale um cron para isso, e ainda economiza um dos dois slots de cron que o plano Hobby do Vercel permite.

A tela mostra, junto da barra, **onde a meta deveria estar pelo tempo decorrido do período**. A barra sozinha mente por omissão: 60% do alvo é ótimo no dia 10 e ruim no dia 28.

### Relatórios: a IA redige, não calcula

`POST /api/crm/insights/relatorios/gerar-ia` monta o snapshot a partir do banco, manda **só o snapshot** para a IA (`claude-opus-5`, via `@anthropic-ai/sdk`) e grava o texto. A IA não tem acesso ao banco, não recebe ferramentas e não vê id de entidade nenhuma — recebe os números já apurados, formatados em português, e escreve prosa sobre eles.

O rascunho **nunca publica sozinho** (`gerado_por_ia = true`, `status = 'rascunho'`). A tela do relatório mostra o snapshot ao lado do texto justamente para que quem revisa possa bater cada afirmação contra o número que a originou.

`metricas_snapshot` congela os números usados. Sem ele, reabrir um relatório de três meses atrás recalcularia tudo com o dado de hoje e o texto passaria a contradizer os próprios números — um negócio reclassificado depois mudaria a história de um mês já fechado. Mesmo trade-off do módulo de precificação.

Um índice parcial garante **um publicado por mês** (`idx_relatorios_publicado_unico`); rascunhos convivem à vontade. Editar o texto continua livre depois de publicado — um relatório é documento vivo do time, e travar a correção de um erro de digitação em nome da imutabilidade seria formalidade sem serventia. O que não muda é o snapshot.

`ANTHROPIC_API_KEY` está documentada em `.env.example` mas **não estava configurada** quando o módulo foi entregue. Sem ela a rota devolve 503 com uma mensagem explicando; o resto da tela (escrever à mão, editar, publicar) funciona igual.

### Decisões deixadas em aberto pelo PRD

- **Quem publica relatório** (Bloqueador 3): qualquer membro. É a opção menos restritiva porque o relatório já nasce revisado por gente e a EJ é pequena — restringir depois é uma linha, liberar depois exige convencer alguém.
- **RD/RP** (Premissa da Seção 8): assumidos como "Reunião Diagnóstica" e "Reunião de Proposta". São os nomes padrão em consultoria, mas o PRD pede confirmação — se estiverem errados, é um `update` em `tipos_atividade.nome`.

## Extensão do Chrome

Veio do repositório `ProjetoApollo`, onde estava presa ao app antigo. O código vive agora em [`chrome-extension/`](../chrome-extension/); schema em `sql/014_extensao_tokens.sql` e `sql/015_eventos_funil_por_contato.sql`.

### Por que ela não tinha vindo antes

Não foi esquecimento — ela estava amarrada ao ProspectAI em três camadas independentes, e mexer numa sem as outras não adiantava:

1. **Endereço fixo no código.** `background.js` tinha `API_BASE_PROD = 'https://projeto-apollo.vercel.app'`, e o `manifest.json` só autorizava esse domínio em `host_permissions`. O Chrome MV3 bloqueia requisição para host fora dessa lista, então trocar só a URL não funcionaria.
2. **Autenticação de outro sistema.** Ela mandava `X-Session-Token`, um cookie do NextAuth que o app antigo validava, e tirava a aba do membro de `session.user.memberTab`. O CRM usa Supabase Auth com `member_profiles.aba_planilha`.
3. **Caminho paralelo até a planilha.** Ela chamava `POST /api/prospection` do app antigo, que falava direto com o Google Sheets. O CRM já tinha o W4 (`/apollo/linkedin-captura`) fazendo exatamente isso — e **nada no CRM o chamava**: era um webhook esperando um cliente que nunca aparecia.

### O que a migração mudou

**Autenticação virou token próprio.** O membro gera em `/extensao`, cola no popup uma vez. O banco guarda só o SHA-256 (`extensao_tokens`); o segredo aparece uma vez, na criação. Não dá para reaproveitar a sessão do Supabase: o cookie é httpOnly e rotaciona, e o service worker da extensão não tem como acompanhar.

`/api/extensao` entrou em `ROTAS_PUBLICAS` do `proxy.ts`. **Não é rota pública** — é autenticada de outro jeito. Sem isso o proxy devolveria 401 antes de a rota rodar, e a extensão nunca chegaria a se identificar.

**Os detectores passaram a falar pelo background.** No MV3, `fetch` de content script sai com a origem da página (`linkedin.com`) e é barrado por CORS; do service worker, para host em `host_permissions`, não passa por CORS nenhum. Na versão antiga os detectores chamavam a API direto do content script — o que só funcionava se o servidor mandasse cabeçalho de CORS. Agora mandam mensagem para o `background.js`.

**A captura agora usa o W4.** `POST /api/extensao/prospeccao` traduz token → membro → aba da planilha e repassa. Nenhuma regra de negócio nova: o W4 já gravava na planilha e fazia upsert em `organizacoes`/`contatos`.

**A `key` do manifest ficou.** Ela fixa o ID da extensão, então quem já tinha a versão antiga instalada recebe atualização em vez de uma extensão nova ao lado.

### Aceite e resposta deixaram de ser manuais no LinkedIn

`acceptance-detector.js` e `reply-detector.js` já existiam e já funcionavam — detectam no LinkedIn quem aceitou a conexão e quem respondeu, sem ninguém marcar nada. Só reportavam para o app errado.

Isso contradiz uma premissa do PRD de Insights (Seção 5.1.1 e Bloqueador 2), que dizia que nada detectava esses dois eventos automaticamente. Verdade para **email** — ninguém lê a caixa de entrada institucional. Falso para **LinkedIn** desde antes do CRM existir.

O botão manual na tela do lead continua: ele cobre o email. Os dois caminhos convivem — um grava por `lead_cnpj`, o outro por `contato_id`.

### Por que o evento passou a aceitar contato além de lead

`funil_prospeccao_eventos` nasceu chaveada por `lead_cnpj`, porque o caminho previsto era o email: o W3 dispara para um lead da Receita Federal, que tem CNPJ.

O LinkedIn conhece uma **pessoa** — nome e URL de perfil. E a empresa por trás frequentemente não tem CNPJ no CRM, porque foi cadastrada pela própria captura do LinkedIn, que não tem de onde tirar um. A migração 015 torna `lead_cnpj` anulável, acrescenta `contato_id` e `canal`, e exige que pelo menos um dos dois esteja preenchido.

A deduplicação virou dois índices parciais. O antigo era `unique (lead_cnpj, tipo_evento)`; com `lead_cnpj` anulável ele deixaria de servir para o LinkedIn, porque NULLs não colidem entre si num índice único do Postgres — e os detectores varrem a mesma tela a cada 30 segundos. Uma tarde com o LinkedIn aberto inflaria a taxa de aceite do mês em dezenas de vezes.

### Como um nome do LinkedIn vira um lead do CRM

Pela URL do perfil quando ela vem (`contatos.linkedin_url`, identidade exata), e por nome quando não vem. O casamento por nome exige que todas as palavras com mais de duas letras do nome mais curto apareçam no mais longo, e que sejam pelo menos duas — um sobrenome em comum é evidência, um primeiro nome sozinho não é.

A busca é limitada aos contatos que **aquele membro** cadastrou (`criado_por_email`). Sem esse recorte, a rede pessoal de uma pessoa marcaria como aceito o lead que outra estava trabalhando: as duas podem conhecer a mesma pessoa no LinkedIn, e só uma a prospectou.

### O que ficou para trás

`agent-mode.js`, `agent-mode-apollo.js`, `agent-mode-csv.js`, `agent-mode-linkedin.js` e `apollo-interceptor.js` — cerca de 2.300 linhas de automação do Apollo.io e processamento de CSV. Elas chamam `/api/agent/process`, `/api/agent/process-apollo` e afins, que não existem no CRM. Trazê-las junto seria trazer código morto que falha em silêncio. Continuam no histórico do `ProjetoApollo` e podem vir depois, com as rotas que elas precisam.

### O que ficou de fora desta rodada

- **UI/telas** — fora de escopo por decisão explícita da especificação (Seção 7 dela: "Telas, layout e componentes de UI ficam para uma etapa posterior").
- **Envio de WhatsApp** — schema pronto (`canais_membro`, `whatsapp_enviados`), envio bloqueado até decisão de provedor (Meta Cloud API vs. Twilio/Z-API etc.). `POST /api/crm/canais/whatsapp/conectar` responde 501 explicando o bloqueio.
- **Migração do módulo Maps para Postgres** — continua em Google Sheets, registrado como backlog explícito na própria especificação.
