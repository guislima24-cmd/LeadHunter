-- Lead Hunter x Apollo (Prospect AI) - suporte aos workflows n8n
-- Projeto Supabase: leadhunter (dulpeemmwhudcjqwbolr)
--
-- APLICADO EM 2026-08-18 via Supabase MCP, em 4 migrações:
--   n8n_pipeline_colunas_leads
--   n8n_pipeline_tabelas_dedupe_e_emails
--   n8n_pipeline_indice_cnpj_leads
--   n8n_pipeline_validar_constraints_leads
-- Este arquivo é o registro consolidado do que foi aplicado (idempotente).
-- Tudo é aditivo: nenhuma coluna, tabela ou linha existente foi alterada.

-- 1) Novas colunas na tabela leads -------------------------------------------
-- leads tem ~1,65M linhas / 350 MB. Adicionar coluna com default é operação de
-- catálogo no PG 11+; as CHECKs entram como NOT VALID e são validadas depois,
-- para não segurar lock de escrita durante o scan.

alter table public.leads
  add column if not exists contatado_em            timestamptz,
  add column if not exists contatado_por           text,
  add column if not exists decisor_nome            text,
  add column if not exists decisor_cargo           text,
  add column if not exists decisor_linkedin_url    text,
  add column if not exists site_confirmado         text,
  add column if not exists telefone_confirmado     text,
  add column if not exists setor_confirmado        text,
  add column if not exists enriquecido_em          timestamptz,
  add column if not exists enriquecimento_status   text,
  add column if not exists etapa_funil             text not null default 'novo_lead',
  add column if not exists etapa_atualizada_em     timestamptz;

alter table public.leads
  drop constraint if exists leads_enriquecimento_status_check;
alter table public.leads
  add constraint leads_enriquecimento_status_check
  check (enriquecimento_status is null or enriquecimento_status in ('pendente', 'ok', 'erro'))
  not valid;

alter table public.leads
  drop constraint if exists leads_etapa_funil_check;
alter table public.leads
  add constraint leads_etapa_funil_check
  check (etapa_funil in (
    'novo_lead', 'contatado', 'respondeu', 'reuniao',
    'proposta', 'fechado_ganho', 'fechado_perdido'
  ))
  not valid;

alter table public.leads validate constraint leads_enriquecimento_status_check;
alter table public.leads validate constraint leads_etapa_funil_check;

-- W1/W2/W3 casam leads por cnpj. Os índices de setor, cidade, estado e porte
-- (idx_setor, idx_cidade, idx_estado, idx_porte) já existiam.
create index if not exists leads_cnpj_idx on public.leads (cnpj);

-- 2) Reservas temporárias (dedupe de 24h por filtro) -------------------------

create table if not exists public.lead_reservas (
  id            uuid primary key default gen_random_uuid(),
  lead_cnpj     text        not null,
  filtro_hash   text        not null,
  membro        text,
  lista_id      uuid,
  reservado_em  timestamptz not null default now(),
  expira_em     timestamptz not null default now() + interval '24 hours'
);

-- Uma reserva viva por (cnpj, filtro). O W1 usa ON CONFLICT DO NOTHING.
create unique index if not exists lead_reservas_cnpj_filtro_idx
  on public.lead_reservas (lead_cnpj, filtro_hash);
create index if not exists lead_reservas_expira_em_idx
  on public.lead_reservas (expira_em);

-- 3) Listas geradas -----------------------------------------------------------

create table if not exists public.listas_geradas (
  id               uuid primary key default gen_random_uuid(),
  membro           text,
  setor            text,
  cidade           text,
  filtro_hash      text        not null,
  criada_em        timestamptz not null default now(),
  quantidade_leads int         not null default 0,
  lead_cnpjs       text[]      not null default '{}'
);

create index if not exists listas_geradas_membro_idx on public.listas_geradas (membro, criada_em desc);

-- 4) Emails de prospecção ------------------------------------------------------

create table if not exists public.emails_enviados (
  id                uuid primary key default gen_random_uuid(),
  lead_cnpj         text        not null,
  membro            text,
  assunto           text,
  corpo             text,
  enviado_em        timestamptz not null default now(),
  conta_gmail_usada text,
  status            text        not null default 'enviado'
    check (status in ('enviado', 'erro'))
);

create index if not exists emails_enviados_lead_cnpj_idx on public.emails_enviados (lead_cnpj);
create index if not exists emails_enviados_membro_idx    on public.emails_enviados (membro, enviado_em desc);

-- 5) RLS nas tabelas novas ------------------------------------------------------
-- RLS ligado sem policies: as chaves anon/authenticated da API REST não leem nem
-- escrevem nada nessas tabelas (emails_enviados guarda o corpo dos emails).
-- O n8n acessa por conexão Postgres direta (role postgres), que ignora RLS.

alter table public.lead_reservas   enable row level security;
alter table public.listas_geradas  enable row level security;
alter table public.emails_enviados enable row level security;

-- 6) Limpeza opcional de reservas expiradas ------------------------------------
-- As reservas expiradas não atrapalham a consulta do W1 (ela filtra por
-- expira_em > now()), mas podem ser removidas periodicamente:
--   delete from public.lead_reservas where expira_em < now() - interval '7 days';
