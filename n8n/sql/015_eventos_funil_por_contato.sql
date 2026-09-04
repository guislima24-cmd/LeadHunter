-- ============================================================================
-- 015 — Eventos do funil de prospecção também por contato (canal LinkedIn)
--
-- `funil_prospeccao_eventos` nasceu chaveada por `lead_cnpj` porque o único
-- caminho previsto era o email: o W3 dispara para um lead da base da Receita
-- Federal, que tem CNPJ, e um botão na tela do lead marcava aceite/resposta
-- à mão.
--
-- A extensão do Chrome muda isso. Ela detecta, no LinkedIn, quando alguém
-- aceita a conexão (`acceptance-detector.js`) e quando alguém responde a
-- mensagem (`reply-detector.js`) — automaticamente, sem ninguém marcar nada.
-- Só que o que ela conhece é uma **pessoa**: nome e URL de perfil. Muitas
-- vezes a empresa por trás nem tem CNPJ no CRM, porque foi cadastrada pela
-- própria captura do LinkedIn, que não tem de onde tirar CNPJ.
--
-- Então o evento passa a poder referenciar um contato em vez de um lead. Um
-- dos dois, nunca nenhum.
-- ============================================================================

alter table funil_prospeccao_eventos
  alter column lead_cnpj drop not null;

alter table funil_prospeccao_eventos
  add column contato_id uuid references contatos(id) on delete cascade,
  add column canal text not null default 'email'
    check (canal in ('email', 'linkedin'));

comment on column funil_prospeccao_eventos.contato_id is
  'Preenchido quando o evento veio do LinkedIn (extensão), onde o que se conhece é a pessoa e não o CNPJ da empresa.';
comment on column funil_prospeccao_eventos.canal is
  'Por onde a prospecção aconteceu. Existe para o painel poder dizer que aceite por email e aceite por LinkedIn não são a mesma medida.';

-- Um evento tem de apontar para alguma coisa.
alter table funil_prospeccao_eventos
  add constraint evento_precisa_de_alvo
  check (lead_cnpj is not null or contato_id is not null);

-- ----------------------------------------------------------------------------
-- Deduplicação
--
-- O índice antigo era `unique (lead_cnpj, tipo_evento)`. Com `lead_cnpj`
-- agora anulável ele deixaria de servir para o LinkedIn — em Postgres, NULLs
-- não colidem entre si num índice único, então dois aceites do mesmo contato
-- (ambos com cnpj nulo) passariam os dois. E os detectores rodam a cada 30
-- segundos, varrendo a mesma tela: sem deduplicação no banco, uma tarde com
-- o LinkedIn aberto inflaria a taxa de aceite do mês em dezenas de vezes.
--
-- Daí dois índices parciais, um para cada forma de identificar o alvo.
-- ----------------------------------------------------------------------------
drop index if exists idx_funil_eventos_unico;

create unique index idx_funil_eventos_unico_lead
  on funil_prospeccao_eventos(lead_cnpj, tipo_evento)
  where lead_cnpj is not null;

create unique index idx_funil_eventos_unico_contato
  on funil_prospeccao_eventos(contato_id, tipo_evento)
  where contato_id is not null;

create index idx_funil_eventos_contato on funil_prospeccao_eventos(contato_id)
  where contato_id is not null;
