-- ============================================================================
-- 011 — Reagendamento de negócio perdido por timing, e previsão por mês
--
-- Implementa as Seções 3.1 (visualização Previsão) e 4 do PRD de navegação e
-- insights. O problema que a Seção 4 resolve: hoje, quando um negócio não
-- fecha porque o cliente não podia *agora*, a informação de quando e como
-- retomar fica só na cabeça de quem geriu aquele negócio.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Qual motivo de perda dispara o formulário de retomada
--
-- O PRD pede uma entrada nova chamada "Momento errado". Só que já existe
-- "Timing ruim" (ordem 5), que é exatamente o mesmo motivo com outro nome —
-- criar a nova ao lado deixaria duas opções sinônimas na mesma lista e
-- rachava o histórico entre as duas. Então: renomeia no lugar, preservando o
-- uuid (e portanto os negócios que já apontam para ele).
--
-- A ligação com o formulário é uma coluna, não o nome. Casar por texto
-- ("se motivo = 'Momento errado'") quebraria em silêncio no dia em que
-- alguém reescrevesse o rótulo na tela de configuração — e o rótulo existe
-- justamente para ser editável.
-- ----------------------------------------------------------------------------
alter table motivos_perda
  add column exige_reagendamento boolean not null default false;

comment on column motivos_perda.exige_reagendamento is
  'Marcar este motivo obriga o preenchimento do briefing de retomada (negocio_reagendamentos) na mesma transação do fechamento.';

update motivos_perda
   set nome = 'Momento errado',
       exige_reagendamento = true
 where nome = 'Timing ruim';

-- Se a base não tinha "Timing ruim" (instalação limpa), cria o motivo.
insert into motivos_perda (nome, ordem, exige_reagendamento)
select 'Momento errado', 5, true
 where not exists (select 1 from motivos_perda where exige_reagendamento);

-- ----------------------------------------------------------------------------
-- 2. O briefing de retomada
--
-- `contexto_para_retomada` é o campo que carrega o peso aqui: é o que
-- permite que qualquer pessoa do time — não só quem perdeu o negócio —
-- retome a conversa sabendo o que já foi falado.
-- ----------------------------------------------------------------------------
create table negocio_reagendamentos (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references negocios(id) on delete cascade,
  motivo_detalhado text not null,
  contexto_para_retomada text not null,
  data_recontato date not null,
  status text not null default 'aguardando'
    check (status in ('aguardando', 'recontatado', 'expirado')),
  notificado_em timestamptz,
  recontatado_em timestamptz,
  recontatado_por_email text references member_profiles(email),
  -- O PRD desenha `criado_por uuid references member_profiles(id)`, mas
  -- `member_profiles` é chaveado por email (texto) e não tem coluna `id` —
  -- mesma adaptação já feita em todo o resto do CRM.
  criado_por_email text not null references member_profiles(email),
  criado_em timestamptz not null default now()
);

comment on table negocio_reagendamentos is
  'Briefing de retomada de um negócio perdido por timing: por que não deu agora, o que o cliente pediu e quando voltar a falar.';

create index idx_reagendamentos_status_data
  on negocio_reagendamentos(status, data_recontato);

-- Um negócio perdido tem um plano de retomada, não vários: reabrir a mesma
-- perda duas vezes seria duas datas concorrentes para a mesma conversa.
create unique index idx_reagendamentos_negocio_unico
  on negocio_reagendamentos(negocio_id);

