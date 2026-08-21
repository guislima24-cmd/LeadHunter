-- =============================================================================
-- Plataforma web (Núcleo Comercial) — migrações aplicadas em 20/08/2026
--
-- Este diretório guarda **todas** as migrações aplicadas ao projeto Supabase
-- `dulpeemmwhudcjqwbolr`, de automação e de aplicação. O arquivo 001 cobre o
-- pipeline do n8n; este cobre o que a plataforma web precisou.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. `plataforma_membros_vinculo_planilha`
--
-- Liga o login (email Google) ao nome da aba do membro na planilha
-- "Prospecção - Vendas". Todo webhook do n8n exige o campo `membro`, e ele
-- precisa bater exatamente com o nome da aba.
-- -----------------------------------------------------------------------------
alter table public.member_profiles
  add column if not exists aba_planilha text,
  add column if not exists papel        text    not null default 'membro',
  add column if not exists ativo        boolean not null default true,
  add column if not exists criado_em    timestamptz not null default now();

alter table public.member_profiles
  drop constraint if exists member_profiles_papel_check;
alter table public.member_profiles
  add constraint member_profiles_papel_check
  check (papel in ('membro', 'admin'));

-- Um membro por aba: impede que dois logins gravem na mesma aba por engano.
create unique index if not exists member_profiles_aba_planilha_idx
  on public.member_profiles (aba_planilha)
  where aba_planilha is not null;

-- Vínculos com correspondência inequívoca entre email e aba existente.
update public.member_profiles set aba_planilha = 'Anna'        where email = 'anna.ferreira@ufabcjr.com.br';
update public.member_profiles set aba_planilha = 'Felipe'      where email = 'felipe.ikeda@ufabcjr.com.br';
update public.member_profiles set aba_planilha = 'Gustavo'     where email = 'gustavo.sumita@ufabcjr.com.br';
update public.member_profiles set aba_planilha = 'Gui Lima'    where email = 'guilherme.lima@ufabcjr.com.br';
update public.member_profiles set aba_planilha = 'Gui Midolli' where email = 'guilherme.midolli@ufabcjr.com.br';
update public.member_profiles set aba_planilha = 'Larissa'     where email = 'larissa.preto@ufabcjr.com.br';
update public.member_profiles set aba_planilha = 'Léo'         where email = 'leonardo.aguilar@ufabcjr.com.br';
update public.member_profiles set aba_planilha = 'Tiago'       where email = 'tiago.santos@ufabcjr.com.br';

update public.member_profiles set papel = 'admin' where email = 'guilherme.lima@ufabcjr.com.br';

-- ⚠️ Vínculos que faltam (ver README):
--   - `maria.almeida@ufabcjr.com.br` ficou sem aba de propósito: nenhuma das
--     12 abas corresponde ao nome com certeza. Suspeita: `Duda`. Confirme e rode
--       update public.member_profiles set aba_planilha = 'Duda'
--       where email = 'maria.almeida@ufabcjr.com.br';
--   - As abas `Daniel`, `Letícia` e `Caio Sperandio` não têm email cadastrado.
--     Elas se cadastram sozinhas no primeiro login (qualquer @ufabcjr.com.br
--     entra); depois basta preencher a aba:
--       update public.member_profiles set aba_planilha = 'Daniel'
--       where email = '<email>@ufabcjr.com.br';


-- -----------------------------------------------------------------------------
-- 2. `plataforma_funil_metricas_e_indices`
--
-- O W7 já grava seu resultado na planilha e no Notion. Gravar também aqui é o
-- que permite a plataforma mostrar o dashboard sem precisar de credencial do
-- Google nem do Notion no app web — cada ciclo grava uma "fotografia".
-- -----------------------------------------------------------------------------
create table if not exists public.funil_metricas (
  id                  uuid primary key default gen_random_uuid(),
  calculado_em        timestamptz not null default now(),
  etapa               text        not null,
  ordem               int         not null default 0,
  quantidade_atual    int         not null default 0,
  taxa_conversao      numeric(6,2),
  tempo_medio_dias    numeric(8,2),
  total_leads         int         not null default 0,
  observacoes_ia      text
);

create index if not exists funil_metricas_calculado_em_idx
  on public.funil_metricas (calculado_em desc);

alter table public.funil_metricas enable row level security;

-- Índices parciais para os contadores da plataforma. Sem eles, cada carregada
-- do painel varre as 1,67 milhão de linhas de `leads`.
create index if not exists leads_contatado_por_idx
  on public.leads (contatado_por, contatado_em desc)
  where contatado_em is not null;

