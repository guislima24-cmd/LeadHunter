-- Lead Hunter x Apollo (Prospect AI) - suporte aos workflows n8n
-- Projeto Supabase: leadhunter (dulpeemmwhudcjqwbolr)
-- Aplicar uma unica vez. Todas as alteracoes sao aditivas (nao apagam nada).

begin;

-- 1) Novas colunas na tabela leads -------------------------------------------

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
  check (enriquecimento_status is null or enriquecimento_status in ('pendente', 'ok', 'erro'));

alter table public.leads
  drop constraint if exists leads_etapa_funil_check;
alter table public.leads
  add constraint leads_etapa_funil_check
  check (etapa_funil in (
    'novo_lead', 'contatado', 'respondeu', 'reuniao',
    'proposta', 'fechado_ganho', 'fechado_perdido'
  ));

-- O W1 filtra por cnpj, contatado_em, setor, cidade e estado.
create index if not exists leads_cnpj_idx            on public.leads (cnpj);
create index if not exists leads_contatado_em_idx    on public.leads (contatado_em);
create index if not exists leads_setor_cidade_idx    on public.leads (setor, cidade);
create index if not exists leads_estado_idx          on public.leads (estado);

-- 2) Reservas temporarias (dedupe de 24h por filtro) -------------------------

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

-- 4) Emails de prospeccao ------------------------------------------------------

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

commit;

-- 5) Limpeza opcional de reservas expiradas ------------------------------------
-- As reservas expiradas nao atrapalham a consulta do W1 (ela filtra por
-- expira_em > now()), mas podem ser removidas periodicamente:
--   delete from public.lead_reservas where expira_em < now() - interval '7 days';
