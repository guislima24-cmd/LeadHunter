-- ============================================================================
-- CRM sobre a Lead Hunter — migração 016: captura do LinkedIn sem n8n
-- ============================================================================
-- O upsert em `organizacoes`/`contatos` a partir de uma captura da extensão
-- vivia dentro do workflow W4 do n8n (nó "Gravar Organizacao e Contato no
-- CRM"), não em código deste repositório — o trial do n8n Cloud expirou e os
-- workflows ficaram pausados, então essa lógica precisa existir aqui para a
-- extensão voltar a funcionar sem depender do n8n.
--
-- Mesma forma de `crm_criar_negocio_manual` (008): uma captura do LinkedIn
-- não traz CNPJ, só o nome da empresa, então a organização é reaproveitada
-- por nome. O contato é dedupe por `linkedin_url` quando presente — já existe
-- um índice único parcial em `idx_contatos_linkedin_url` para isso — e por
-- nome dentro da organização quando não há URL.
-- ============================================================================

create or replace function crm_registrar_captura_linkedin(
  p_membro_email text,
  p_nome text,
  p_empresa text,
  p_cargo text default null,
  p_linkedin_url text default null
)
returns table(organizacao_id uuid, contato_id uuid)
language plpgsql
set search_path = public
as $$
declare
  v_nome text;
  v_empresa text;
  v_cargo text;
  v_linkedin text;
  v_organizacao_id uuid;
  v_contato_id uuid;
begin
  v_nome := nullif(btrim(coalesce(p_nome, '')), '');
  v_empresa := nullif(btrim(coalesce(p_empresa, '')), '');
  v_cargo := nullif(btrim(coalesce(p_cargo, '')), '');
  v_linkedin := nullif(btrim(coalesce(p_linkedin_url, '')), '');

  if v_nome is null then
    raise exception 'nome_obrigatorio' using errcode = 'P0001';
  end if;
  if v_empresa is null then
    raise exception 'empresa_obrigatoria' using errcode = 'P0001';
  end if;

  select id into v_organizacao_id
    from organizacoes
   where lower(btrim(razao_social)) = lower(v_empresa)
   order by criado_em asc
   limit 1;

  if v_organizacao_id is null then
    insert into organizacoes (razao_social, criado_por_email)
    values (v_empresa, p_membro_email)
    returning id into v_organizacao_id;
  end if;

  if v_linkedin is not null then
    select id into v_contato_id from contatos where linkedin_url = v_linkedin;
  end if;

  if v_contato_id is null then
    select id into v_contato_id
      from contatos
     where contatos.organizacao_id = v_organizacao_id
       and lower(btrim(nome)) = lower(v_nome)
     limit 1;
  end if;

  if v_contato_id is null then
    insert into contatos (
      organizacao_id, nome, cargo, linkedin_url, principal, criado_por_email
    ) values (
      v_organizacao_id, v_nome, v_cargo, v_linkedin,
      not exists (
        select 1 from contatos
         where contatos.organizacao_id = v_organizacao_id and principal
      ),
      p_membro_email
    )
    returning id into v_contato_id;
  else
    -- Recaptura da mesma pessoa: só preenche o que ainda estava vazio, nunca
    -- apaga um cargo ou uma URL que outra captura já tinha resolvido.
    update contatos
       set cargo = coalesce(cargo, v_cargo),
           linkedin_url = coalesce(linkedin_url, v_linkedin),
           atualizado_em = now()
     where id = v_contato_id;
  end if;

  return query select v_organizacao_id, v_contato_id;
end;
$$;

comment on function crm_registrar_captura_linkedin is 'Upsert de organização e contato a partir de uma captura de perfil do LinkedIn pela extensão do Chrome — dedupe por razão social (sem CNPJ) e por linkedin_url. Substitui o nó equivalente que vivia no W4 do n8n; chamado direto por app/api/extensao/prospeccao.';