create index if not exists leads_enriquecimento_status_idx
  on public.leads (enriquecimento_status)
  where enriquecimento_status is not null;

create index if not exists listas_geradas_membro_idx
  on public.listas_geradas (membro, criada_em desc);

create index if not exists emails_enviados_membro_idx
  on public.emails_enviados (membro, enviado_em desc);

create index if not exists lead_reservas_membro_idx
  on public.lead_reservas (membro, expira_em desc);


-- -----------------------------------------------------------------------------
-- 3. `plataforma_funcao_funil_do_membro`
--
-- Funil de prospecção de um membro, em uma única ida ao banco. Feito como
-- função porque a etapa "enriquecidos" precisa cruzar `leads` com os CNPJs
-- guardados em array nas listas do membro — fazer isso do lado do app
-- significaria trazer milhares de CNPJs só para devolvê-los num `in (...)`.
-- -----------------------------------------------------------------------------
create or replace function public.funil_do_membro(p_membro text)
returns table (
  leads_gerados   bigint,
  reservas_ativas bigint,
  enriquecidos    bigint,
  emails_enviados bigint,
  contatados      bigint
)
language sql
stable
set search_path = public
as $$
  with cnpjs as (
    select distinct unnest(lead_cnpjs) as cnpj
    from listas_geradas
    where membro = p_membro
  )
  select
    (select count(*) from cnpjs),
    (select count(*) from lead_reservas
      where membro = p_membro and expira_em > now()),
    (select count(*) from leads l
      join cnpjs c on c.cnpj = l.cnpj
      -- 'ok' é o valor que o W2 grava e o único que a CHECK da tabela aceita
      -- (junto de 'pendente' e 'erro'). Já foi 'concluido' aqui, e a etapa
      -- devolvia zero sempre.
      where l.enriquecimento_status = 'ok'),
    (select count(*) from emails_enviados
      where membro = p_membro and status = 'enviado'),
    (select count(*) from leads where contatado_por = p_membro);
$$;

revoke execute on function public.funil_do_membro(text) from anon, authenticated;


-- -----------------------------------------------------------------------------
-- 4. `plataforma_email_remetente_por_membro`
--
-- Prepara a virada de envio institucional para envio individual.
--
--   vazio       -> o email sai pela conta institucional (como hoje)
--   preenchido  -> a plataforma passa este endereço como remetente pretendido,
--                  e o W3 pode rotear para a credencial daquele membro
--
-- Mora aqui, e não como nó extra no workflow, porque a credencial do Gmail no
-- n8n é por nó e não aceita expressão: deixar 12 nós vazios esperando
-- credencial seria estrutura morta. Assim a virada é um UPDATE por membro.
-- -----------------------------------------------------------------------------
alter table public.member_profiles
  add column if not exists email_remetente text;

comment on column public.member_profiles.email_remetente is
  'Endereço do Gmail que envia a prospecção deste membro. Vazio = conta institucional.';


-- =============================================================================
-- ⚠️ PENDENTE — decisão de segurança que cabe a vocês, não foi aplicada
--
-- Quatro tabelas estão com Row Level Security DESLIGADA:
--   public.leads, public.activity_log, public.member_profiles, public.configuracoes
--
-- A chave anon do Supabase é pública por natureza (vai no navegador). Com RLS
-- desligada, qualquer pessoa que tenha essa chave consegue ler e escrever nas
-- quatro tabelas — inclusive as 1,67 milhão de linhas de `leads` e os perfis
-- dos membros.
--
-- A plataforma web já não depende disso: toda leitura de dado passa pelo
-- servidor com a service role, atrás da checagem de sessão. O navegador só
-- recebe a chave anon, e apenas para autenticar. Ou seja, ligar RLS **não
-- quebra a plataforma**.
--
-- Antes de rodar, confira se algum outro sistema (extensão do Chrome, script,
-- versão antiga do app) ainda lê essas tabelas com a chave anon — esse sim
-- pararia de funcionar.
--
--   alter table public.leads           enable row level security;
--   alter table public.activity_log    enable row level security;
--   alter table public.member_profiles enable row level security;
--   alter table public.configuracoes   enable row level security;
--
-- Nenhuma policy é necessária: sem policy, anon e authenticated não enxergam
-- nada, e a service role continua passando por cima da RLS normalmente.
-- =============================================================================