-- ----------------------------------------------------------------------------
-- 3. Fechar negócio, agora exigindo o briefing quando o motivo pede
--
-- A regra mora aqui e não na rota HTTP porque a rota é uma das portas, não a
-- única: o `crm_fechar_negocio` é chamado do quadro e da ficha, e um dia
-- pode ser chamado de um workflow. Exigir na função é exigir em todas.
--
-- Os parâmetros novos têm default null para não quebrar chamadas existentes
-- — o que não significa que fechar sem eles passe: se o motivo escolhido
-- exige reagendamento e os campos vierem vazios, a função levanta erro e a
-- transação inteira volta atrás, sem negócio fechado pela metade.
--
-- O `drop` antes do `create` não é zelo: em Postgres a assinatura faz parte
-- da identidade da função, então `create or replace` com parâmetros novos
-- cria uma **segunda** função em vez de substituir a primeira. Ficariam duas
-- `crm_fechar_negocio` convivendo, e uma chamada com quatro argumentos —
-- que é como a rota de fechar chamava até agora — casaria com a versão
-- antiga, aquela que não sabe nada de reagendamento. A regra nova passaria
-- despercebida exatamente no caminho que ela precisa cobrir.
-- ----------------------------------------------------------------------------
drop function if exists crm_fechar_negocio(uuid, text, text, uuid);

create or replace function crm_fechar_negocio(
  p_negocio_id uuid,
  p_status text,
  p_membro_email text,
  p_motivo_perda_id uuid default null,
  p_motivo_detalhado text default null,
  p_contexto_para_retomada text default null,
  p_data_recontato date default null
)
returns void
language plpgsql
set search_path to 'public'
as $$
declare
  v_exige boolean;
begin
  if p_status not in ('ganho', 'perdido') then
    raise exception 'status_invalido' using errcode = 'P0001';
  end if;
  if p_status = 'perdido' and p_motivo_perda_id is null then
    raise exception 'motivo_perda_obrigatorio' using errcode = 'P0001';
  end if;
  if not exists (select 1 from negocios where id = p_negocio_id and status = 'aberto') then
    raise exception 'negocio_nao_encontrado_ou_ja_fechado' using errcode = 'P0001';
  end if;

  select exige_reagendamento into v_exige
    from motivos_perda where id = p_motivo_perda_id;

  if p_status = 'perdido' and coalesce(v_exige, false) then
    if coalesce(trim(p_motivo_detalhado), '') = ''
       or coalesce(trim(p_contexto_para_retomada), '') = ''
       or p_data_recontato is null then
      raise exception 'reagendamento_obrigatorio' using errcode = 'P0001';
    end if;
    if p_data_recontato <= current_date then
      raise exception 'data_recontato_no_passado' using errcode = 'P0001';
    end if;
  end if;

  update negocio_etapa_historico
     set saiu_em = now()
   where negocio_id = p_negocio_id
     and saiu_em is null;

  update negocios
     set status = p_status,
         motivo_perda_id = case when p_status = 'perdido' then p_motivo_perda_id else null end,
         fechado_em = now(),
         atualizado_em = now()
   where id = p_negocio_id;

  if p_status = 'perdido' and coalesce(v_exige, false) then
    insert into negocio_reagendamentos (
      negocio_id, motivo_detalhado, contexto_para_retomada,
      data_recontato, criado_por_email
    ) values (
      p_negocio_id, trim(p_motivo_detalhado), trim(p_contexto_para_retomada),
      p_data_recontato, p_membro_email
    )
    -- Reabrir e reperder o mesmo negócio reescreve o plano em vez de falhar.
    on conflict (negocio_id) do update
      set motivo_detalhado = excluded.motivo_detalhado,
          contexto_para_retomada = excluded.contexto_para_retomada,
          data_recontato = excluded.data_recontato,
          status = 'aguardando',
          notificado_em = null,
          recontatado_em = null,
          recontatado_por_email = null,
          criado_por_email = excluded.criado_por_email,
          criado_em = now();
  end if;
end;
$$;

comment on function crm_fechar_negocio(uuid, text, text, uuid, text, text, date) is
  'Fecha um negócio como ganho ou perdido. Quando o motivo da perda tem exige_reagendamento, grava o briefing de retomada na mesma transação — ou falha inteira.';

