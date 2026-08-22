-- ============================================================================
-- CRM sobre a Lead Hunter — migração 005: correções apontadas pelo advisor
-- ============================================================================
-- Rodadas logo após aplicar 003/004. O advisor de segurança do Supabase
-- (mcp__Supabase__get_advisors) sinalizou 4 ERROR e 6 WARN reais; o resto
-- (57 WARN de "tabela visível no schema GraphQL para anon/authenticated") é
-- o mesmo padrão que já existe em toda tabela do projeto — grant de SELECT
-- por privilégio default do schema `public`, mitigado pela RLS aplicada em
-- 003, não algo que esta migração precisasse mudar.
-- ============================================================================

-- 1) ERROR — as 4 views de funil (003) foram criadas por um papel
--    privilegiado e por padrão herdam o dono como executor, então ignoravam
--    a RLS das tabelas de baixo (negocios/etapas_funil) para qualquer papel
--    que consultasse a view, inclusive anon. security_invoker faz a view
--    rodar com o papel de quem consulta, voltando a respeitar a RLS.
alter view vw_funil_resumo set (security_invoker = true);
alter view vw_funil_tempo_medio_etapa set (security_invoker = true);
alter view vw_funil_conversao set (security_invoker = true);
alter view vw_negocios_atrasados set (security_invoker = true);

-- 2) WARN — is_membro_ufabcjr() só lê o JWT (nenhuma tabela), não precisa de
--    privilégio elevado. is_admin_ufabcjr() lê member_profiles, mas a RLS de
--    member_profiles já libera leitura para quem é do domínio — não depende
--    de bypass. SECURITY INVOKER nos dois remove o alerta de "SECURITY
--    DEFINER executável por anon" sem mudar o resultado de nenhuma chamada.
alter function is_membro_ufabcjr() security invoker;
alter function is_admin_ufabcjr() security invoker;

-- 3) WARN — search_path mutável nas 4 funções transacionais (004).
alter function crm_promover_lead(text, text, text) set search_path = public;
alter function crm_criar_negocio_avulso(uuid, text, text, uuid, uuid, numeric, date) set search_path = public;
alter function crm_mover_etapa(uuid, uuid, text) set search_path = public;
alter function crm_fechar_negocio(uuid, text, text, uuid) set search_path = public;
