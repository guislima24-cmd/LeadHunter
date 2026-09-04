-- ============================================================================
-- 014 — Token de acesso da extensão do Chrome
--
-- A extensão roda no navegador do membro, fora do domínio do CRM, e o service
-- worker dela não tem acesso ao cookie de sessão do Supabase. Precisa de uma
-- credencial própria.
--
-- Formato: o segredo é gerado na aplicação e mostrado **uma vez**; aqui fica
-- só o SHA-256 dele. Se este banco vazar, ninguém consegue se passar por
-- membro nenhum — mesmo motivo pelo qual senha não se guarda em texto claro.
-- (SHA-256 sem sal e sem alongamento é adequado *neste* caso porque o segredo
-- tem 256 bits de entropia aleatória: não há dicionário nem força bruta que
-- alcance. Isso não valeria para uma senha escolhida por gente.)
-- ============================================================================

create table extensao_tokens (
  id uuid primary key default gen_random_uuid(),
  membro_email text not null references member_profiles(email) on delete cascade,
  -- SHA-256 do segredo, em hexadecimal.
  token_hash text not null unique,
  -- Os primeiros caracteres do segredo, para a pessoa reconhecer qual token é
  -- qual na lista sem que isso ajude a reconstruí-lo.
  prefixo text not null,
  nome_dispositivo text,
  criado_em timestamptz not null default now(),
  ultimo_uso_em timestamptz,
  revogado_em timestamptz
);

comment on table extensao_tokens is
  'Credencial da extensão do Chrome. Guarda só o hash — o segredo é mostrado uma vez, na criação.';

create index idx_extensao_tokens_membro on extensao_tokens(membro_email)
  where revogado_em is null;

-- ----------------------------------------------------------------------------
-- Resolver o token → membro
--
-- Função em vez de consulta solta porque ela faz três coisas que precisam
-- andar juntas: valida, recusa revogado, e carimba o último uso (que é o que
-- permite a alguém olhar a lista e perceber um token que não usa há meses).
--
-- Recebe o hash já calculado, nunca o segredo: assim o valor em claro não
-- aparece em `pg_stat_statements` nem no log de consultas lentas.
-- ----------------------------------------------------------------------------
create or replace function resolver_token_extensao(p_token_hash text)
returns table (membro_email text, aba_planilha text, nome text)
language plpgsql
volatile
set search_path to 'public'
as $$
declare
  v_email text;
begin
  select t.membro_email into v_email
    from extensao_tokens t
   where t.token_hash = p_token_hash
     and t.revogado_em is null;

  if v_email is null then
    return;
  end if;

  update extensao_tokens set ultimo_uso_em = now()
   where token_hash = p_token_hash;

  return query
    select m.email, m.aba_planilha, m.nome
      from member_profiles m
     where m.email = v_email
       and m.ativo;
end;
$$;

comment on function resolver_token_extensao is
  'Troca o hash de um token de extensão pelo membro dono, carimbando o último uso. Devolve zero linhas se o token não existe, foi revogado, ou o membro está inativo.';

-- ----------------------------------------------------------------------------
-- RLS
--
-- Nenhuma policy de leitura: diferente do resto do CRM, esta tabela não é
-- "dado do time que todo membro pode ver". Um token, mesmo em hash, é
-- credencial — só a aplicação, pela chave de service role, a toca.
-- ----------------------------------------------------------------------------
alter table extensao_tokens enable row level security;
