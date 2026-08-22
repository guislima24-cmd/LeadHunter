-- ============================================================================
-- CRM sobre a Lead Hunter — migração 006: CNPJ deixa de ser obrigatório em organizacoes
-- ============================================================================
-- Rodada entre aplicar 003/004 e ligar a nova gravação do W4 (007). A
-- especificação original define `organizacoes.cnpj` como `not null unique`,
-- mas isso torna impossível gravar uma organização capturada via LinkedIn
-- (W4): o payload da extensão só tem nome/cargo/URL do perfil, nunca CNPJ.
--
-- Seguro de aplicar porque `organizacoes` ainda não tinha nenhuma linha real
-- quando esta migração rodou (só as de teste, já removidas). A unicidade
-- continua valendo entre quem tem CNPJ preenchido — a mudança é só permitir
-- que também exista organização sem CNPJ.
--
-- n8n/sql/003_crm.sql já reflete o schema final (nullable) para quem for
-- rodar as migrações do zero num ambiente novo; este arquivo documenta o
-- ALTER que de fato rodou contra o banco de produção, nessa ordem.
-- ============================================================================

alter table organizacoes alter column cnpj drop not null;
alter table organizacoes drop constraint organizacoes_cnpj_key;
create unique index idx_organizacoes_cnpj_unico on organizacoes(cnpj) where cnpj is not null;