-- ----------------------------------------------------------------------------
-- 4. Marcar que o contato foi retomado
--
-- O negócio original continua perdido de propósito: se a conversa reaberta
-- virar oportunidade, ela nasce como negócio novo (Seção 8.2 da
-- especificação principal), e não ressuscitando um fechado — senão o
-- histórico de conversão do funil passa a contar o mesmo negócio duas vezes.
-- ----------------------------------------------------------------------------
create or replace function crm_marcar_recontatado(
  p_reagendamento_id uuid,
  p_membro_email text
)
returns void
language plpgsql
set search_path to 'public'
as $$
begin
  if not exists (
    select 1 from negocio_reagendamentos
     where id = p_reagendamento_id and status = 'aguardando'
  ) then
    raise exception 'reagendamento_nao_encontrado_ou_ja_tratado' using errcode = 'P0001';
  end if;

  update negocio_reagendamentos
     set status = 'recontatado',
         recontatado_em = now(),
         recontatado_por_email = p_membro_email
   where id = p_reagendamento_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5. Views
-- ----------------------------------------------------------------------------

-- Alimenta a subaba "Reagendados". Traz o nome da empresa junto porque a
-- tela lista por cliente, não por id de negócio.
create view vw_negocios_reagendados_pendentes as
select
  r.id,
  r.negocio_id,
  r.motivo_detalhado,
  r.contexto_para_retomada,
  r.data_recontato,
  r.status,
  r.notificado_em,
  r.criado_por_email,
  r.criado_em,
  n.titulo,
  n.organizacao_id,
  n.dono_email,
  n.valor,
  n.fechado_em,
  o.razao_social as organizacao_nome,
  c.nome as contato_nome,
  c.email as contato_email,
  c.telefone as contato_telefone,
  (r.data_recontato - current_date) as dias_ate_recontato
from negocio_reagendamentos r
join negocios n on n.id = r.negocio_id
join organizacoes o on o.id = n.organizacao_id
left join contatos c on c.id = n.contato_id
where r.status = 'aguardando';

alter view vw_negocios_reagendados_pendentes set (security_invoker = true);

-- Visualização "Previsão": quanto se espera fechar, por mês de competência.
create view vw_negocios_previsao_mensal as
select
  date_trunc('month', previsao_fechamento)::date as mes,
  count(*) as quantidade,
  coalesce(sum(valor), 0) as valor_total,
  count(*) filter (where valor is null) as sem_valor
from negocios
where status = 'aberto' and previsao_fechamento is not null
group by date_trunc('month', previsao_fechamento);

alter view vw_negocios_previsao_mensal set (security_invoker = true);

comment on view vw_negocios_previsao_mensal is
  'Negócios abertos agrupados pelo mês da previsão de fechamento. `sem_valor` existe para a tela poder dizer que o total do mês está subestimado.';

-- ----------------------------------------------------------------------------
-- 6. Tipos de atividade para o funil de prospecção (Seção 5.1 do PRD)
--
-- RD e RP entram como tipo de reunião, não como etapa do funil de negócios:
-- mexer em `etapas_funil` agora obrigaria a remapear todo negócio em
-- andamento, e o PRD (Seção 7) prefere adiar essa decisão até ver os dois
-- funis lado a lado com dado real.
-- ----------------------------------------------------------------------------
insert into tipos_atividade (nome, icone)
select * from (values
  ('Reunião Diagnóstica', 'estetoscopio'),
  ('Reunião de Proposta', 'documento')
) as t(nome, icone)
where not exists (select 1 from tipos_atividade ta where ta.nome = t.nome);

-- ----------------------------------------------------------------------------
-- 7. RLS — mesmo padrão do resto do CRM: leitura para o domínio, escrita só
-- pela chave de service role da aplicação.
-- ----------------------------------------------------------------------------
alter table negocio_reagendamentos enable row level security;

create policy "membros_leem_reagendamentos" on negocio_reagendamentos
  for select using (is_membro_ufabcjr());
