-- ============================================================================
-- CRM — migração 009: porte, catálogo completo de serviços e histórico de preço
-- ============================================================================
-- Pré-requisitos que o PRD do módulo de precificação assume existirem (eram a
-- Seção 14 da especificação do CRM, que nunca foi aplicada ao banco): porte da
-- empresa como catálogo, os serviços que a UFABC Jr. de fato vendeu, e os 242
-- projetos do "Banco de Dados de Projetos UFABC Jr." — sem eles a calculadora
-- não tem taxa/hora por porte nem base de comparação para o alerta de desvio.
--
-- Os 242 projetos saíram do PDF por posição de palavra (o texto de "Serviço"
-- transborda a célula e se mistura com o nome do projeto quando é longo).
-- 18 linhas em que o nome ficou entrelaçado no serviço foram conferidas uma a
-- uma contra o layout original.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- portes_empresa
-- ----------------------------------------------------------------------------
create table portes_empresa (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  -- Taxa/hora usada pela calculadora de precificação. A calculadora atual só
  -- tem três níveis (Micro/Pequena 180, Média 250, Grande 320) e o catálogo
  -- herdado da planilha tem sete. Os quatro sem taxa própria — Empresa Júnior,
  -- Para abrir e Indefinido — entram na faixa mais baixa: é a escolha que erra
  -- para menos, e a tela de referência deixa o admin corrigir sem deploy.
  taxa_hora_padrao numeric(10,2),
  ordem int,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

comment on column portes_empresa.taxa_hora_padrao is 'R$/hora por consultor usado como base do orçamento. Editável pelo admin na tela de referência da precificação.';

-- ----------------------------------------------------------------------------
-- organizacoes ganha o porte
-- ----------------------------------------------------------------------------
alter table organizacoes
  add column porte_empresa_id uuid references portes_empresa(id);

comment on column organizacoes.porte_empresa_id is 'Sugere o porte ao abrir um orçamento para um negócio desta organização; o orçamento guarda a própria escolha e pode divergir.';

-- ----------------------------------------------------------------------------
-- historico_precificacao — o que já foi cobrado, por projeto
-- ----------------------------------------------------------------------------
create table historico_precificacao (
  id uuid primary key default gen_random_uuid(),
  projeto text not null,
  ano int not null,
  setor text,
  ramo text,
  porte_empresa_id uuid references portes_empresa(id),
  status text,
  nps int,
  csat int,
  data_inicio date,
  data_termino date,
  execucao_dias_uteis int,
  preco numeric(12,2),
  -- Os nomes exatamente como estavam na planilha, antes de casar com o
  -- catálogo: se um serviço for renomeado depois, ainda dá para auditar.
  servicos_originais text[] not null default '{}',
  criado_em timestamptz not null default now()
);

create index idx_historico_ano on historico_precificacao(ano);
create index idx_historico_porte on historico_precificacao(porte_empresa_id);

comment on table historico_precificacao is 'Projetos entregues pela UFABC Jr. de 2015 em diante, importados do PDF "Banco de Dados de Projetos". Serve para calibrar a calculadora e comparar um orçamento novo com o que já foi cobrado — não é fonte de nenhum fluxo operacional.';

create table historico_precificacao_servicos (
  historico_id uuid not null references historico_precificacao(id) on delete cascade,
  produto_servico_id uuid not null references produtos_servicos(id),
  primary key (historico_id, produto_servico_id)
);

create index idx_historico_servicos_produto on historico_precificacao_servicos(produto_servico_id);

-- ----------------------------------------------------------------------------
-- Seeds
-- ----------------------------------------------------------------------------
-- catalogo: renomeia o que ja existe (id preservado, FKs intactas)
update produtos_servicos set nome = 'Mapeamento de Processos' where id = '1d900228-312a-4039-8331-e4d73e2cb6cc';
update produtos_servicos set nome = 'Pesquisa de Mercado — Secundária' where id = '2efe3235-e4ab-4af0-8c5b-ac8e8550602b';
update produtos_servicos set nome = 'Estruturação Comercial' where id = '3c59209c-ab82-4e64-98a9-424bfbaa1b3b';
update produtos_servicos set nome = 'Dados e Automação' where id = '978c13cb-154e-4cb6-ae69-7e4d41a96d2e';

insert into produtos_servicos (nome, ordem) values
  ('Pesquisa de Mercado — Primária', 5),
  ('Plano de Negócios', 6),
  ('Plano de Marketing', 7),
  ('Análise Financeira', 8),
  ('Análise de Dados', 9),
  ('Análise Georreferenciada', 10),
  ('Análise e Implementação', 11),
  ('Benchmarking', 12),
  ('CRM', 13),
  ('Desenvolvimento de Site', 14),
  ('Desenvolvimento de Software', 15),
  ('Gestão Financeira', 16),
  ('Gestão de Evento', 17),
  ('Gestão e Logística', 18),
  ('Mapeamento de Cultura', 19),
  ('Rendimento e controle de produção', 20),
  ('Shop in Shop', 21),
  ('Treinamento', 22);

insert into portes_empresa (nome, taxa_hora_padrao, ordem) values
  ('Microempresa', 180, 1),
  ('Pequeno Porte', 180, 2),
  ('Médio Porte', 250, 3),
  ('Grande Porte', 320, 4),
  ('Empresa Júnior', 180, 5),
  ('Para abrir', 180, 6),
  ('Indefinido', 180, 7);

-- 242 projetos extraidos do PDF 'Banco de Dados de Projetos UFABC Jr.'
insert into historico_precificacao
  (projeto, ano, setor, ramo, porte_empresa_id, status, nps, csat,
   data_inicio, data_termino, execucao_dias_uteis, preco, servicos_originais)
values
  ('Acepusp', 2015, 'Serviço', 'Educação', (select id from portes_empresa where nome = 'Indefinido'), 'Finalizado', null, null, '2015-01-08', '2015-04-25', 74, 1807.29, '{"Desenvolvimento de Site"}'),
  ('Camila Delievery', 2015, 'Serviço', 'Alimenticio', (select id from portes_empresa where nome = 'Microempresa'), null, null, null, null, null, 0, 0.0, '{"Desenvolvimento de Site"}'),
  ('Prefeitura Universitária', 2015, 'Serviço', 'Educação', (select id from portes_empresa where nome = 'Indefinido'), 'Finalizado', null, null, '2015-02-17', '2015-09-08', 140, 0.0, '{"Mapeamento de Processos"}'),
  ('Restaurante e Lanchonete Bom Gosto', 2015, 'Serviço', 'Alimenticio', (select id from portes_empresa where nome = 'Microempresa'), 'Finalizado', null, null, '2015-11-25', '2016-02-06', 51, 0.0, '{"Mapeamento de Processos"}'),
  ('Restaurante e Lanchonete Bom Gosto', 2015, 'Serviço', 'Alimenticio', (select id from portes_empresa where nome = 'Microempresa'), 'Finalizado', null, null, '2015-09-16', '2015-10-21', 25, 0.0, '{"Mapeamento de Processos"}'),
  ('Restaurante e Lanchonete Bom Gosto', 2015, 'Serviço', 'Alimenticio', (select id from portes_empresa where nome = 'Microempresa'), 'Finalizado', null, null, '2015-09-16', '2015-10-21', 25, 280.0, '{"Pesquisa de Mercado"}'),
  ('Marketing Digital', 2015, 'Serviço', 'Marketing', (select id from portes_empresa where nome = 'Microempresa'), 'Finalizado', null, null, '2015-09-03', '2015-09-08', 3, 0.0, '{"Pesquisa de Mercado"}'),
  ('Rockefeller', 2016, 'Serviço', 'Educação', (select id from portes_empresa where nome = 'Médio Porte'), 'Finalizado', null, null, '2016-08-22', '2016-09-12', 15, 0.0, '{"Pesquisa de Mercado"}'),
  ('SUED', 2016, 'Serviço', null, (select id from portes_empresa where nome = 'Indefinido'), 'Finalizado', null, null, '2016-09-15', '2016-10-20', 25, 0.0, '{"Gestão e Logística","Desenvolvimento de Site","CRM"}'),
  ('UFABC jr.', 2016, 'Serviço', 'EJ', (select id from portes_empresa where nome = 'Empresa Júnior'), 'Finalizado', null, null, '2016-08-22', '2016-08-27', 5, 0.0, '{"Treinamento"}'),
  ('Baja', 2017, 'Serviço', 'Automotivo', (select id from portes_empresa where nome = 'Microempresa'), 'Cancelado', null, null, null, null, 0, 0.0, '{"Treinamento"}'),
  ('Baja', 2017, 'Serviço', 'Automotivo', (select id from portes_empresa where nome = 'Microempresa'), 'Cancelado', null, null, null, null, 0, 0.0, '{"Pesquisa de Mercado"}'),
  ('Baja', 2017, 'Serviço', 'Marketing Automotivo', (select id from portes_empresa where nome = 'Microempresa'), 'Finalizado', null, null, '2017-06-17', '2017-07-20', 24, 0.0, '{"Plano de Negócios","Análise Financeira","Plano de Marketing"}'),
  ('Cactus Grill', 2017, 'Serviço', 'Alimenticio', (select id from portes_empresa where nome = 'Microempresa'), 'Finalizado', null, null, '2016-09-01', '2016-11-20', 53, 226.78, '{"Pesquisa de Mercado"}'),
  ('Colibri', 2017, 'Serviço', 'Transporte', (select id from portes_empresa where nome = 'Microempresa'), 'Finalizado', null, null, '2017-07-27', '2017-10-27', 65, 300.0, '{"Pesquisa de Mercado"}'),
  ('Krispian Modas 2', 2017, 'Comércio', 'Vestuário', (select id from portes_empresa where nome = 'Microempresa'), 'Finalizado', null, null, '2017-07-24', '2017-10-25', 66, 2279.83, '{"Plano de Marketing"}'),
  ('Metávoli', 2017, 'Serviço', 'Consultoria', (select id from portes_empresa where nome = 'Microempresa'), 'Finalizado', null, null, '2017-06-22', '2017-09-25', 67, 312.75, '{"Gestão de Evento"}'),
  ('Passei de Boa', 2017, 'Serviço', 'Educação', (select id from portes_empresa where nome = 'Para abrir'), 'Finalizado', null, null, '2017-07-25', '2017-11-25', 85, 958.02, '{"Análise Financeira"}'),
  ('Passei de Boa', 2017, 'Serviço', 'Educação', (select id from portes_empresa where nome = 'Para abrir'), 'Finalizado', null, null, '2017-07-25', '2017-10-25', 65, 1277.35, '{"Pesquisa de Mercado"}'),
  ('Ramsés II', 2017, 'Serviço', 'Entretenimento', (select id from portes_empresa where nome = 'Pequeno Porte'), 'Finalizado', null, null, null, null, 0, 0.0, '{"Mapeamento de Processos","Pesquisa de Mercado"}'),
  ('UFABC jr.', 2017, 'Serviço', 'EJ', (select id from portes_empresa where nome = 'Empresa Júnior'), 'Finalizado', null, null, '2017-02-19', '2017-03-26', 24, 0.0, '{"Pesquisa de Mercado"}'),
  ('UFABC jr.', 2017, 'Serviço', 'EJ', (select id from portes_empresa where nome = 'Empresa Júnior'), 'Finalizado', null, null, '2017-06-08', '2017-09-01', 61, 0.0, '{"Estruturação Comercial"}'),
  ('Krispian Modas 2', 2017, 'Comércio', 'Vestuário', (select id from portes_empresa where nome = 'Microempresa'), 'Finalizado', null, null, '2017-07-19', '2017-08-03', 12, 230.0, '{}'),
  ('AdHoc', 2018, 'Serviço', 'Consultoria', (select id from portes_empresa where nome = 'Pequeno Porte'), 'Cancelado', null, null, null, null, 0, 0.0, '{"Pesquisa de Mercado"}'),
  ('Central do Paladar', 2018, 'Comércio', 'Alimenticio', (select id from portes_empresa where nome = 'Pequeno Porte'), 'Finalizado', null, null, '2018-07-01', '2018-12-01', 106, 1958.5, '{"Pesquisa de Mercado","Análise Financeira"}'),
  ('Consultoria Mecânica', 2018, 'Comércio', 'Consultoria', (select id from portes_empresa where nome = 'Pequeno Porte'), 'Finalizado', null, null, '2018-03-15', '2018-06-15', 64, 1874.53, '{"Pesquisa de Mercado","Análise Financeira","Plano de Marketing"}'),
  ('Cortadora à Laser', 2018, 'Comércio', 'Serviços Especializados', (select id from portes_empresa where nome = 'Pequeno Porte'), 'Finalizado', null, null, '2018-05-07', '2018-07-07', 44, 0.0, '{"Pesquisa de Mercado"}'),
  ('CrediteOnline', 2018, 'Comércio', 'Financeiro', (select id from portes_empresa where nome = 'Pequeno Porte'), 'Finalizado', null, null, '2018-03-14', '2018-04-21', 27, 2049.9, '{"Análise de Dados"}'),
  ('Empório Figueira', 2018, 'Comércio', 'Alimenticio', (select id from portes_empresa where nome = 'Microempresa'), 'Finalizado', null, null, '2018-06-06', '2018-10-08', 88, 2900.0, '{"Mapeamento de Processos"}'),
  ('Filho Sem Fila', 2018, 'Serviço', 'Transporte', (select id from portes_empresa where nome = 'Médio Porte'), 'Finalizado', null, null, '2018-11-05', '2018-12-20', 33, 2400.0, '{"Pesquisa de Mercado"}'),
  ('Free Soul Food', 2018, 'Comércio', 'Alimenticio', (select id from portes_empresa where nome = 'Pequeno Porte'), 'Finalizado', null, null, '2018-03-19', '2018-05-15', 40, 2876.7, '{"Plano de Negócios"}'),
  ('Lumiar', 2018, 'Comércio', null, (select id from portes_empresa where nome = 'Médio Porte'), 'Cancelado', null, null, null, null, 0, 0.0, '{"Análise de Dados"}'),
  ('Natuh', 2018, 'Comércio', 'Cosméticos', (select id from portes_empresa where nome = 'Pequeno Porte'), 'Finalizado', null, null, '2018-01-15', '2018-03-16', 44, 2700.0, '{"Pesquisa de Mercado"}'),
  ('Pétala', 2018, 'Comércio', 'Serviços Especializados', (select id from portes_empresa where nome = 'Médio Porte'), 'Finalizado', null, null, '2018-03-21', '2018-06-01', 50, 876.25, '{"Pesquisa de Mercado"}'),
  ('Pirelli', 2018, 'Indústria', 'Serviços Especializados', (select id from portes_empresa where nome = 'Grande Porte'), 'Finalizado', null, null, '2018-08-06', '2018-10-14', 48, 10500.0, '{"Mapeamento de Processos"}'),
  ('Pizzaria 021', 2018, 'Serviço', 'Alimenticio', (select id from portes_empresa where nome = 'Pequeno Porte'), 'Finalizado', null, null, '2018-09-25', '2018-11-27', 43, 1209.0, '{"Plano de Marketing"}'),
  ('Power of Data', 2018, 'Serviço', 'Tecnológico', (select id from portes_empresa where nome = 'Pequeno Porte'), 'Finalizado', null, null, '2018-09-10', '2018-10-12', 24, 1500.0, '{"Desenvolvimento de Software"}'),
  ('Seguradora Online', 2018, 'Serviço', 'Serviços Especializados', (select id from portes_empresa where nome = 'Pequeno Porte'), 'Finalizado', null, null, '2018-05-16', '2018-07-14', 42, 0.0, '{"Pesquisa de Mercado"}'),
  ('Siriguela', 2018, 'Comércio', 'Alimenticio', (select id from portes_empresa where nome = 'Pequeno Porte'), 'Finalizado', null, null, '2018-03-22', '2018-08-21', 106, 1213.9, '{"Plano de Marketing"}'),
  ('A.Craft Piloto', 2019, 'Comércio, Serviço', 'Varejo', (select id from portes_empresa where nome = 'Microempresa'), 'Finalizado', null, null, '2019-05-13', '2019-06-24', 30, 3200.0, '{"Shop in Shop"}'),
  ('Apoio Consultoria: Junco', 2019, 'Comércio, Serviço', 'Consultoria', (select id from portes_empresa where nome = 'Grande Porte'), 'Finalizado', null, null, '2019-07-30', '2019-11-26', 85, 6800.0, '{"Pesquisa de Mercado"}'),
  ('BASF', 2019, 'Comércio, Serviço', 'Comércio', (select id from portes_empresa where nome = 'Grande Porte'), 'Finalizado', null, null, '2019-10-04', '2019-11-01', 21, 2891.0, '{"Pesquisa de Mercado"}'),
  ('Biotera', 2019, 'Serviço', 'Consultoria', (select id from portes_empresa where nome = 'Pequeno Porte'), 'Finalizado', null, null, '2019-10-10', '2019-12-12', 45, 4000.0, '{"Pesquisa de Mercado"}'),
  ('Codeby', 2019, 'Serviço', 'Varejo', (select id from portes_empresa where nome = 'Pequeno Porte'), 'Finalizado', null, null, '2019-08-21', '2019-10-14', 39, 4000.0, '{"Mapeamento de Processos"}'),
  ('Contraste', 2019, 'Serviço', 'Arquitetura', (select id from portes_empresa where nome = 'Médio Porte'), 'Finalizado', null, null, '2019-11-11', '2020-01-01', 35, 3696.0, '{"Plano de Marketing"}'),
  ('CrediPonto', 2019, 'Serviço', 'Financeiro', (select id from portes_empresa where nome = 'Grande Porte'), 'Finalizado', null, null, '2019-11-21', '2020-01-20', 41, 5400.0, '{"Pesquisa de Mercado"}'),
  ('Croasonho', 2019, 'Comércio, Serviço', 'Alimenticio', (select id from portes_empresa where nome = 'Pequeno Porte'), 'Finalizado', null, null, '2019-05-22', '2019-06-28', 27, 3541.67, '{"Pesquisa de Mercado","Análise de Dados"}'),
  ('Cuor di Crema', 2019, 'Serviço', 'Alimenticio', (select id from portes_empresa where nome = 'Médio Porte'), 'Finalizado', null, null, '2019-10-16', '2020-03-11', 102, 6433.0, '{"Plano de Marketing"}'),
  ('Dengo Chocolates', 2019, 'Comércio', 'Alimenticio', (select id from portes_empresa where nome = 'Grande Porte'), 'Finalizado', null, null, '2019-06-03', '2019-08-14', 52, 3000.0, '{"Plano de Marketing"}'),
  ('Distribuidora Vitalli', 2019, 'Serviço', 'Distribuidora', (select id from portes_empresa where nome = 'Médio Porte'), 'Finalizado', null, null, '2019-06-03', '2019-06-24', 15, 2746.12, '{"Mapeamento de Processos"}'),
  ('EAD MED USP', 2019, 'Serviço', 'Saúde', (select id from portes_empresa where nome = 'Indefinido'), 'Finalizado', null, null, '2019-12-02', '2020-01-22', 36, 3400.9, '{"Análise de Dados"}'),
  ('Filho Sem Fila', 2019, 'Serviço', 'Transporte', (select id from portes_empresa where nome = 'Pequeno Porte'), 'Finalizado', null, null, '2019-08-26', '2019-10-09', 33, 2000.0, '{"Pesquisa de Mercado"}'),
  ('Kulinara', 2019, 'Serviço', 'Alimenticio', (select id from portes_empresa where nome = 'Microempresa'), 'Finalizado', null, null, '2019-06-24', '2019-08-02', 30, 2786.52, '{"Pesquisa de Mercado"}'),
  ('Ladder', 2019, 'Serviço', 'Vestuário', (select id from portes_empresa where nome = 'Pequeno Porte'), 'Finalizado', null, null, '2019-10-18', '2019-12-20', 45, 7500.0, '{"Treinamento"}'),
  ('Metalpart', 2019, 'Serviço', 'Comércio', (select id from portes_empresa where nome = 'Pequeno Porte'), 'Finalizado', null, null, '2019-07-18', '2019-08-15', 21, 2400.0, '{"Mapeamento de Processos"}'),
  ('Natural Jardim', 2019, 'Comércio', 'Alimenticio', (select id from portes_empresa where nome = 'Pequeno Porte'), 'Finalizado', null, null, '2019-10-16', '2019-12-18', 45, 4500.0, '{"Análise e Implementação"}'),
  ('Plury Química', 2019, 'Serviço', 'Químico', (select id from portes_empresa where nome = 'Pequeno Porte'), 'Finalizado', null, null, '2019-08-08', '2019-09-25', 35, 5950.0, '{"Mapeamento de Processos"}'),
  ('Ronnelly', 2019, 'Comércio', 'Vestuário', (select id from portes_empresa where nome = 'Pequeno Porte'), 'Finalizado', null, null, '2019-01-27', '2019-02-26', 22, 500.0, '{"Análise e Implementação"}'),
  ('Snack Frutas Análise de', 2019, 'Comércio', 'Alimenticio', (select id from portes_empresa where nome = 'Pequeno Porte'), 'Finalizado', null, null, '2019-04-01', '2019-05-17', 33, 4100.0, '{"Rendimento e controle de produção"}'),
  ('Zino', 2019, 'Comércio', 'Alimenticio', (select id from portes_empresa where nome = 'Pequeno Porte'), 'Finalizado', null, null, '2019-08-20', '2019-10-07', 35, 13283.8, '{"Plano de Negócios"}'),
  ('AEC jr.', 2020, 'Serviço', 'EJ', (select id from portes_empresa where nome = 'Empresa Júnior'), 'Finalizado', null, null, '2020-06-10', '2020-07-23', 31, 1400.0, '{"Desenvolvimento de Site"}'),
  ('Auto Jun', 2020, 'Serviço', 'Serviços Especializados', (select id from portes_empresa where nome = 'Empresa Júnior'), 'Finalizado', null, null, '2020-12-03', '2021-02-10', 48, 2000.0, '{"Desenvolvimento de Site"}'),
  ('Biotera', 2020, 'Serviço', 'Consultoria', (select id from portes_empresa where nome = 'Pequeno Porte'), 'Finalizado', null, null, '2020-01-27', '2020-03-04', 27, 3400.0, '{"Plano de Marketing"}'),
  ('Caraxi', 2020, 'Comércio', 'Vestuário', (select id from portes_empresa where nome = 'Microempresa'), 'Finalizado', null, null, '2020-08-26', '2020-10-06', 29, 3000.0, '{"Plano de Marketing"}'),
  ('FEA jr. (Clínica Médica)', 2020, 'Serviço', 'Consultoria', (select id from portes_empresa where nome = 'Empresa Júnior'), 'Finalizado', null, null, '2020-06-17', '2020-07-17', 23, 3750.0, '{"Plano de Marketing"}'),
  ('Comunique', 2020, 'Serviço', 'Assessoria', (select id from portes_empresa where nome = 'Pequeno Porte'), 'Finalizado', null, null, '2020-05-08', '2020-06-08', 22, 1330.0, '{"Desenvolvimento de Site"}'),
  ('Consis', 2020, 'Serviço', 'Segurança', (select id from portes_empresa where nome = 'Pequeno Porte'), 'Finalizado', null, null, '2020-04-06', '2020-06-01', 38, 5600.0, '{"Estruturação Comercial"}'),
  ('Consis 2', 2020, 'Serviço', 'Segurança', (select id from portes_empresa where nome = 'Pequeno Porte'), 'Finalizado', null, null, '2020-05-12', '2020-06-26', 33, 1400.0, '{"Desenvolvimento de Site"}'),
  ('Continental', 2020, 'Serviço', 'Vestuário', (select id from portes_empresa where nome = 'Grande Porte'), 'Finalizado', null, null, '2020-01-06', '2020-03-05', 43, 5500.0, '{"Pesquisa de Mercado"}'),
  ('Da Terra Alimentos', 2020, 'Indústria', 'Alimenticio', (select id from portes_empresa where nome = 'Pequeno Porte'), 'Finalizado', null, null, '2020-07-20', '2020-11-25', 90, 4500.0, '{"Desenvolvimento de Site"}'),
  ('DASA MDH/MDP', 2020, 'Serviço', 'Serviços Especializados', (select id from portes_empresa where nome = 'Grande Porte'), 'Finalizado', null, null, '2020-02-17', '2021-01-27', 238, 23100.0, '{"Treinamento"}'),
  ('Electricus', 2020, 'Indústria', 'Tecnológico', (select id from portes_empresa where nome = 'Microempresa'), 'Finalizado', null, null, '2020-05-19', '2020-07-03', 33, 1700.0, '{"Desenvolvimento de Site"}'),
  ('Everbyte', 2020, 'Comércio', 'Comércio', (select id from portes_empresa where nome = 'Pequeno Porte'), 'Finalizado', null, null, '2020-02-13', '2020-04-13', 41, 1900.0, '{"Pesquisa de Mercado"}'),
  ('Farma Delivery', 2020, 'Serviço', 'Saúde', (select id from portes_empresa where nome = 'Médio Porte'), 'Finalizado', null, null, '2020-07-14', '2020-10-26', 73, 18000.0, '{"Mapeamento de Processos"}'),
  ('FEA jr. (Loja de materiais)', 2020, 'Serviço', 'Consultoria', (select id from portes_empresa where nome = 'Empresa Júnior'), 'Finalizado', null, null, '2020-08-20', '2020-10-23', 45, 1100.0, '{"Análise Georreferenciada"}'),
  ('FEA jr. (Restaurante)', 2020, 'Comércio', 'Consultoria', (select id from portes_empresa where nome = 'Empresa Júnior'), 'Finalizado', null, null, '2020-10-21', '2020-10-28', 6, 1250.0, '{"Análise Georreferenciada"}'),
  ('FEA jr. (Carla - Estúdio Cílios)', 2020, 'Comércio', 'Consultoria', (select id from portes_empresa where nome = 'Empresa Júnior'), 'Finalizado', null, null, '2020-10-08', '2020-10-13', 3, 1250.0, '{"Análise Georreferenciada"}'),
  ('FEA jr. (Eclipsemotel)', 2020, 'Serviço', 'Consultoria', (select id from portes_empresa where nome = 'Empresa Júnior'), 'Finalizado', null, null, '2020-09-17', '2020-10-21', 24, 1250.0, '{"Análise Georreferenciada"}'),
  ('FEA jr. (Hospital Veterinário)', 2020, 'Serviço', 'Consultoria', (select id from portes_empresa where nome = 'Empresa Júnior'), 'Finalizado', null, null, '2020-08-17', '2020-11-10', 59, 1100.0, '{"Pesquisa de Mercado"}'),
  ('FEA jr. (Pizzaria em perdizes)', 2020, 'Comércio', 'Consultoria', (select id from portes_empresa where nome = 'Empresa Júnior'), 'Finalizado', null, null, '2020-10-21', '2020-11-11', 15, 1250.0, '{"Pesquisa de Mercado"}'),
  ('Granponto', 2020, 'Serviço', 'Serviços Especializados', (select id from portes_empresa where nome = 'Pequeno Porte'), 'Finalizado', null, null, '2020-06-29', '2020-08-24', 41, 5600.0, '{"Desenvolvimento de Site"}'),
  ('Kap', 2020, 'Serviço', 'Serviços Especializados', (select id from portes_empresa where nome = 'Pequeno Porte'), 'Finalizado', 10, 10, '2020-05-27', '2020-07-24', 42, 3700.0, '{"Análise de Dados"}'),
  ('Let''s Go Travel', 2020, 'Serviço', 'Tecnológico', (select id from portes_empresa where nome = 'Pequeno Porte'), 'Finalizado', null, null, '2020-08-10', '2020-10-30', 58, 11060.0, '{"Plano de Negócios"}'),
  ('Loja Japonesa', 2020, 'Comércio', 'Comércio', (select id from portes_empresa where nome = 'Microempresa'), 'Finalizado', null, null, '2020-06-08', '2020-07-28', 36, 4000.0, '{"Desenvolvimento de Site"}'),
  ('M2D1', 2020, 'Serviço', 'Biotecnologia', (select id from portes_empresa where nome = 'Pequeno Porte'), 'Finalizado', null, null, '2020-05-04', '2020-07-17', 54, 10700.0, '{"Plano de Negócios","Desenvolvimento de Site"}'),
  ('MedPlace', 2020, 'Comércio', 'Saúde', (select id from portes_empresa where nome = 'Microempresa'), 'Finalizado', null, null, '2020-03-12', '2020-04-16', 25, 1995.0, '{"Pesquisa de Mercado"}'),
  ('Mkt jr. USP', 2020, 'Serviço', 'Marketing', (select id from portes_empresa where nome = 'Empresa Júnior'), 'Finalizado', null, null, '2020-01-21', '2020-03-10', 35, 3000.0, '{"Pesquisa de Mercado"}'),
  ('Nova Imagem Radiologia', 2020, 'Serviço', 'Saúde', (select id from portes_empresa where nome = 'Pequeno Porte'), 'Finalizado', null, null, '2020-08-19', '2020-09-30', 30, 2565.0, '{"Análise de Dados"}'),
  ('Nutri jr.', 2020, 'Serviço', 'Saúde', (select id from portes_empresa where nome = 'Empresa Júnior'), 'Finalizado', null, null, '2020-05-19', '2020-09-18', 87, 2000.0, '{"Desenvolvimento de Site"}'),
  ('Parceria Acisa', 2020, 'Indústria', 'Comércio', (select id from portes_empresa where nome = 'Indefinido'), 'Finalizado', null, null, '2020-06-10', '2020-07-08', 20, 0.0, '{"Pesquisa de Mercado"}'),
  ('Planium', 2020, 'Serviço', 'Serviços Especializados', (select id from portes_empresa where nome = 'Pequeno Porte'), 'Finalizado', null, null, '2020-07-20', '2020-09-15', 41, 9500.0, '{"Estruturação Comercial"}'),
  ('Química jr.', 2020, 'Serviço', 'Químico', (select id from portes_empresa where nome = 'Empresa Júnior'), 'Finalizado', null, null, '2020-05-26', '2020-06-12', 13, 1260.0, '{"Desenvolvimento de Site"}'),
  ('Refriac', 2020, 'Indústria', 'Comércio', (select id from portes_empresa where nome = 'Pequeno Porte'), 'Finalizado', null, null, '2020-09-25', '2020-12-04', 49, 8700.0, '{"Mapeamento de Processos"}'),
  ('Renata', 2020, 'Comércio', 'Comércio', (select id from portes_empresa where nome = 'Microempresa'), 'Finalizado', null, null, '2020-10-26', '2020-12-11', 34, 5000.0, '{"Plano de Negócios"}'),
  ('Spazio Santo Disco', 2020, 'Comércio', 'Alimenticio', (select id from portes_empresa where nome = 'Pequeno Porte'), 'Paralisado', null, null, '2020-03-09', '2020-04-06', 21, 3900.0, '{"Estruturação Comercial"}'),
  ('Wax Green', 2020, 'Comércio', 'Alimenticio', (select id from portes_empresa where nome = 'Pequeno Porte'), 'Finalizado', null, null, '2020-08-12', '2020-11-12', 64, 6800.0, '{"Estruturação Comercial"}'),
  ('Welllife', 2020, 'Serviço', 'Comércio', (select id from portes_empresa where nome = 'Para abrir'), 'Finalizado', null, null, '2020-08-17', '2020-10-02', 34, 3800.0, '{"Plano de Negócios"}'),
  ('Caraminholas', 2021, 'Serviço', 'Educação', (select id from portes_empresa where nome = 'Para abrir'), 'Finalizado', 10, null, '2021-01-05', '2021-03-13', 48, 6175.0, '{"Pesquisa de Mercado","Análise Financeira"}'),
  ('BitPreço', 2021, 'Serviço', 'Financeiro', (select id from portes_empresa where nome = 'Médio Porte'), 'Finalizado', 9, null, '2021-01-18', '2021-08-07', 141, 7500.0, '{"Pesquisa de Mercado"}'),
  ('FEA (PeopleScope) -', 2021, 'Serviço', 'EJ', (select id from portes_empresa where nome = 'Empresa Júnior'), 'Finalizado', 10, null, '2021-04-19', '2021-04-24', 4, 1500.0, '{"Plano de Negócios","Análise Georreferenciada"}'),
  ('FEA (PeopleScope) - Clínica Médica', 2021, 'Serviço', 'EJ', (select id from portes_empresa where nome = 'Empresa Júnior'), 'Finalizado', 10, null, '2021-01-21', '2021-01-26', 4, 1500.0, '{"Análise Georreferenciada"}'),
  ('Dasa MDP 1', 2021, 'Serviço', 'Saúde', (select id from portes_empresa where nome = 'Grande Porte'), 'Finalizado', 10, null, '2021-03-03', '2021-04-12', 28, 17000.0, '{"Treinamento"}'),
  ('Ottus Construtora', 2021, 'Serviço', 'Construção Civil', (select id from portes_empresa where nome = 'Médio Porte'), 'Cancelado', null, null, '2021-02-08', '2021-04-09', 43, 2500.0, '{"Desenvolvimento de Site"}'),
  ('Realeza Alimentos', 2021, 'Indústria', 'Alimenticio', (select id from portes_empresa where nome = 'Médio Porte'), 'Finalizado', null, null, '2021-02-11', '2021-03-17', 24, 6700.0, '{"Pesquisa de Mercado"}'),
  ('Integra', 2021, 'Serviço', 'EJ', (select id from portes_empresa where nome = 'Empresa Júnior'), 'Finalizado', 10, null, '2021-02-25', '2021-04-23', 40, 1300.0, '{"Pesquisa de Mercado"}'),
  ('Constru Jr', 2021, 'Serviço', 'EJ', (select id from portes_empresa where nome = 'Empresa Júnior'), 'Finalizado', 10, null, '2021-03-03', '2021-04-22', 35, 2000.0, '{"Desenvolvimento de Site","Pesquisa de Mercado"}'),
  ('FEA (PeopleScope) - Clínica Médica MT', 2021, 'Serviço', 'EJ', (select id from portes_empresa where nome = 'Empresa Júnior'), 'Finalizado', 10, null, '2021-03-08', '2021-03-12', 5, 1500.0, '{"Análise Georreferenciada"}'),
  ('Eletricus', 2021, 'Serviço', 'Serviços Especializados', (select id from portes_empresa where nome = 'Médio Porte'), 'Cancelado', null, null, '2021-03-17', '2021-04-14', 20, 1700.0, '{"Desenvolvimento de Site"}'),
  ('Dasa 4.1', 2021, 'Serviço', 'Saúde', (select id from portes_empresa where nome = 'Grande Porte'), 'Finalizado', 9, null, '2021-04-05', '2021-10-06', 130, 19400.0, '{"Treinamento"}'),
  ('Dasa 4.2', 2021, 'Serviço', 'Saúde', (select id from portes_empresa where nome = 'Grande Porte'), 'Finalizado', null, null, '2021-04-05', '2021-10-18', 137, 18600.0, '{"Treinamento"}'),
  ('Faro Food', 2021, 'Comércio', 'Pet', (select id from portes_empresa where nome = 'Para abrir'), 'Finalizado', 10, null, '2021-04-05', '2021-06-14', 49, 7200.0, '{"Plano de Negócios"}'),
  ('THM Estatísticas', 2021, 'Serviço', 'Educação', (select id from portes_empresa where nome = 'Pequeno Porte'), 'Finalizado', 10, null, '2021-04-05', '2021-05-07', 24, 4975.0, '{"Plano de Marketing"}'),
  ('FEA (People Scope) - Pet Shop', 2021, 'Serviço', 'EJ', (select id from portes_empresa where nome = 'Empresa Júnior'), 'Finalizado', 10, null, '2021-04-19', '2021-04-23', 4, 1500.0, '{"Análise Georreferenciada"}'),
  ('Aperam 1 - Biogás', 2021, 'Indústria', 'Metalurgico', (select id from portes_empresa where nome = 'Grande Porte'), 'Finalizado', 10, null, '2021-04-23', '2021-06-11', 35, 5000.0, '{"Pesquisa de Mercado"}'),
  ('Aperam 2 - Chapa Expandida', 2021, 'Indústria', 'Metalurgico', (select id from portes_empresa where nome = 'Grande Porte'), 'Finalizado', 10, null, '2021-04-23', '2021-06-11', 35, 5000.0, '{"Pesquisa de Mercado"}'),
  ('Casa Coralinda', 2021, 'Serviço', 'Serviços Especializados', (select id from portes_empresa where nome = 'Médio Porte'), 'Finalizado', 10, null, '2021-05-19', '2021-07-26', 48, 6000.0, '{"Pesquisa de Mercado","Plano de Marketing"}'),
  ('Dannemann Siemsen (Romplas)', 2021, 'Serviço', 'Advocacia', (select id from portes_empresa where nome = 'Médio Porte'), 'Finalizado', 10, null, '2021-05-26', '2021-06-11', 12, 5000.0, '{"Pesquisa de Mercado"}'),
  ('Bom Bowls', 2021, 'Comércio', 'Alimenticio', (select id from portes_empresa where nome = 'Médio Porte'), 'Finalizado', 10, null, '2021-06-16', '2021-07-16', 23, 3800.0, '{"Pesquisa de Mercado","Plano de Marketing"}'),
  ('Brasil Fruitt', 2021, 'Indústria', 'Alimenticio', (select id from portes_empresa where nome = 'Médio Porte'), 'Finalizado', 9, null, '2021-06-28', '2021-08-20', 40, 15000.0, '{"Mapeamento de Processos","Análise Financeira"}'),
  ('Riccheezza', 2021, 'Serviço', 'Construção Civil', (select id from portes_empresa where nome = 'Médio Porte'), 'Finalizado', 9, null, '2021-07-05', '2021-08-24', 37, 5500.0, '{"Plano de Marketing","Pesquisa de Mercado"}'),
  ('MedLabo Work', 2021, 'Serviço', 'Saúde', (select id from portes_empresa where nome = 'Médio Porte'), 'Finalizado', 10, null, '2021-06-28', '2021-07-30', 25, 5800.0, '{"Pesquisa de Mercado","Análise Financeira"}'),
  ('Aperam 3 - Caixa de Energia', 2021, 'Indústria', 'Metalurgico', (select id from portes_empresa where nome = 'Grande Porte'), 'Finalizado', 10, null, '2021-07-12', '2021-08-30', 36, 5000.0, '{"Pesquisa de Mercado"}'),
  ('Aperam 4 - Caixa d''Água', 2021, 'Indústria', 'Metalurgico', (select id from portes_empresa where nome = 'Grande Porte'), 'Finalizado', 10, null, '2021-07-12', '2021-08-30', 36, 5000.0, '{"Pesquisa de Mercado"}'),
  ('Aperam 5 - Carreta Canavieira', 2021, 'Indústria', 'Metalurgico', (select id from portes_empresa where nome = 'Grande Porte'), 'Finalizado', 10, null, '2021-07-12', '2021-08-30', 36, 5000.0, '{"Pesquisa de Mercado"}'),
  ('Aperam 6 - Energia Eólica', 2021, 'Indústria', 'Metalurgico', (select id from portes_empresa where nome = 'Grande Porte'), 'Finalizado', 10, null, '2021-07-12', '2021-08-30', 36, 5000.0, '{"Pesquisa de Mercado"}'),
  ('Dasa MDP 2.1', 2021, 'Serviço', 'Saúde', (select id from portes_empresa where nome = 'Grande Porte'), 'Finalizado', 10, null, '2021-07-01', '2021-09-02', 46, 12750.0, '{"Treinamento"}'),
  ('Ateliê', 2021, 'Serviço', 'Educação', (select id from portes_empresa where nome = 'Pequeno Porte'), 'Finalizado', 10, null, '2021-07-12', '2021-09-09', 43, 2000.0, '{"Pesquisa de Mercado","Plano de Marketing"}'),
  ('Heartman House', 2021, 'Serviço', 'Consultoria', (select id from portes_empresa where nome = 'Médio Porte'), 'Finalizado', null, null, '2021-07-13', '2021-07-22', 8, 15000.0, '{"Pesquisa de Mercado"}'),
  ('Henrique', 2021, 'Serviço', 'Saúde', (select id from portes_empresa where nome = 'Para abrir'), 'Finalizado', 10, null, '2021-07-19', '2021-09-17', 44, 8500.0, '{"Pesquisa de Mercado"}'),
  ('SAPESP', 2021, 'Serviço OSC', '- Organização Social Civil', (select id from portes_empresa where nome = 'Indefinido'), 'Finalizado', 10, 10, '2021-07-26', '2021-08-17', 17, 6500.0, '{"Pesquisa de Mercado"}'),
  ('Continental', 2021, 'Indústria', 'Automotivo', (select id from portes_empresa where nome = 'Grande Porte'), 'Finalizado', 10, 10, '2021-07-26', '2021-09-17', 39, 6030.0, '{"Pesquisa de Mercado"}'),
  ('CAS Tecnologia', 2021, 'Indústria', 'Tecnológico', (select id from portes_empresa where nome = 'Médio Porte'), 'Finalizado', 10, null, '2021-08-02', '2021-09-09', 28, 10500.0, '{"Mapeamento de Processos"}'),
  ('Biome4all', 2021, 'Serviço', 'Biotecnologia', (select id from portes_empresa where nome = 'Médio Porte'), 'Finalizado', 10, 9, '2021-08-02', '2021-10-04', 45, 7300.0, '{"Pesquisa de Mercado"}'),
  ('Dasa MDP 2.2', 2021, 'Serviço', 'Saúde', (select id from portes_empresa where nome = 'Grande Porte'), 'Finalizado', null, null, '2021-04-05', '2021-12-28', 186, 10500.0, '{"Treinamento"}'),
  ('Empresa Junior Meta', 2021, 'Serviço', 'EJ', (select id from portes_empresa where nome = 'Empresa Júnior'), 'Finalizado', 10, null, '2021-08-19', '2021-08-31', 9, 200.0, '{"Pesquisa de Mercado"}'),
  ('Aperam Tubos - 1', 2021, 'Indústria', 'Metalurgico', (select id from portes_empresa where nome = 'Grande Porte'), 'Finalizado', 10, null, '2021-09-08', '2021-10-27', 35, 7250.0, '{"Pesquisa de Mercado"}'),
  ('DNA Curioso', 2021, 'Serviço', 'Saúde', (select id from portes_empresa where nome = 'Médio Porte'), 'Finalizado', null, null, '2021-09-13', '2021-10-08', 20, 9000.0, '{"Plano de Marketing"}'),
  ('Dandelin', 2021, 'Serviço', 'Saúde', (select id from portes_empresa where nome = 'Médio Porte'), 'Finalizado', 10, 8, '2021-09-20', '2021-11-08', 34, 6500.0, '{"Pesquisa de Mercado"}'),
  ('Luis Fernando', 2021, 'Comércio', 'Alimenticio', (select id from portes_empresa where nome = 'Pequeno Porte'), 'Finalizado', 8, 8, '2021-09-20', '2021-11-05', 33, 6500.0, '{"Pesquisa de Mercado"}'),
  ('Colina dos Ipês', 2021, 'Serviço', 'Funerário', (select id from portes_empresa where nome = 'Médio Porte'), 'Finalizado', 9, 8, '2021-09-27', '2021-12-07', 49, 6800.0, '{"Pesquisa de Mercado"}'),
  ('Guemat', 2021, 'Serviço', 'Comércio', (select id from portes_empresa where nome = 'Médio Porte'), 'Finalizado', 10, 10, '2021-09-27', '2021-10-25', 20, 4500.0, '{"Pesquisa de Mercado"}'),
  ('Henrique - PN', 2021, 'Serviço', 'Saúde', (select id from portes_empresa where nome = 'Para abrir'), 'Finalizado', 10, null, '2021-10-25', '2021-12-24', 43, 7200.0, '{"Plano de Negócios"}'),
  ('SAPESP - PN', 2021, 'Serviço OSC', '- Organização Social Civil', (select id from portes_empresa where nome = 'Indefinido'), 'Finalizado', 10, 10, '2021-11-16', '2022-01-21', 49, 7650.0, '{"Plano de Negócios"}'),
  ('Marketing Jr. USP -', 2021, 'Serviço', 'EJ', (select id from portes_empresa where nome = 'Empresa Júnior'), 'Finalizado', 10, null, '2021-11-25', '2021-12-06', 8, 1800.0, '{"Análise Georreferenciada","Análise Georreferenciada"}'),
  ('Sandra', 2022, 'Serviço', 'Arquitetura', (select id from portes_empresa where nome = 'Pequeno Porte'), 'Finalizado', 10, 10, '2022-02-14', '2022-03-16', 22, 4950.0, '{"Estruturação Comercial"}'),
  ('Clinicorp', 2022, 'Serviço', 'Tecnológico', (select id from portes_empresa where nome = 'Médio Porte'), 'Finalizado', 10, 9, '2022-02-16', '2022-05-03', 52, 8250.0, '{"Pesquisa de Mercado"}'),
  ('Felipe Triciclo', 2022, 'Comércio', 'Varejo', (select id from portes_empresa where nome = 'Microempresa'), 'Finalizado', null, null, '2022-02-16', '2022-03-30', 30, 7650.0, '{"Pesquisa de Mercado"}'),
  ('Dasa 7 - MDP 2022.1', 2022, 'Serviço', 'Saúde', (select id from portes_empresa where nome = 'Grande Porte'), 'Finalizado', 10, 9, '2022-03-04', '2022-05-31', 61, 55800.0, '{"Treinamento"}'),
  ('CAS 2', 2022, 'Indústria', 'Tecnológico', (select id from portes_empresa where nome = 'Médio Porte'), 'Finalizado', null, null, '2022-03-09', '2022-05-20', 51, 12100.0, '{"Mapeamento de Processos"}'),
  ('Rafael', 2022, 'Serviço', 'Lazer', (select id from portes_empresa where nome = 'Pequeno Porte'), 'Finalizado', null, null, '2022-03-14', '2022-05-09', 39, 6800.0, '{"Plano de Negócios"}'),
  ('Kion', 2022, 'Serviço', 'Saúde', (select id from portes_empresa where nome = 'Médio Porte'), 'Finalizado', null, null, '2022-03-23', '2022-05-24', 43, 6900.0, '{"Estruturação Comercial","Pesquisa de Mercado"}'),
  ('IEPD', 2022, 'Serviço', 'Saúde', (select id from portes_empresa where nome = 'Grande Porte'), 'Finalizado', 10, null, '2022-03-25', '2022-05-17', 36, 6700.0, '{"Treinamento"}'),
  ('Fernanda', 2022, 'Serviço', 'Pet', (select id from portes_empresa where nome = 'Para abrir'), 'Finalizado', null, null, '2022-04-04', '2022-05-31', 40, 6500.0, '{"Plano de Negócios","Pesquisa de Mercado"}'),
  ('Marry', 2022, 'Serviço', 'Serviços Especializados', (select id from portes_empresa where nome = 'Médio Porte'), 'Finalizado', null, null, '2022-04-07', '2022-07-21', 73, 8500.0, '{"Plano de Negócios","Pesquisa de Mercado"}'),
  ('Produção Jr - Elaboração de Dashboard', 2022, 'Serviço', 'Consultoria', (select id from portes_empresa where nome = 'Empresa Júnior'), 'Finalizado', null, null, '2022-04-11', '2022-06-15', 46, 2900.0, '{"Análise de Dados"}'),
  ('ROOF', 2022, 'Comércio', 'Produtora', (select id from portes_empresa where nome = 'Pequeno Porte'), 'Finalizado', null, null, '2022-04-11', '2022-07-29', 77, 9500.0, '{"Plano de Negócios"}'),
  ('Eduardo', 2022, 'Serviço', 'Serviços Especializados', (select id from portes_empresa where nome = 'Indefinido'), 'Finalizado', null, null, '2022-04-13', '2022-08-05', 80, 8386.0, '{"Plano de Negócios"}'),
  ('Lucas Romero', 2022, 'Serviço', 'Saúde', (select id from portes_empresa where nome = 'Indefinido'), 'Finalizado', null, null, '2022-04-27', '2022-07-04', 48, 6520.0, '{"Plano de Negócios"}'),
  ('Mis Arquitetura', 2022, 'Serviço', 'Arquitetura', (select id from portes_empresa where nome = 'Microempresa'), 'Finalizado', null, null, '2022-05-02', '2022-07-11', 50, 5000.0, '{"Estruturação Comercial"}'),
  ('H2C Arquitetura', 2022, 'Serviço', 'Arquitetura', (select id from portes_empresa where nome = 'Microempresa'), 'Finalizado', null, null, '2022-05-09', '2022-07-04', 40, 4000.0, '{"Estruturação Comercial"}'),
  ('Dasa 7 - MDP 2022.2', 2022, 'Serviço', 'Saúde', (select id from portes_empresa where nome = 'Grande Porte'), 'Finalizado', null, null, '2022-06-06', '2022-08-23', 56, 13950.0, '{"Mapeamento de Processos"}'),
  ('MedLabo Work 2', 2022, 'Serviço', 'Saúde', (select id from portes_empresa where nome = 'Pequeno Porte'), 'Finalizado', null, null, '2022-05-09', '2022-07-08', 44, 6282.0, '{"Estruturação Comercial"}'),
  ('Herica', 2022, 'Serviço', 'Alimenticio', (select id from portes_empresa where nome = 'Microempresa'), 'Finalizado', null, null, '2022-05-09', '2022-06-24', 34, 999.0, '{"Plano de Negócios"}'),
  ('Empresa Jr UFBA - Aplicação de Pesquisa', 2022, 'Serviço', 'Consultoria', (select id from portes_empresa where nome = 'Empresa Júnior'), 'Finalizado', null, null, '2022-05-06', '2022-05-11', 4, 1400.0, '{"Pesquisa de Mercado"}'),
  ('Patrick', 2022, 'Serviço', 'Saúde', (select id from portes_empresa where nome = 'Para abrir'), 'Finalizado', 10, null, '2022-05-18', '2022-07-04', 33, 4429.0, '{"Plano de Negócios"}'),
  ('Samsung SDS', 2022, 'Comércio, Serviço', 'Tecnológico', (select id from portes_empresa where nome = 'Grande Porte'), 'Finalizado', 9, null, '2022-06-01', '2022-07-13', 30, 30000.0, '{"Pesquisa de Mercado"}'),
  ('Microblau', 2022, 'Serviço', 'Tecnológico', (select id from portes_empresa where nome = 'Médio Porte'), 'Finalizado', 10, null, '2022-06-01', '2022-08-05', 47, 9429.0, '{"Plano de Marketing"}'),
  ('Alfe', 2022, 'Serviço', 'Construção Civil', (select id from portes_empresa where nome = 'Médio Porte'), 'Finalizado', null, null, '2022-06-06', '2022-07-29', 39, 8660.0, '{"Pesquisa de Mercado"}'),
  ('Leaderline Pompei', 2022, 'Serviço', 'Marketing', (select id from portes_empresa where nome = 'Microempresa'), 'Finalizado', 10, null, '2022-06-13', '2022-07-29', 34, 7100.0, '{"Estruturação Comercial"}'),
  ('Digitampa', 2022, 'Serviço', 'Tecnológico', (select id from portes_empresa where nome = 'Pequeno Porte'), 'Finalizado', 10, null, '2022-06-15', '2022-08-04', 36, 17350.0, '{"Pesquisa de Mercado"}'),
  ('Gabrielle', 2022, 'Comércio', 'Esportes', (select id from portes_empresa where nome = 'Microempresa'), 'Finalizado', 10, null, '2022-06-24', '2022-08-18', 40, 11200.0, '{"Plano de Negócios"}'),
  ('Rafael e Anderson', 2022, 'Serviço', 'Construção Civil', (select id from portes_empresa where nome = 'Microempresa'), 'Finalizado', null, null, '2022-07-06', '2022-08-16', 30, 5940.0, '{"Plano de Negócios"}'),
  ('Nutri Jr', 2022, 'Serviço', 'EJ', (select id from portes_empresa where nome = 'Empresa Júnior'), 'Finalizado', 10, null, '2022-07-20', '2022-08-16', 20, 6461.0, '{"Estruturação Comercial"}'),
  ('Ana Maria', 2022, 'Comércio', 'Cosméticos', (select id from portes_empresa where nome = 'Microempresa'), 'Finalizado', 10, null, '2022-08-25', '2022-10-14', 35, 8540.0, '{"Pesquisa de Mercado"}'),
  ('Antônio', 2022, 'Serviço', 'Serviços Especializados', (select id from portes_empresa where nome = 'Pequeno Porte'), 'Finalizado', null, null, '2022-08-09', '2022-09-21', 31, 8117.5, '{"Plano de Negócios"}'),
  ('Ecotx', 2022, 'Comércio', 'Tecnológico', (select id from portes_empresa where nome = 'Pequeno Porte'), 'Finalizado', null, null, '2022-08-29', '2022-12-08', 70, 5200.0, '{"Estruturação Comercial"}'),
  ('Lots group', 2022, 'Serviço', 'Transporte', (select id from portes_empresa where nome = 'Indefinido'), 'Finalizado', null, null, '2022-08-08', '2023-01-20', 116, 14000.0, '{"Estruturação Comercial"}'),
  ('Omar e Eliete', 2022, 'Serviço', 'Arte', (select id from portes_empresa where nome = 'Microempresa'), 'Finalizado', null, null, '2022-09-02', '2022-10-31', 40, 6673.0, '{"Pesquisa de Mercado"}'),
  ('Paytec', 2022, 'Serviço', 'Financeiro', (select id from portes_empresa where nome = 'Pequeno Porte'), 'Finalizado', null, null, '2022-10-24', '2023-01-13', 58, 15700.0, '{"Mapeamento de Processos"}'),
  ('Yunity', 2022, 'Serviço', 'Arquitetura', (select id from portes_empresa where nome = 'Pequeno Porte'), 'Finalizado', null, null, '2022-09-07', '2022-09-28', 15, 3000.0, '{"Pesquisa de Mercado"}'),
  ('Agiliza', 2022, 'Serviço', 'Varejo', (select id from portes_empresa where nome = 'Médio Porte'), 'Finalizado', null, null, '2022-09-28', '2022-12-05', 46, 29790.0, '{"Pesquisa de Mercado"}'),
  ('CAS', 2022, 'Indústria', 'Tecnológico', (select id from portes_empresa where nome = 'Médio Porte'), 'Finalizado', 10, null, '2022-12-22', '2023-12-29', 257, 53000.0, '{"Estruturação Comercial"}'),
  ('DASA', 2022, 'Serviço', 'Saúde', (select id from portes_empresa where nome = 'Grande Porte'), 'Finalizado', null, null, '2022-12-21', '2023-03-20', 63, 23870.0, '{"Mapeamento de Processos"}'),
  ('Adventista', 2022, 'Indústria', 'Tecnológico', (select id from portes_empresa where nome = 'Médio Porte'), 'Finalizado', 10, null, '2022-12-20', '2023-03-13', 59, 20250.0, '{"Pesquisa de Mercado"}'),
  ('Marketing Jr. USP 2', 2022, 'Serviço', 'Marketing', (select id from portes_empresa where nome = 'Empresa Júnior'), 'Finalizado', 10, null, '2022-09-15', '2023-03-13', 124, 500.0, '{"Pesquisa de Mercado"}'),
  ('Aperam', 2022, 'Indústria', 'Metalurgico', (select id from portes_empresa where nome = 'Grande Porte'), 'Finalizado', null, null, '2022-09-15', '2022-12-14', 62, 8322.0, '{"Plano de Negócios"}'),
  ('SecureTrace', 2022, 'Serviço', 'Segurança', (select id from portes_empresa where nome = 'Pequeno Porte'), 'Finalizado', 10, null, '2022-08-15', '2023-02-01', 119, 6000.0, '{"Pesquisa de Mercado"}'),
  ('SecureTrace 2', 2022, 'Serviço', 'Segurança', (select id from portes_empresa where nome = 'Pequeno Porte'), 'Finalizado', 10, null, '2022-06-10', '2022-08-04', 39, 17350.0, '{"Pesquisa de Mercado"}'),
  ('SecureTrace 3', 2022, 'Serviço', 'Segurança', (select id from portes_empresa where nome = 'Pequeno Porte'), 'Finalizado', 10, null, '2022-08-01', '2022-09-29', 43, 8670.0, '{"Pesquisa de Mercado"}'),
  ('Adventista Campinas', 2023, 'Serviço', 'Religioso', (select id from portes_empresa where nome = 'Indefinido'), 'Finalizado', null, null, '2023-12-01', '2024-12-31', null, null, '{"Pesquisa de Mercado"}'),
  ('Adventista Engenheiro Coelho', 2023, 'Serviço', 'Religioso', (select id from portes_empresa where nome = 'Indefinido'), 'Finalizado', 10, null, '2023-04-13', '2023-06-22', 48, 17212.5, '{"Pesquisa de Mercado"}'),
  ('Baco Floripa', 2023, 'Comércio', 'Vestuário', (select id from portes_empresa where nome = 'Pequeno Porte'), 'Finalizado', 9, null, '2023-11-30', '2024-01-25', 39, 1687.0, '{"Pesquisa de Mercado"}'),
  ('Biotera', 2023, 'Serviço', 'Ambiental', (select id from portes_empresa where nome = 'Microempresa'), 'Finalizado', 10, 10, '2023-01-16', '2023-04-03', 55, 10000.0, '{"Estruturação Comercial","Pesquisa de Mercado"}'),
  ('CAS', 2023, 'Serviço', 'Tecnológico', (select id from portes_empresa where nome = 'Grande Porte'), 'Finalizado', null, null, '2023-03-02', '2023-12-31', null, null, '{"Mapeamento de Processos"}'),
  ('CAS - Treinamento de Vendas', 2023, 'Serviço', 'Tecnológico', (select id from portes_empresa where nome = 'Grande Porte'), 'Finalizado', null, null, '2023-07-31', '2023-10-31', 65, 27390.0, '{"Treinamento"}'),
  ('DASA - Treinamentos', 2023, 'Serviço', 'Saúde', (select id from portes_empresa where nome = 'Grande Porte'), 'Finalizado', 10, null, '2023-03-07', '2023-07-03', 81, 43000.0, '{"Treinamento"}'),
  ('Douglas', 2023, 'Serviço', 'Turismo', (select id from portes_empresa where nome = 'Para abrir'), 'Finalizado', 9, 8, '2023-11-24', '2024-03-13', 76, 6900.0, '{"Plano de Negócios"}'),
  ('Edge of Space', 2023, 'Serviço', 'Construção Civil', (select id from portes_empresa where nome = 'Pequeno Porte'), 'Cancelado', 9, null, '2023-11-09', '2024-01-15', 45, 9100.0, '{"Plano de Negócios"}'),
  ('Elletech', 2023, 'Serviço', 'Tecnológico', (select id from portes_empresa where nome = 'Pequeno Porte'), 'Cancelado', 7, 5, '2023-12-22', '2023-03-24', null, 7890.0, '{"Pesquisa de Mercado"}'),
  ('Extimbrasil', 2023, 'Serviço', 'de Cultura Segurança', (select id from portes_empresa where nome = 'Pequeno Porte'), 'Finalizado', 10, 8, '2023-09-19', '2024-02-16', 103, 7500.0, '{"Mapeamento de Processos","Pesquisa de Mercado","Estruturação Comercial","Mapeamento de Cultura"}'),
  ('Felipe (lavanderia) - Analíse Geo', 2023, 'Serviço', 'Limpeza', (select id from portes_empresa where nome = 'Para abrir'), 'Finalizado', 10, null, '2023-08-23', '2023-09-13', 15, 6800.0, '{"Pesquisa de Mercado"}'),
  ('Filipe', 2023, 'Serviço', 'Alimenticio', (select id from portes_empresa where nome = 'Microempresa'), 'Finalizado', 10, null, '2023-07-17', '2023-09-04', 36, 8000.0, '{"Plano de Negócios"}'),
  ('IGOR', 2023, 'Serviço', 'Saúde', null, 'Finalizado', null, null, '2023-05-31', '2023-07-13', 31, 6000.0, '{"Pesquisa de Mercado"}'),
  ('IguanaFix', 2023, 'Serviço', 'Serviços Especializados', (select id from portes_empresa where nome = 'Médio Porte'), 'Finalizado', 10, null, '2023-10-03', '2023-11-14', 29, 5000.0, '{"Pesquisa de Mercado"}'),
  ('Lillian', 2023, 'Comércio', 'Varejo', (select id from portes_empresa where nome = 'Microempresa'), 'Finalizado', null, null, '2023-11-12', '2024-12-17', 279, 7964.6, '{"Pesquisa de Mercado"}'),
  ('Lillian', 2023, 'Serviço', 'Arquitetura', (select id from portes_empresa where nome = 'Microempresa'), 'Finalizado', 10, null, '2023-02-24', '2023-04-14', 35, 9000.0, '{"Mapeamento de Processos"}'),
  ('MIS Arquitetura', 2023, 'Serviço', 'Arquitetura', (select id from portes_empresa where nome = 'Microempresa'), 'Finalizado', null, null, '2023-02-01', '2023-02-23', 16, 2820.0, '{"Benchmarking"}'),
  ('Multialloy', 2023, 'Serviço', 'Metalurgico', (select id from portes_empresa where nome = 'Médio Porte'), 'Finalizado', 9, null, '2023-11-14', '2024-01-29', 52, 6000.0, '{"Pesquisa de Mercado"}'),
  ('Nara', 2023, 'Comércio', 'Vestuário', (select id from portes_empresa where nome = 'Microempresa'), 'Finalizado', 10, null, '2023-05-31', '2023-09-01', 67, 15000.0, '{"Pesquisa de Mercado"}'),
  ('Nara', 2023, 'Comércio', 'Vestuário', (select id from portes_empresa where nome = 'Microempresa'), 'Finalizado', 7, null, '2023-05-31', '2023-09-01', 67, 12000.0, '{"Plano de Negócios"}'),
  ('NMS - Otimização Comercial', 2023, 'Serviço', 'Consultoria', (select id from portes_empresa where nome = 'Microempresa'), 'Finalizado', 9, null, '2023-05-19', '2023-08-28', 71, 4452.0, '{"Estruturação Comercial"}'),
  ('Omar', 2023, 'Serviço', 'Pet', (select id from portes_empresa where nome = 'Indefinido'), 'Finalizado', 10, null, '2023-07-10', '2023-09-11', 45, 12000.0, '{"Pesquisa de Mercado"}'),
  ('Paytech 2', 2023, 'Serviço', 'Tecnológico', (select id from portes_empresa where nome = 'Indefinido'), 'Finalizado', 10, null, '2023-02-01', '2023-03-30', 41, 13825.0, '{"Pesquisa de Mercado"}'),
  ('Petiscos & Companhia', 2023, 'Comércio', 'Alimenticio', (select id from portes_empresa where nome = 'Para abrir'), 'Finalizado', null, null, '2023-02-08', '2023-03-29', 35, 13825.0, '{"Pesquisa de Mercado"}'),
  ('Rinaldo', 2023, 'Serviço', 'Saúde', (select id from portes_empresa where nome = 'Microempresa'), 'Finalizado', 10, null, '2023-03-21', '2023-06-01', 50, 12285.0, '{"Pesquisa de Mercado"}'),
  ('SAPESP 1 - Estruturação de parcerias', 2023, 'Serviço', 'Esportes', (select id from portes_empresa where nome = 'Grande Porte'), 'Finalizado', 10, null, '2023-02-27', '2023-04-17', 35, 21640.49, '{"Plano de Negócios"}'),
  ('SAPESP 2', 2023, 'Serviço', 'Esportes', (select id from portes_empresa where nome = 'Grande Porte'), 'Finalizado', 10, null, '2023-03-21', '2023-06-09', 55, 12285.0, '{"Pesquisa de Mercado"}'),
  ('Thais', 2023, 'Serviço', 'Alimenticio', (select id from portes_empresa where nome = 'Microempresa'), 'Finalizado', 7, null, '2023-10-16', '2024-01-29', 72, 3800.0, '{"Pesquisa de Mercado"}'),
  ('Terranobillis', 2023, 'Serviço', 'Agropecuária', (select id from portes_empresa where nome = 'Médio Porte'), 'Finalizado', null, null, '2023-01-31', '2023-06-27', 101, 13568.0, '{"Pesquisa de Mercado","Análise de Dados"}'),
  ('CAS 3', 2024, null, 'de Serviço Negócios Tecnológico', (select id from portes_empresa where nome = 'Médio Porte'), 'Finalizado', null, null, '2024-01-08', '2024-12-20', null, null, '{"Estruturação Comercial","Plano de Marketing","Mapeamento de Processos","Plano de Negócios"}'),
  ('Diego e Gabriel', 2024, 'Serviço', 'Automotivo', (select id from portes_empresa where nome = 'Para abrir'), 'Finalizado', 10, null, '2024-01-30', '2024-02-10', 9, 8800.0, '{"Pesquisa de Mercado","Análise Georreferenciada"}'),
  ('Doris I', 2024, 'Serviço', 'Tecnológico', (select id from portes_empresa where nome = 'Grande Porte'), 'Finalizado', 9, 9, '2024-10-08', '2024-11-19', 30, 8100.0, '{"Pesquisa de Mercado"}'),
  ('EdanTex', 2024, 'Comércio', 'Distribuidora', (select id from portes_empresa where nome = 'Médio Porte'), 'Finalizado', 8, 8, '2024-01-22', '2024-03-11', 35, 16579.56, '{"Mapeamento de Processos"}'),
  ('Fast Copy -', 2024, 'Serviço', 'Tecnológico', (select id from portes_empresa where nome = 'Microempresa'), 'Finalizado', 10, 10, '2024-01-15', '2024-03-19', 46, 4900.0, '{"Benchmarking","Pesquisa de Mercado","Benchmarking"}'),
  ('Gisseli', 2024, 'Serviço', 'Esportes', (select id from portes_empresa where nome = 'Indefinido'), 'Finalizado', 10, 10, '2024-03-04', '2024-05-16', 52, 15239.03, '{"Pesquisa de Mercado","Análise Georreferenciada","Benchmarking"}'),
  ('INTEC', 2024, 'Serviço', 'Construção Civil', (select id from portes_empresa where nome = 'Médio Porte'), 'Finalizado', 7, 7, '2024-02-21', '2024-03-26', 25, 7900.0, '{"Pesquisa de Mercado","Benchmarking"}'),
  ('Lady Tecelagem', 2024, 'Indústria', 'Vestuário', (select id from portes_empresa where nome = 'Médio Porte'), 'Finalizado', 10, 10, '2024-04-01', '2024-09-13', 118, 27159.36, '{"Mapeamento de Processos"}'),
  ('Lilian Fugita - Estruturação de Processos', 2024, 'Serviço', 'Arquitetura', (select id from portes_empresa where nome = 'Microempresa'), 'Finalizado', 10, null, '2024-04-02', '2024-06-06', 46, 10000.0, '{"Mapeamento de Processos"}'),
  ('OBL4', 2024, 'Serviço', 'Tecnológico', (select id from portes_empresa where nome = 'Microempresa'), 'Finalizado', null, null, '2024-02-22', '2024-04-26', 46, null, '{"Estruturação Comercial","Pesquisa de Mercado","Plano de Negócios"}'),
  ('Precificar', 2024, 'Indústria', 'Comércio', (select id from portes_empresa where nome = 'Microempresa'), 'Finalizado', 10, 10, '2024-04-29', '2024-08-05', 69, 7438.66, '{"Mapeamento de Processos"}'),
  ('Primecom Tecnologia', 2024, 'Comércio', 'Tecnológico', (select id from portes_empresa where nome = 'Microempresa'), 'Finalizado', 10, 10, '2024-03-25', '2024-05-17', 38, 8345.53, '{"Mapeamento de Processos"}'),
  ('Sistemas GAP', 2024, 'Serviço', 'Tecnológico', (select id from portes_empresa where nome = 'Microempresa'), 'Finalizado', null, null, '2024-02-26', '2024-04-05', 29, 0.0, '{"Pesquisa de Mercado","Análise Georreferenciada","Benchmarking"}'),
  ('Toli', 2024, 'Comércio', 'Distribuidora', (select id from portes_empresa where nome = 'Grande Porte'), 'Finalizado', 10, 9, '2024-04-15', '2024-05-23', 28, 6000.0, '{"Pesquisa de Mercado","Benchmarking","Análise Georreferenciada"}'),
  ('.+SG Soluções', 2025, 'Serviço', 'Comércio', (select id from portes_empresa where nome = 'Microempresa'), 'Finalizado', 9, null, '2025-05-16', '2025-06-20', 25, 6900.0, '{"Pesquisa de Mercado"}'),
  ('Cinc', 2025, 'Serviço', 'Tecnológico', (select id from portes_empresa where nome = 'Indefinido'), 'Finalizado', 9, null, '2024-04-11', '2025-09-15', 363, 0.0, '{"Gestão e Logística"}'),
  ('Clínica Lunes', 2025, 'Serviço', 'Esportes', (select id from portes_empresa where nome = 'Microempresa'), 'Finalizado', null, null, '2025-06-30', null, 0, null, '{"Mapeamento de Processos"}'),
  ('Congresso', 2025, 'Serviço', 'Educação', (select id from portes_empresa where nome = 'Indefinido'), 'Finalizado', null, null, '2025-06-07', '2025-09-18', 73, 0.0, '{"Gestão Financeira"}'),
  ('Doris II', 2025, 'Serviço', 'Tecnológico', (select id from portes_empresa where nome = 'Grande Porte'), 'Cancelado', null, null, null, null, 0, 0.0, '{"Pesquisa de Mercado"}'),
  ('Forvis Mazars', 2025, 'Serviço', 'Consultoria', (select id from portes_empresa where nome = 'Grande Porte'), 'Cancelado', null, null, null, null, 0, 0.0, '{"Estruturação Comercial"}'),
  ('Nelis Pilates', 2025, 'Serviço', 'Esportes', (select id from portes_empresa where nome = 'Microempresa'), 'Finalizado', null, null, '2025-03-13', '2025-11-18', 175, 4263.49, '{"Pesquisa de Mercado"}'),
  ('Renova Energia', 2025, 'Serviço', 'Energia', (select id from portes_empresa where nome = 'Grande Porte'), 'Finalizado', 10, 10, '2025-04-10', '2025-05-16', 24, 11037.21, '{"Análise de Dados"}'),
  ('Shopper', 2025, 'Comércio', 'Comércio', (select id from portes_empresa where nome = 'Grande Porte'), 'Paralisado', null, null, '2025-04-07', null, null, 17461.23, '{"Mapeamento de Processos"}');

-- vinculo historico <-> catalogo, resolvido pelo nome
insert into historico_precificacao_servicos (historico_id, produto_servico_id)
select h.id, ps.id
  from historico_precificacao h
  cross join lateral unnest(h.servicos_originais) as s(nome)
  join produtos_servicos ps on ps.nome = case s.nome
    when 'Pesquisa de Mercado' then 'Pesquisa de Mercado — Secundária'
    else s.nome end
on conflict do nothing;

-- ----------------------------------------------------------------------------
-- vw_ticket_medio_servico — quanto cada serviço costuma custar
-- ----------------------------------------------------------------------------
-- Conta só projetos de um serviço só: num projeto que empacotou três serviços
-- por um preço, não há como saber quanto coube a cada um, e ratear em partes
-- iguais inventaria uma precisão que o dado não tem. O custo é amostra menor —
-- por isso `amostra` sai na view, para a tela poder dizer de quantos projetos
-- está falando em vez de fingir confiança.
--
-- Ressalva de leitura: "Pesquisa de Mercado — Secundária" herda o histórico da
-- entrada genérica "Pesquisa de Mercado", que existia antes de a calculadora
-- separar primária de secundária. A média dela mistura os dois casos.
create view vw_ticket_medio_servico as
with de_um_servico as (
  select h.id, h.preco, s.produto_servico_id
    from historico_precificacao h
    join historico_precificacao_servicos s on s.historico_id = h.id
   where h.preco is not null
     and h.preco > 0
     and (select count(*) from historico_precificacao_servicos s2
           where s2.historico_id = h.id) = 1
)
select
  ps.id                                        as produto_servico_id,
  ps.nome                                      as servico,
  count(u.id)                                  as amostra,
  round(avg(u.preco), 2)                       as ticket_medio,
  round(percentile_cont(0.5) within group (order by u.preco)::numeric, 2) as mediana,
  round(min(u.preco), 2)                       as menor,
  round(max(u.preco), 2)                       as maior
from produtos_servicos ps
left join de_um_servico u on u.produto_servico_id = ps.id
group by ps.id, ps.nome;

alter view vw_ticket_medio_servico set (security_invoker = true);

-- ----------------------------------------------------------------------------
-- RLS — mesmo padrão das tabelas do CRM (leitura para o domínio, escrita só
-- pela chave de service role da aplicação)
-- ----------------------------------------------------------------------------
alter table portes_empresa enable row level security;
alter table historico_precificacao enable row level security;
alter table historico_precificacao_servicos enable row level security;

create policy "membros_leem_portes" on portes_empresa for select using (is_membro_ufabcjr());
create policy "membros_leem_historico" on historico_precificacao for select using (is_membro_ufabcjr());
create policy "membros_leem_historico_servicos" on historico_precificacao_servicos for select using (is_membro_ufabcjr());
