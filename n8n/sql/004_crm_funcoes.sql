-- ============================================================================
-- CRM sobre a Lead Hunter — migração 004: funções transacionais
-- ============================================================================
-- Seção 8 da especificação. Cada fluxo que grava em mais de uma tabela vira
-- uma função Postgres chamada via `.rpc()`, não uma sequência de chamadas do
-- Node — mesma razão pela qual W1/W2/W3 já usam SQL puro em vez do nó
-- Supabase: garantir atomicidade real (tudo ou nada), não só "na prática
-- funciona". Todas rodam com a chave de service role da aplicação, então não
-- há `security definer`/checagem de RLS aqui — a autorização (quem pode
-- promover, quem pode reatribuir dono) é feita na rota Next.js antes de
-- chamar a função.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 8.1 — Promoção de lead bruto → negócio
-- ----------------------------------------------------------------------------
create or replace function crm_promover_lead(
  p_cnpj text,
  p_membro_email text,
  p_titulo text default null
)
returns uuid
language plpgsql
as $$
declare
  v_lead record;
  v_organizacao_id uuid;
  v_etapa_inicial uuid;
  v_negocio_id uuid;
begin
  select * into v_lead from leads where cnpj = p_cnpj;
  if not found then
    raise exception 'lead_nao_encontrado' using errcode = 'P0001';
  end if;

  -- Defensivo: o dedupe do W1 não deveria deixar isso acontecer, mas nada
  -- impede duas promoções concorrentes do mesmo CNPJ.
  select id into v_organizacao_id from organizacoes where cnpj = p_cnpj;

  if v_organizacao_id is null then
    insert into organizacoes (
      cnpj, lead_origem_cnpj, razao_social, nome_fantasia, setor, cidade,
      estado, telefone, site, criado_por_email
    ) values (
      v_lead.cnpj, v_lead.cnpj, v_lead.razao_social, v_lead.nome_fantasia,
      coalesce(v_lead.setor_confirmado, v_lead.setor), v_lead.cidade, v_lead.estado,
      coalesce(v_lead.telefone_confirmado, v_lead.telefone), v_lead.site_confirmado,
      p_membro_email
    )
    returning id into v_organizacao_id;

    if v_lead.decisor_nome is not null then
      insert into contatos (
        organizacao_id, nome, cargo, linkedin_url, principal, criado_por_email
      ) values (
        v_organizacao_id, v_lead.decisor_nome, v_lead.decisor_cargo,
        v_lead.decisor_linkedin_url, true, p_membro_email
      );
    end if;
  end if;

  select id into v_etapa_inicial from etapas_funil where ativo order by ordem asc limit 1;
  if v_etapa_inicial is null then
    raise exception 'sem_etapa_inicial_configurada' using errcode = 'P0001';
  end if;

  insert into negocios (
    organizacao_id, contato_id, titulo, etapa_id, dono_email, origem,
    lead_origem_cnpj, criado_por_email
  ) values (
    v_organizacao_id,
    (select id from contatos where organizacao_id = v_organizacao_id and principal limit 1),
    coalesce(p_titulo, v_lead.razao_social),
    v_etapa_inicial, p_membro_email, 'promocao_lead', p_cnpj, p_membro_email
  )
  returning id into v_negocio_id;

  insert into negocio_etapa_historico (negocio_id, etapa_id, alterado_por_email)
  values (v_negocio_id, v_etapa_inicial, p_membro_email);

  return v_negocio_id;
end;
$$;

comment on function crm_promover_lead is 'Promove um lead bruto (leads) a negócio no CRM: cria organização (se ainda não existir para o CNPJ), contato principal a partir do decisor já enriquecido, negócio na primeira etapa ativa e o registro de histórico correspondente. Idempotente por CNPJ: chamar de novo para o mesmo CNPJ reaproveita a organização/contato já criados.';

-- ----------------------------------------------------------------------------
-- 8.2 — Criação avulsa de negócio
-- ----------------------------------------------------------------------------
create or replace function crm_criar_negocio_avulso(
  p_organizacao_id uuid,
  p_titulo text,
  p_membro_email text,
  p_contato_id uuid default null,
  p_produto_servico_id uuid default null,
  p_valor numeric default null,
  p_previsao_fechamento date default null
)
returns uuid
language plpgsql
as $$
declare
  v_etapa_inicial uuid;
  v_negocio_id uuid;
begin
  if not exists (select 1 from organizacoes where id = p_organizacao_id) then
    raise exception 'organizacao_nao_encontrada' using errcode = 'P0001';
  end if;

  if p_contato_id is not null
     and not exists (select 1 from contatos where id = p_contato_id and organizacao_id = p_organizacao_id) then
    raise exception 'contato_nao_pertence_a_organizacao' using errcode = 'P0001';
  end if;

  select id into v_etapa_inicial from etapas_funil where ativo order by ordem asc limit 1;
  if v_etapa_inicial is null then
    raise exception 'sem_etapa_inicial_configurada' using errcode = 'P0001';
  end if;

  insert into negocios (
    organizacao_id, contato_id, titulo, etapa_id, dono_email, valor,
    produto_servico_id, previsao_fechamento, origem, criado_por_email
  ) values (
    p_organizacao_id, p_contato_id, p_titulo, v_etapa_inicial, p_membro_email,
    p_valor, p_produto_servico_id, p_previsao_fechamento, 'avulso', p_membro_email
  )
  returning id into v_negocio_id;

  insert into negocio_etapa_historico (negocio_id, etapa_id, alterado_por_email)
  values (v_negocio_id, v_etapa_inicial, p_membro_email);

  return v_negocio_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 8.3 — Movimentação de etapa
-- ----------------------------------------------------------------------------
create or replace function crm_mover_etapa(
  p_negocio_id uuid,
  p_etapa_id uuid,
  p_membro_email text
)
returns void
language plpgsql
as $$
begin
  if not exists (select 1 from negocios where id = p_negocio_id) then
    raise exception 'negocio_nao_encontrado' using errcode = 'P0001';
  end if;
  if not exists (select 1 from etapas_funil where id = p_etapa_id and ativo) then
    raise exception 'etapa_invalida' using errcode = 'P0001';
  end if;

  update negocio_etapa_historico
     set saiu_em = now()
   where negocio_id = p_negocio_id
     and saiu_em is null;

  insert into negocio_etapa_historico (negocio_id, etapa_id, alterado_por_email)
  values (p_negocio_id, p_etapa_id, p_membro_email);

  update negocios
     set etapa_id = p_etapa_id,
         atualizado_em = now()
   where id = p_negocio_id;
end;
$$;

comment on function crm_mover_etapa is 'Move um negócio para outra etapa, fechando o registro de histórico aberto e abrindo um novo. Livre em qualquer direção (sem trava de "não pode voltar etapa") — ver Seção 8.3 da especificação.';

-- ----------------------------------------------------------------------------
-- 8.4 — Marcar como ganho/perdido
-- ----------------------------------------------------------------------------
create or replace function crm_fechar_negocio(
  p_negocio_id uuid,
  p_status text,
  p_membro_email text,
  p_motivo_perda_id uuid default null
)
returns void
language plpgsql
as $$
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
end;
$$;

comment on function crm_fechar_negocio is 'Marca um negócio aberto como ganho ou perdido, exigindo motivo_perda_id quando perdido, e fecha o registro de histórico em aberto. Não há coluna própria para "quem fechou" em negocios — se isso vier a importar, adicionar fechado_por_email na tabela em vez de inferir do histórico.';
