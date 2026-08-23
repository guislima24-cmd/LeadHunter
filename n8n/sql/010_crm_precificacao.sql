-- ============================================================================
-- CRM — migração 010: módulo de precificação
-- ============================================================================
-- Implementa `leadhunter-crm-precificacao-prd.md`. Porta para dentro do CRM a
-- calculadora que a UFABC Jr. já usa (o protótipo React "Precificação UFABC
-- Júnior 2026"), com uma diferença: lá cada módulo é um componente com campos
-- de nome próprio no código; aqui a fórmula é a mesma, mas cada peça dela
-- virou linha de tabela. Serviço novo com regra própria entra por cadastro,
-- não por deploy.
--
-- Duas adaptações ao schema real, pelo mesmo motivo da 003: `member_profiles`
-- é chaveado por email, não por uuid — toda FK que o PRD desenhava para
-- `member_profiles(id)` virou `*_email text references member_profiles(email)`.
--
-- Os dois bloqueadores do PRD foram resolvidos assim:
--   1. Taxa/hora dos portes sem valor na calculadora (Empresa Júnior, Para
--      abrir, Indefinido) — resolvido na 009: entram na faixa mais baixa, que
--      é o erro para menos, e o admin corrige na tela de referência.
--   2. Limiar do alerta de desvio — virou coluna configurável com 40% de
--      padrão, em vez de número fixo no código.
-- ============================================================================

create table precificacao_parametros_globais (
  id boolean primary key default true check (id),
  imposto_percentual numeric(5,2) not null default 3,
  percentual_margem_aceitavel numeric(5,2) not null default 90,
  percentual_ponto_equilibrio numeric(5,2) not null default 80,
  limiar_desvio_percentual numeric(5,2) not null default 40,
  atualizado_por_email text references member_profiles(email),
  atualizado_em timestamptz not null default now()
);

insert into precificacao_parametros_globais (id) values (true);

comment on column precificacao_parametros_globais.limiar_desvio_percentual is 'A partir de quantos por cento de diferença para o ticket médio histórico o orçamento mostra o aviso. 40 é o valor sugerido no PRD, que ficou em aberto — por isso está aqui e não no código.';

create table precificacao_faixas_capacidade (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  multiplicador numeric(5,2) not null,
  ordem int,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

insert into precificacao_faixas_capacidade (label, multiplicador, ordem) values
  ('0–20% (Muito Ocioso)', 0.75, 1),
  ('20–40% (Ocioso)', 0.90, 2),
  ('40–60% (Ideal)', 1.00, 3),
  ('60–80% (Sobrecarga Média)', 1.15, 4),
  ('80–100% (Sobrecarga Alta)', 1.30, 5);

comment on table precificacao_faixas_capacidade is 'Quão carregado o time está quando o orçamento é montado. A escolha é manual: o CRM ainda não tem carga de trabalho real para inferir isso.';

alter table produtos_servicos
  add column consultores_padrao int not null default 2,
  add column semanas_padrao int not null default 4;

create table precificacao_dimensoes (
  id uuid primary key default gen_random_uuid(),
  produto_servico_id uuid not null references produtos_servicos(id) on delete cascade,
  nome text not null,
  tipo text not null check (tipo in ('selecao_unica', 'contagem_linear', 'contagem_valor_fixo')),
  valor_minimo numeric,
  valor_maximo numeric,
  incremento_percentual_por_unidade numeric(10,6),
  valor_unitario numeric(10,2),
  ordem int,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create index idx_dimensoes_servico on precificacao_dimensoes(produto_servico_id);

comment on table precificacao_dimensoes is 'O que faz o preço de um serviço subir além de consultores × semanas. Serviço sem nenhuma linha aqui simplesmente não tem markup de complexidade — é assim que um serviço novo entra na calculadora sem deploy. Não confundir com campos_dinamicos_definicao: aqueles guardam metadado sem efeito matemático, estes sempre mexem no valor.';

create table precificacao_dimensao_opcoes (
  id uuid primary key default gen_random_uuid(),
  dimensao_id uuid not null references precificacao_dimensoes(id) on delete cascade,
  label text not null,
  pontos_percentuais numeric(6,2) not null,
  padrao boolean not null default false,
  ordem int,
  ativo boolean not null default true
);

create index idx_dimensao_opcoes_dimensao on precificacao_dimensao_opcoes(dimensao_id);

create table negocio_orcamentos (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references negocios(id) on delete cascade,
  porte_empresa_id uuid not null references portes_empresa(id),
  faixa_capacidade_id uuid not null references precificacao_faixas_capacidade(id),
  valor_ideal numeric(12,2),
  valor_aceitavel numeric(12,2),
  valor_ponto_equilibrio numeric(12,2),
  nivel_proposto text check (nivel_proposto in ('ideal', 'aceitavel', 'ponto_equilibrio')),
  status text not null default 'rascunho' check (status in ('rascunho', 'finalizado')),
  criado_por_email text not null references member_profiles(email),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index idx_orcamentos_negocio on negocio_orcamentos(negocio_id);

comment on table negocio_orcamentos is 'Um negócio pode ter vários orçamentos (revisões); finalizado marca o que virou proposta. O porte nasce sugerido pela organização do negócio mas fica editável — na calculadora atual ele sempre foi escolha manual do cabeçalho.';

create table negocio_orcamento_itens (
  id uuid primary key default gen_random_uuid(),
  orcamento_id uuid not null references negocio_orcamentos(id) on delete cascade,
  produto_servico_id uuid not null references produtos_servicos(id),
  consultores int not null default 1 check (consultores >= 1),
  semanas int not null default 1 check (semanas >= 1),
  custos_extras numeric(12,2) not null default 0,
  valor_base numeric(12,2),
  markup_complexidade numeric(10,4),
  valor_com_markups numeric(12,2),
  extra_fixo numeric(12,2),
  subtotal numeric(12,2),
  valor_final numeric(12,2),
  ordem int,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index idx_orcamento_itens_orcamento on negocio_orcamento_itens(orcamento_id);

comment on table negocio_orcamento_itens is 'Sem unique em (orcamento_id, produto_servico_id) de propósito: o mesmo serviço pode entrar duas vezes com configurações diferentes. As colunas de valor_base a valor_final são fotografia do cálculo no último save — sem elas, mexer na taxa/hora meses depois mudaria em silêncio o valor de um orçamento já fechado.';

create table negocio_orcamento_item_valores (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references negocio_orcamento_itens(id) on delete cascade,
  dimensao_id uuid not null references precificacao_dimensoes(id),
  opcao_id uuid references precificacao_dimensao_opcoes(id),
  valor_numerico numeric,
  unique (item_id, dimensao_id)
);

create index idx_item_valores_item on negocio_orcamento_item_valores(item_id);

-- ----------------------------------------------------------------------------
-- Seeds: a tradução literal do que hoje está fixo no código da calculadora
-- ----------------------------------------------------------------------------
update produtos_servicos set consultores_padrao = 2, semanas_padrao = 4  where nome = 'Pesquisa de Mercado — Secundária';
update produtos_servicos set consultores_padrao = 2, semanas_padrao = 6  where nome = 'Pesquisa de Mercado — Primária';
update produtos_servicos set consultores_padrao = 2, semanas_padrao = 8  where nome = 'Estruturação Comercial';
update produtos_servicos set consultores_padrao = 3, semanas_padrao = 10 where nome = 'Mapeamento de Processos';
update produtos_servicos set consultores_padrao = 3, semanas_padrao = 14 where nome = 'Plano de Negócios';

with d as (
  insert into precificacao_dimensoes
    (produto_servico_id, nome, tipo, valor_minimo, valor_maximo,
     incremento_percentual_por_unidade, valor_unitario, ordem)
  select ps.id, x.nome, x.tipo, x.vmin, x.vmax, x.inc, x.unit, x.ordem
    from (values
      ('Pesquisa de Mercado — Secundária', 'Complexidade de Pesquisa', 'selecao_unica',   null, null, null,     null, 1),
      ('Pesquisa de Mercado — Primária',   'Tipo de Pesquisa',         'selecao_unica',   null, null, null,     null, 1),
      ('Pesquisa de Mercado — Primária',   'Volume de Dados',          'selecao_unica',   null, null, null,     null, 2),
      ('Estruturação Comercial',           'Volume de Treinamentos',   'selecao_unica',   null, null, null,     null, 1),
      ('Estruturação Comercial',           'Ciclo de Implementação',   'selecao_unica',   null, null, null,     null, 2),
      ('Mapeamento de Processos',          'Profundidade Técnica',     'selecao_unica',   null, null, null,     null, 1),
      ('Mapeamento de Processos',          'Quantidade de Setores',    'selecao_unica',   null, null, null,     null, 2),
      -- 5,263158 = 100/19: reproduz o 1 + (entrevistados−1)/19 da calculadora
      ('Mapeamento de Processos',          'Entrevistados',            'contagem_linear',    1,   20, 5.263158, null, 3),
      ('Mapeamento de Processos',          'Quantidade de POPs',       'contagem_valor_fixo',0, null, null,      200, 4),
      ('Plano de Negócios',                'Complexidade do Setor',    'selecao_unica',   null, null, null,     null, 1),
      ('Plano de Negócios',                'Detalhamento Financeiro',  'selecao_unica',   null, null, null,     null, 2)
    ) as x(servico, nome, tipo, vmin, vmax, inc, unit, ordem)
    join produtos_servicos ps on ps.nome = x.servico
  returning id, produto_servico_id, nome
)
insert into precificacao_dimensao_opcoes (dimensao_id, label, pontos_percentuais, padrao, ordem)
select d.id, o.label, o.pontos, o.padrao, o.ordem
  from (values
    ('Complexidade de Pesquisa', 'Simples',             0.0,  true,  1),
    ('Complexidade de Pesquisa', 'Nichado',            10.0,  false, 2),
    ('Complexidade de Pesquisa', 'Complexo',           20.0,  false, 3),
    ('Tipo de Pesquisa',         'Formulários Online', 20.0,  true,  1),
    ('Tipo de Pesquisa',         'Campo/Entrevistas',  30.0,  false, 2),
    ('Volume de Dados',          'Pequeno',             0.0,  true,  1),
    ('Volume de Dados',          'Médio',              10.0,  false, 2),
    ('Volume de Dados',          'Grande',             20.0,  false, 3),
    ('Volume de Treinamentos',   '0 Treinamentos',      0.0,  true,  1),
    ('Volume de Treinamentos',   '1 a 2',              12.0,  false, 2),
    ('Volume de Treinamentos',   '3 ou mais',          25.0,  false, 3),
    ('Ciclo de Implementação',   'Diagnóstico',         0.0,  true,  1),
    ('Ciclo de Implementação',   'Até 4 semanas',      15.0,  false, 2),
    ('Ciclo de Implementação',   'Longo Prazo',        30.0,  false, 3),
    ('Profundidade Técnica',     'Básica',              0.0,  false, 1),
    ('Profundidade Técnica',     'Média',              10.0,  true,  2),
    ('Profundidade Técnica',     'Estratégica',        20.0,  false, 3),
    ('Quantidade de Setores',    'Até 2',               0.0,  false, 1),
    ('Quantidade de Setores',    '3 a 5',              10.0,  true,  2),
    ('Quantidade de Setores',    '+ de 5',             18.0,  false, 3),
    ('Complexidade do Setor',    'Consolidado',         0.0,  false, 1),
    ('Complexidade do Setor',    'Novo Mercado',       20.0,  true,  2),
    ('Complexidade do Setor',    'Alta Disrupção',     40.0,  false, 3),
    ('Detalhamento Financeiro',  'Simplificado',        0.0,  true,  1),
    ('Detalhamento Financeiro',  'Completo (5 anos)',  20.0,  false, 2)
  ) as o(dimensao, label, pontos, padrao, ordem)
  join d on d.nome = o.dimensao;

-- ----------------------------------------------------------------------------
-- RLS: mesmo padrão do resto do CRM — leitura para o domínio, escrita só pela
-- chave de service role da aplicação
-- ----------------------------------------------------------------------------
alter table precificacao_parametros_globais enable row level security;
alter table precificacao_faixas_capacidade enable row level security;
alter table precificacao_dimensoes enable row level security;
alter table precificacao_dimensao_opcoes enable row level security;
alter table negocio_orcamentos enable row level security;
alter table negocio_orcamento_itens enable row level security;
alter table negocio_orcamento_item_valores enable row level security;

create policy "membros_leem_parametros" on precificacao_parametros_globais for select using (is_membro_ufabcjr());
create policy "membros_leem_faixas" on precificacao_faixas_capacidade for select using (is_membro_ufabcjr());
create policy "membros_leem_dimensoes" on precificacao_dimensoes for select using (is_membro_ufabcjr());
create policy "membros_leem_opcoes" on precificacao_dimensao_opcoes for select using (is_membro_ufabcjr());
create policy "membros_leem_orcamentos" on negocio_orcamentos for select using (is_membro_ufabcjr());
create policy "membros_leem_orcamento_itens" on negocio_orcamento_itens for select using (is_membro_ufabcjr());
create policy "membros_leem_item_valores" on negocio_orcamento_item_valores for select using (is_membro_ufabcjr());
