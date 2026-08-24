-- ============================================================================
-- 012 — Insights: funil de prospecção, metas/OKRs e relatórios mensais
--
-- Implementa a Seção 5 do PRD de navegação e insights.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Eventos de topo de funil registrados à mão
--
-- Prospecção (email enviado) e Contratos (negócio ganho) a plataforma já
-- sabe sozinha. Aceite e Resposta, não: nenhum workflow lê a caixa de
-- entrada institucional hoje, então o W3 grava que o email saiu e o que
-- acontece depois só quem conversou sabe.
--
-- Registrar à mão é o preço de não ter essa automação ainda — e é o
-- trade-off que o próprio PRD assume (Seção 7). A tabela nasce preparada
-- para o dia em que a automação existir: `registrado_por_email` nulo passa
-- a significar "detectado automaticamente".
-- ----------------------------------------------------------------------------
create table funil_prospeccao_eventos (
  id uuid primary key default gen_random_uuid(),
  lead_cnpj text not null,
  tipo_evento text not null check (tipo_evento in ('aceite', 'resposta')),
  ocorrido_em timestamptz not null default now(),
  -- O PRD desenha `registrado_por uuid references member_profiles(id)`;
  -- `member_profiles` é chaveado por email, mesma adaptação do resto do CRM.
  registrado_por_email text references member_profiles(email),
  observacao text,
  criado_em timestamptz not null default now()
);

comment on table funil_prospeccao_eventos is
  'Aceite e resposta de prospecção, registrados manualmente pelo vendedor. registrado_por_email nulo = detectado por automação (ainda não existe).';

-- Sem FK para `leads(cnpj)`: aquela coluna não tem constraint de unicidade
-- em produção (mesma decisão de organizacoes.lead_origem_cnpj, migração
-- 003) — criar o índice único agora seria lock numa tabela de 1,6M linhas
-- que W1/W2/W3 escrevem o tempo todo.
create index idx_funil_eventos_lead on funil_prospeccao_eventos(lead_cnpj);
create index idx_funil_eventos_tipo_data on funil_prospeccao_eventos(tipo_evento, ocorrido_em);

-- O mesmo lead não aceita duas vezes: sem isto, dois cliques no botão
-- inflariam a taxa de aceite do mês.
create unique index idx_funil_eventos_unico
  on funil_prospeccao_eventos(lead_cnpj, tipo_evento);

create view vw_funil_prospeccao_mensal as
select
  date_trunc('month', ocorrido_em)::date as mes,
  tipo_evento,
  count(*) as quantidade
from funil_prospeccao_eventos
group by date_trunc('month', ocorrido_em), tipo_evento;

alter view vw_funil_prospeccao_mensal set (security_invoker = true);

-- ----------------------------------------------------------------------------
-- 2. Metas e OKRs
--
-- `meta_pai_id` preenchido → a linha é um Resultado-Chave do Objetivo que
-- ela referencia. Sem pai e sem filhos → meta simples.
--
-- `valor_atual` só é lido para `metrica_fonte = 'manual'`. Para as demais o
-- número é **calculado na leitura**, a partir da fonte real, e não guardado:
-- o PRD previa um job periódico, mas um valor gravado por job fica errado
-- entre uma execução e a seguinte — e uma meta que mostra número velho é
-- pior que não mostrar número nenhum, porque ninguém desconfia. O cálculo é
-- um count/sum sobre índice existente; não vale um cron para isso.
-- ----------------------------------------------------------------------------
create table metas (
  id uuid primary key default gen_random_uuid(),
  meta_pai_id uuid references metas(id) on delete cascade,
  nome text not null,
  descricao text,
  metrica_fonte text not null check (metrica_fonte in (
    'manual', 'contratos_fechados', 'faturamento_ganho',
    'reunioes_realizadas', 'prospeccoes_realizadas', 'negocios_criados'
  )),
  valor_alvo numeric not null check (valor_alvo > 0),
  valor_atual numeric not null default 0,
  unidade text,
  periodo_inicio date not null,
  periodo_fim date not null,
  ativo boolean not null default true,
  criado_por_email text not null references member_profiles(email),
  atualizado_em timestamptz not null default now(),
  criado_em timestamptz not null default now(),
  constraint periodo_coerente check (periodo_fim >= periodo_inicio)
);

