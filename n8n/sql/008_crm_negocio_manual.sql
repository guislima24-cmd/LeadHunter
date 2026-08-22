-- ============================================================================
-- CRM sobre a Lead Hunter — migração 008: negócio criado à mão no funil
-- ============================================================================
-- `crm_criar_negocio_avulso` (004) exige uma `organizacao_id` que já exista,
-- então só serve para upsell em quem já está no CRM. O botão "Novo negócio"
-- do quadro precisa do caso de entrada: alguém que apareceu por indicação,
-- evento ou telefone e não passou por lead nenhum — não há organização, nem
-- contato, nem CNPJ necessariamente.
--
-- Mesma razão das outras quatro: são três tabelas (organizacoes, contatos,
-- negocios) mais o histórico numa operação só, e meio caminho gravado é pior
-- que nada — organização órfã sem negócio é lixo que ninguém encontra para
-- limpar.
--
-- Também acrescenta à view do quadro os dois ids que a ficha do negócio
-- precisa para montar os selects de edição (o nome já vinha; o id, não).
-- ============================================================================

create or replace function crm_criar_negocio_manual(
  p_membro_email text,
  p_organizacao_nome text,
  p_titulo text,
  p_cnpj text default null,
  p_contato_nome text default null,
  p_contato_email text default null,
  p_contato_telefone text default null,
  p_produto_servico_id uuid default null,
  p_valor numeric default null,
  p_previsao_fechamento date default null
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_nome text;
  v_titulo text;
  v_cnpj text;
  v_contato_nome text;
  v_organizacao_id uuid;
  v_contato_id uuid;
  v_etapa_inicial uuid;
  v_negocio_id uuid;
begin
  v_nome := nullif(btrim(coalesce(p_organizacao_nome, '')), '');
  v_titulo := nullif(btrim(coalesce(p_titulo, '')), '');

  if v_nome is null then
    raise exception 'organizacao_nome_obrigatorio' using errcode = 'P0001';
  end if;
  if v_titulo is null then
    raise exception 'titulo_obrigatorio' using errcode = 'P0001';
  end if;

  v_cnpj := nullif(regexp_replace(coalesce(p_cnpj, ''), '\D', '', 'g'), '');
  if v_cnpj is not null and length(v_cnpj) <> 14 then
    raise exception 'cnpj_invalido' using errcode = 'P0001';
  end if;

  -- Reaproveita a organização sempre que dá para reconhecê-la, senão digitar
  -- "Tixpress" duas vezes cria duas empresas e o histórico do cliente se
  -- parte em dois. Pelo CNPJ quando há um (é único de verdade); pelo nome
  -- quando não há — a tela oferece as organizações existentes num datalist
  -- justamente para que o nome batendo seja o caso comum, não a exceção.
  --
  -- A busca por nome não exclui quem tem CNPJ: escolher "Tixpress" na lista
  -- sem redigitar o CNPJ tem de cair na Tixpress que já existe. Homônimas de
  -- verdade se separam pelo CNPJ, que é o campo para isso.
  if v_cnpj is not null then
    select id into v_organizacao_id from organizacoes where cnpj = v_cnpj;
  else
    select id into v_organizacao_id
      from organizacoes
     where lower(btrim(razao_social)) = lower(v_nome)
     order by criado_em asc
     limit 1;
  end if;

  if v_organizacao_id is null then
    insert into organizacoes (cnpj, razao_social, criado_por_email)
    values (v_cnpj, v_nome, p_membro_email)
    returning id into v_organizacao_id;
  end if;

  v_contato_nome := nullif(btrim(coalesce(p_contato_nome, '')), '');

  if v_contato_nome is not null then
    insert into contatos (
      organizacao_id, nome, email, telefone, principal, criado_por_email
    ) values (
      v_organizacao_id,
      v_contato_nome,
      nullif(btrim(coalesce(p_contato_email, '')), ''),
      nullif(btrim(coalesce(p_contato_telefone, '')), ''),
      -- Vira principal só se a organização ainda não tiver um: reusar uma
      -- organização existente não pode rebaixar o contato que já era.
      not exists (
        select 1 from contatos
         where organizacao_id = v_organizacao_id and principal
      ),
      p_membro_email
    )
    returning id into v_contato_id;
  else
    select id into v_contato_id
      from contatos
     where organizacao_id = v_organizacao_id and principal
     limit 1;
  end if;

  select id into v_etapa_inicial from etapas_funil where ativo order by ordem asc limit 1;
  if v_etapa_inicial is null then
    raise exception 'sem_etapa_inicial_configurada' using errcode = 'P0001';
  end if;

  insert into negocios (
    organizacao_id, contato_id, titulo, etapa_id, dono_email, valor,
    produto_servico_id, previsao_fechamento, origem, criado_por_email
  ) values (
    v_organizacao_id, v_contato_id, v_titulo, v_etapa_inicial, p_membro_email,
    p_valor, p_produto_servico_id, p_previsao_fechamento, 'avulso', p_membro_email
  )
  returning id into v_negocio_id;

  insert into negocio_etapa_historico (negocio_id, etapa_id, alterado_por_email)
  values (v_negocio_id, v_etapa_inicial, p_membro_email);

  return v_negocio_id;
end;
$$;

comment on function crm_criar_negocio_manual is 'Cria um negócio do zero a partir do quadro: organização (reaproveitada por CNPJ, ou por nome quando não há CNPJ), contato opcional e o negócio na primeira etapa ativa, tudo numa transação. Complementa crm_criar_negocio_avulso, que exige organização já existente.';

-- ----------------------------------------------------------------------------
-- Ids que faltavam na view — a ficha do negócio precisa deles para marcar a
-- opção corrente nos selects de edição. Colunas novas vão no fim, que é o que
-- `create or replace view` aceita sem recriar as dependências.
-- ----------------------------------------------------------------------------
create or replace view vw_quadro_negocios as
select
  n.id,
  n.titulo,
  n.etapa_id,
  n.status,
  n.valor,
  n.moeda,
  n.previsao_fechamento,
  n.criado_em,
  n.fechado_em,
  n.lead_origem_cnpj,
  n.organizacao_id,
  o.razao_social            as organizacao_nome,
  o.cnpj                    as organizacao_cnpj,
  n.contato_id,
  c.nome                    as contato_nome,
  c.cargo                   as contato_cargo,
  ps.nome                   as produto_servico,
  e.nome                    as etapa_nome,
  e.ordem                   as etapa_ordem,
  n.dono_email,
  coalesce(nullif(mp.nome, ''), n.dono_email) as dono_nome,
  mperda.nome               as motivo_perda,
  (n.status = 'aberto'
   and n.previsao_fechamento is not null
   and n.previsao_fechamento < current_date) as atrasado,
  n.produto_servico_id,
  n.motivo_perda_id,
  n.origem,
  n.criado_por_email,
  n.atualizado_em,
  c.email                   as contato_email,
  c.telefone                as contato_telefone,
  o.site                    as organizacao_site,
  o.cidade                  as organizacao_cidade,
  o.estado                  as organizacao_estado,
  o.setor                   as organizacao_setor,
  o.telefone                as organizacao_telefone
from negocios n
join organizacoes o        on o.id = n.organizacao_id
join etapas_funil e        on e.id = n.etapa_id
left join contatos c       on c.id = n.contato_id
left join produtos_servicos ps on ps.id = n.produto_servico_id
left join member_profiles mp   on mp.email = n.dono_email
left join motivos_perda mperda on mperda.id = n.motivo_perda_id;

alter view vw_quadro_negocios set (security_invoker = true);
