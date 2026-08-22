-- ============================================================================
-- CRM sobre a Lead Hunter — migração 003
-- ============================================================================
-- Implementa a especificação em leadhunter-crm-especificacao-tecnica.md, com
-- os ajustes exigidos pelo schema real (auditado antes de escrever este
-- arquivo, não assumido):
--
--   1. `member_profiles` é chaveado por `email` (text), não tem coluna `id`.
--      Toda FK que a especificação desenhava para `member_profiles(id)`
--      virou `*_email text references member_profiles(email)`.
--   2. `member_profiles.papel` já existe (check 'membro'/'admin') — a
--      migração 4.1 da especificação (adicionar `role`) foi descartada, seria
--      uma coluna duplicada.
--   3. `leads.cnpj` não tem constraint de unicidade, mas está de fato único
--      em produção (1.674.987 linhas, 1.674.987 CNPJs distintos, 0 nulos,
--      auditado antes desta migração). Mesmo assim, `organizacoes.lead_origem_cnpj`
--      **não** vira foreign key: criar um índice único num campo de 1,6M
--      linhas que W1/W2/W3 escrevem o tempo todo é risco desnecessário para
--      um benefício pequeno. Fica como referência indexada, não uma FK
--      estrita — exatamente a saída que a própria especificação previa
--      (Seção 4.2) para este caso.
--   4. A tabela de reserva de 24h do W1 é `lead_reservas` (já tinha RLS
--      habilitada) — resolve o bloqueador 3 do documento de referência.
--
-- Este arquivo cobre as Seções 4, 6 e 7 da especificação. As funções
-- transacionais (Seção 8) ficam em 004_crm_funcoes.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 4.2 organizacoes
-- ----------------------------------------------------------------------------
create table organizacoes (
  id uuid primary key default gen_random_uuid(),
  -- Nullable: organização capturada via LinkedIn (W4) não tem CNPJ, só nome.
  -- Unicidade só entre quem tem CNPJ preenchido (índice parcial abaixo).
  cnpj text,
  -- Referência informativa ao lead de origem, não FK: ver nota (3) acima.
  lead_origem_cnpj text,
  razao_social text not null,
  nome_fantasia text,
  setor text,
  cidade text,
  estado text,
  telefone text,
  site text,
  criado_por_email text not null references member_profiles(email),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create unique index idx_organizacoes_cnpj_unico on organizacoes(cnpj) where cnpj is not null;
create index idx_organizacoes_lead_origem on organizacoes(lead_origem_cnpj) where lead_origem_cnpj is not null;

comment on table organizacoes is 'Camada de CRM sobre leads: só existe para quem um membro decidiu trabalhar (promoção manual ou negócio avulso). Nunca escrita por W1/W2/W3.';
comment on column organizacoes.lead_origem_cnpj is 'Referência informativa ao CNPJ de origem em leads. Não é FK: leads.cnpj não tem constraint de unicidade (ver nota no topo do arquivo).';

-- ----------------------------------------------------------------------------
-- 4.3 contatos
-- ----------------------------------------------------------------------------
create table contatos (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references organizacoes(id) on delete cascade,
  nome text not null,
  cargo text,
  email text,
  telefone text,
  linkedin_url text,
  principal boolean not null default false,
  criado_por_email text not null references member_profiles(email),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index idx_contatos_organizacao on contatos(organizacao_id);
-- Dedupe do novo destino do W4: um mesmo perfil de LinkedIn não cria dois contatos.
create unique index idx_contatos_linkedin_url on contatos(linkedin_url) where linkedin_url is not null;

-- ----------------------------------------------------------------------------
-- 4.4 etapas_funil — pipeline único, etapas configuráveis pelo Admin
-- ----------------------------------------------------------------------------
create table etapas_funil (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ordem int not null,
  cor text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create unique index idx_etapas_funil_ordem on etapas_funil(ordem) where ativo;

insert into etapas_funil (nome, ordem, cor) values
  ('Novo negócio', 1, 'neutro'),
  ('Contactado', 2, 'amarelo'),
  ('Qualificado', 3, 'amarelo'),
  ('Reunião', 4, 'verde'),
  ('Negociação iniciada', 5, 'verde'),
  ('Contrato', 6, 'verde');

-- ----------------------------------------------------------------------------
-- 4.5 produtos_servicos — as 4 linhas de serviço já usadas pelo prompt do W3
-- ----------------------------------------------------------------------------
create table produtos_servicos (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  descricao text,
  ordem int,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

insert into produtos_servicos (nome, descricao, ordem) values
  ('Mapeamento de processos', 'Revela pontos cegos, elimina gargalos e redesenha fluxos de trabalho.', 1),
  ('Pesquisa de mercado', 'Cruza bancos de dados setoriais, análise de concorrência e comportamento do consumidor.', 2),
  ('Estruturação comercial', 'Refina o funil de vendas, implementa KPIs estratégicos, alinha o pipeline.', 3),
  ('Dados e automação', 'Padronização e integração de bases, modelos preditivos, automação de relatórios.', 4);

-- ----------------------------------------------------------------------------
-- 4.6 motivos_perda
-- ----------------------------------------------------------------------------
create table motivos_perda (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  ordem int,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

insert into motivos_perda (nome, ordem) values
  ('Sem orçamento', 1),
  ('Escolheu concorrente', 2),
  ('Sem resposta', 3),
  ('Fora do perfil de cliente', 4),
  ('Timing ruim', 5),
  ('Outro', 6);

-- ----------------------------------------------------------------------------
-- 4.7 negocios
-- ----------------------------------------------------------------------------
create table negocios (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references organizacoes(id),
  contato_id uuid references contatos(id),
  titulo text not null,
  etapa_id uuid not null references etapas_funil(id),
  dono_email text not null references member_profiles(email),
  valor numeric(12,2),
  moeda text not null default 'BRL',
  produto_servico_id uuid references produtos_servicos(id),
  previsao_fechamento date,
  status text not null default 'aberto'
    check (status in ('aberto', 'ganho', 'perdido')),
  motivo_perda_id uuid references motivos_perda(id),
  fechado_em timestamptz,
  origem text not null check (origem in ('promocao_lead', 'avulso')),
  -- Referência informativa, mesma lógica de organizacoes.lead_origem_cnpj.
  lead_origem_cnpj text,
  criado_por_email text not null references member_profiles(email),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint chk_motivo_perda_apenas_se_perdido
    check (status = 'perdido' or motivo_perda_id is null),
  constraint chk_lead_origem_se_promocao
    check (origem = 'avulso' or lead_origem_cnpj is not null)
);

create index idx_negocios_etapa on negocios(etapa_id);
create index idx_negocios_organizacao on negocios(organizacao_id);
create index idx_negocios_dono on negocios(dono_email);
create index idx_negocios_status on negocios(status);

comment on column negocios.dono_email is 'Reatribuir o dono de um negócio é ação restrita a admin — aplicado na API (PATCH /api/crm/negocios/[id]), não no banco: o app fala com o Postgres sempre pela chave de service role, que não carrega identidade de usuário para uma policy/trigger checar.';

-- ----------------------------------------------------------------------------
-- 4.8 negocio_etapa_historico — base dos relatórios de funil (Seção 7)
-- ----------------------------------------------------------------------------
create table negocio_etapa_historico (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references negocios(id) on delete cascade,
  etapa_id uuid not null references etapas_funil(id),
  entrou_em timestamptz not null default now(),
  saiu_em timestamptz,
  alterado_por_email text not null references member_profiles(email)
);

create index idx_historico_negocio on negocio_etapa_historico(negocio_id);
-- Toda consulta de "etapa atual em aberto" filtra por saiu_em is null; garante
-- no máximo um registro aberto por negócio mesmo sob concorrência.
create unique index idx_historico_aberto_unico on negocio_etapa_historico(negocio_id) where saiu_em is null;

-- ----------------------------------------------------------------------------
-- 4.9 tipos_atividade
-- ----------------------------------------------------------------------------
create table tipos_atividade (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  icone text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

insert into tipos_atividade (nome, icone) values
  ('Chamada', 'phone'),
  ('Reunião', 'users'),
  ('Tarefa', 'check-square'),
  ('Prazo', 'flag'),
  ('E-mail', 'mail'),
  ('Almoço', 'coffee');

-- ----------------------------------------------------------------------------
-- 4.10 atividades
-- ----------------------------------------------------------------------------
create table atividades (
  id uuid primary key default gen_random_uuid(),
  tipo_id uuid not null references tipos_atividade(id),
  negocio_id uuid references negocios(id),
  contato_id uuid references contatos(id),
  organizacao_id uuid references organizacoes(id),
  titulo text not null,
  descricao text,
  data_prazo timestamptz,
  concluida boolean not null default false,
  concluida_em timestamptz,
  responsavel_email text not null references member_profiles(email),
  criado_por_email text not null references member_profiles(email),
  criado_em timestamptz not null default now(),
  constraint chk_atividade_tem_vinculo
    check (negocio_id is not null or contato_id is not null or organizacao_id is not null)
);

create index idx_atividades_responsavel on atividades(responsavel_email);
create index idx_atividades_negocio on atividades(negocio_id);
create index idx_atividades_data_prazo on atividades(data_prazo) where not concluida;

-- ----------------------------------------------------------------------------
-- 4.11 Campos dinâmicos — EAV tipado (trade-off documentado na Seção 9.1)
-- ----------------------------------------------------------------------------
create table campos_dinamicos_definicao (
  id uuid primary key default gen_random_uuid(),
  entidade text not null
    check (entidade in ('negocio', 'organizacao', 'contato', 'atividade')),
  chave text not null,
  rotulo text not null,
  tipo text not null
    check (tipo in ('texto_curto', 'numero', 'data', 'booleano', 'selecao_multipla')),
  opcoes jsonb,
  obrigatorio boolean not null default false,
  ordem int,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  unique (entidade, chave)
);

create table campos_dinamicos_valor (
  id uuid primary key default gen_random_uuid(),
  definicao_id uuid not null references campos_dinamicos_definicao(id) on delete cascade,
  entidade_id uuid not null,
  valor_texto text,
  valor_numero numeric,
  valor_data date,
  valor_booleano boolean,
  valor_selecao_multipla jsonb,
  atualizado_em timestamptz not null default now(),
  unique (definicao_id, entidade_id)
);

create index idx_campos_valor_entidade on campos_dinamicos_valor(entidade_id);

comment on column campos_dinamicos_valor.entidade_id is 'Referência polimórfica ao id de negocios/organizacoes/contatos/atividades conforme campos_dinamicos_definicao.entidade — sem FK de banco possível, integridade garantida na API.';

-- ----------------------------------------------------------------------------
-- 4.12 canais_membro
-- ----------------------------------------------------------------------------
create table canais_membro (
  id uuid primary key default gen_random_uuid(),
  membro_email text not null references member_profiles(email),
  canal text not null check (canal in ('email', 'whatsapp', 'linkedin')),
  identificador text,
  credenciais_ref text,
  status text not null default 'desconectado'
    check (status in ('conectado', 'desconectado', 'erro')),
  conectado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (membro_email, canal)
);

comment on column canais_membro.credenciais_ref is 'Referência opaca (ex.: id de credencial no cofre do n8n). Segredo bruto nunca entra aqui em texto plano.';

-- ----------------------------------------------------------------------------
-- 4.13 whatsapp_enviados — schema pronto, envio bloqueado (Seção 12, item 1)
-- ----------------------------------------------------------------------------
create table whatsapp_enviados (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid references negocios(id),
  contato_id uuid references contatos(id),
  membro_email text not null references member_profiles(email),
  numero_destino text not null,
  mensagem text not null,
  status text not null check (status in ('enviado', 'erro')),
  provedor text,
  enviado_em timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 4.14 notificacoes
-- ----------------------------------------------------------------------------
create table notificacoes (
  id uuid primary key default gen_random_uuid(),
  membro_email text not null references member_profiles(email),
  tipo text not null,
  referencia_tipo text,
  referencia_id uuid,
  titulo text not null,
  lida boolean not null default false,
  criado_em timestamptz not null default now()
);

create index idx_notificacoes_membro_nao_lida on notificacoes(membro_email) where not lida;

-- ============================================================================
-- Seção 6 — RLS
-- ============================================================================
-- Toda leitura e escrita real da plataforma passa pela chave de service role
-- (lib/supabase/admin.ts), que ignora RLS — auditado antes desta migração:
-- o cliente ligado à sessão do usuário (lib/supabase/servidor.ts, chave anon)
-- só é usado para auth.getUser()/signOut(), nunca para ler tabela de dado.
-- RLS aqui é defesa em profundidade contra a chave anon (pública, repositório
-- público) sendo usada fora da aplicação — não é o mecanismo de autorização
-- principal, que continua sendo o código das rotas Next.js.
--
-- Por isso a policy de leitura verifica o domínio institucional diretamente
-- (auth.jwt()->>'email'), e não só "está autenticado": o provedor Google do
-- Supabase Auth aceita qualquer conta Google, o filtro de domínio hoje só
-- existe em lib/sessao.ts (camada de aplicação) — sem isso na policy, uma
-- conta Google qualquer com a chave anon leria tudo.

create or replace function is_membro_ufabcjr()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((auth.jwt() ->> 'email') ilike '%@ufabcjr.com.br', false);
$$;

create or replace function is_admin_ufabcjr()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from member_profiles
    where member_profiles.email = (auth.jwt() ->> 'email')
      and member_profiles.papel = 'admin'
  );
$$;

-- --- 4 tabelas legadas hoje sem RLS ---
alter table leads enable row level security;
alter table activity_log enable row level security;
alter table member_profiles enable row level security;
alter table configuracoes enable row level security;

create policy "membros_leem_leads" on leads for select using (is_membro_ufabcjr());
create policy "membros_leem_activity_log" on activity_log for select using (is_membro_ufabcjr());
create policy "membros_leem_member_profiles" on member_profiles for select using (is_membro_ufabcjr());
create policy "membros_leem_configuracoes" on configuracoes for select using (is_membro_ufabcjr());
-- Sem policy de INSERT/UPDATE/DELETE nestas 4: continuam graváveis só via
-- service role (é assim que a aplicação já opera hoje).

-- --- tabelas novas: leitura para qualquer membro do domínio ---
alter table organizacoes enable row level security;
alter table contatos enable row level security;
alter table etapas_funil enable row level security;
alter table produtos_servicos enable row level security;
alter table motivos_perda enable row level security;
alter table negocios enable row level security;
alter table negocio_etapa_historico enable row level security;
alter table tipos_atividade enable row level security;
alter table atividades enable row level security;
alter table campos_dinamicos_definicao enable row level security;
alter table campos_dinamicos_valor enable row level security;
alter table canais_membro enable row level security;
alter table whatsapp_enviados enable row level security;
alter table notificacoes enable row level security;

create policy "membros_leem_organizacoes" on organizacoes for select using (is_membro_ufabcjr());
create policy "membros_leem_contatos" on contatos for select using (is_membro_ufabcjr());
create policy "membros_leem_etapas_funil" on etapas_funil for select using (is_membro_ufabcjr());
create policy "membros_leem_produtos_servicos" on produtos_servicos for select using (is_membro_ufabcjr());
create policy "membros_leem_motivos_perda" on motivos_perda for select using (is_membro_ufabcjr());
create policy "membros_leem_negocios" on negocios for select using (is_membro_ufabcjr());
create policy "membros_leem_historico" on negocio_etapa_historico for select using (is_membro_ufabcjr());
create policy "membros_leem_tipos_atividade" on tipos_atividade for select using (is_membro_ufabcjr());
create policy "membros_leem_atividades" on atividades for select using (is_membro_ufabcjr());
create policy "membros_leem_campos_definicao" on campos_dinamicos_definicao for select using (is_membro_ufabcjr());
create policy "membros_leem_campos_valor" on campos_dinamicos_valor for select using (is_membro_ufabcjr());
create policy "membros_leem_canais" on canais_membro for select using (is_membro_ufabcjr());
create policy "membros_leem_whatsapp" on whatsapp_enviados for select using (is_membro_ufabcjr());
create policy "membros_leem_notificacoes" on notificacoes for select using (membro_email = (auth.jwt() ->> 'email'));

-- Escrita operacional (qualquer membro do domínio) — sem policy de INSERT/UPDATE
-- nestas nesta migração porque, como nas 4 legadas, toda escrita real da
-- aplicação passa pela service role. Deixamos comentado como referência caso
-- algum dia se decida ler/escrever com a chave anon diretamente do navegador:
--
-- create policy "membros_escrevem_organizacoes" on organizacoes for insert, update
--   using (is_membro_ufabcjr()) with check (is_membro_ufabcjr());
-- (mesmo padrão para contatos, negocios, atividades, campos_dinamicos_valor)
--
-- create policy "admin_configura_etapas" on etapas_funil for insert, update, delete
--   using (is_admin_ufabcjr());
-- (mesmo padrão para produtos_servicos, motivos_perda, tipos_atividade,
--  campos_dinamicos_definicao)

-- ============================================================================
-- Seção 7 — Relatórios de funil (substituem W7)
-- ============================================================================
create view vw_funil_resumo as
select
  e.id as etapa_id,
  e.nome as etapa_nome,
  e.ordem,
  count(n.id) filter (where n.status = 'aberto') as negocios_abertos,
  coalesce(sum(n.valor) filter (where n.status = 'aberto'), 0) as valor_total_aberto
from etapas_funil e
left join negocios n on n.etapa_id = e.id
where e.ativo
group by e.id, e.nome, e.ordem
order by e.ordem;

create view vw_funil_tempo_medio_etapa as
select
  etapa_id,
  avg(saiu_em - entrou_em) as tempo_medio
from negocio_etapa_historico
where saiu_em is not null
group by etapa_id;

create view vw_funil_conversao as
select
  h.etapa_id,
  count(distinct h.negocio_id) as total_passou,
  count(distinct h2.negocio_id) as total_avancou
from negocio_etapa_historico h
left join negocio_etapa_historico h2
  on h2.negocio_id = h.negocio_id and h2.entrou_em > h.entrou_em
group by h.etapa_id;

create view vw_negocios_atrasados as
select *
from negocios
where status = 'aberto'
  and previsao_fechamento < current_date;