comment on table metas is
  'Metas e OKRs do comercial. valor_atual só vale para metrica_fonte = manual; as demais são calculadas na leitura a partir da fonte real.';
comment on column metas.meta_pai_id is
  'Preenchido = esta linha é um Resultado-Chave do Objetivo referenciado.';

create index idx_metas_periodo on metas(periodo_inicio, periodo_fim);
create index idx_metas_pai on metas(meta_pai_id);

-- ----------------------------------------------------------------------------
-- 3. Relatórios mensais
--
-- `metricas_snapshot` guarda os números exatos que embasaram o texto. Sem
-- ele, reabrir um relatório de três meses atrás recalcularia tudo com o dado
-- de hoje e o texto passaria a contradizer os próprios números — um negócio
-- reclassificado depois mudaria a história de um mês já fechado. Mesmo
-- trade-off do módulo de precificação, pelo mesmo motivo.
-- ----------------------------------------------------------------------------
create table relatorios_mensais (
  id uuid primary key default gen_random_uuid(),
  periodo_referencia date not null,
  titulo text not null,
  conteudo text not null,
  gerado_por_ia boolean not null default false,
  status text not null default 'rascunho' check (status in ('rascunho', 'publicado')),
  metricas_snapshot jsonb,
  criado_por_email text references member_profiles(email),
  publicado_por_email text references member_profiles(email),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  publicado_em timestamptz
);

comment on table relatorios_mensais is
  'Relatórios mensais do comercial. Gerado por IA nasce sempre como rascunho — nunca publica sozinho.';
comment on column relatorios_mensais.metricas_snapshot is
  'Os números exatos usados para escrever o texto, congelados. Existe para o relatório não mudar de história se o dado histórico for editado depois.';

create index idx_relatorios_periodo on relatorios_mensais(periodo_referencia desc);

-- Um relatório publicado por mês: dois "oficiais" do mesmo período é
-- ambiguidade sem dono. Rascunhos convivem à vontade (é a mesa de trabalho).
create unique index idx_relatorios_publicado_unico
  on relatorios_mensais(periodo_referencia)
  where status = 'publicado';

-- ----------------------------------------------------------------------------
-- 4. Publicar um relatório
--
-- Vira função porque publicar é o único momento em que um relatório deixa de
-- ser rascunho e passa a valer como registro do mês — e porque o índice
-- parcial acima transforma "já tem um publicado" num erro de constraint que
-- a tela não saberia explicar sozinha.
-- ----------------------------------------------------------------------------
create or replace function crm_publicar_relatorio(
  p_relatorio_id uuid,
  p_membro_email text
)
returns void
language plpgsql
set search_path to 'public'
as $$
declare
  v_periodo date;
begin
  select periodo_referencia into v_periodo
    from relatorios_mensais
   where id = p_relatorio_id and status = 'rascunho';

  if v_periodo is null then
    raise exception 'relatorio_nao_encontrado_ou_ja_publicado' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from relatorios_mensais
     where periodo_referencia = v_periodo and status = 'publicado'
  ) then
    raise exception 'ja_existe_relatorio_publicado_no_periodo' using errcode = 'P0001';
  end if;

  update relatorios_mensais
     set status = 'publicado',
         publicado_por_email = p_membro_email,
         publicado_em = now(),
         atualizado_em = now()
   where id = p_relatorio_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5. RLS
--
-- Leitura para o domínio, escrita só pela chave de service role — mesmo
-- padrão do resto do CRM. Quem pode escrever o quê (metas só admin, por
-- exemplo) é decidido nas rotas, que é onde o papel do membro é conhecido.
-- ----------------------------------------------------------------------------
alter table funil_prospeccao_eventos enable row level security;
alter table metas enable row level security;
alter table relatorios_mensais enable row level security;

create policy "membros_leem_eventos_funil" on funil_prospeccao_eventos
  for select using (is_membro_ufabcjr());
create policy "membros_leem_metas" on metas
  for select using (is_membro_ufabcjr());
create policy "membros_leem_relatorios" on relatorios_mensais
  for select using (is_membro_ufabcjr());
