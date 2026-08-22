-- ============================================================================
-- CRM sobre a Lead Hunter — migração 007: view que alimenta o kanban
-- ============================================================================
-- Alimenta o quadro de negócios (`/pipeline`) e o selo de "negócio" na lista
-- de leads.
--
-- Existe para a aplicação não depender de join embedado do PostgREST
-- (`negocios(organizacoes(razao_social), contatos(nome))`): o formato que o
-- PostgREST devolve num embed varia com a cardinalidade que ele infere
-- (objeto vs array), e o ambiente de desenvolvimento não alcança a API REST
-- para verificar qual dos dois viria. Em SQL o contrato é explícito, e dá
-- para testar a consulta de verdade antes de subir.
--
-- `security_invoker` pelo mesmo motivo das views de funil (005): sem isso a
-- view roda com o papel do dono e ignora a RLS das tabelas de baixo.
-- ============================================================================

create view vw_quadro_negocios as
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
  -- Membro sem `nome` preenchido cai no e-mail em vez de virar célula vazia.
  coalesce(nullif(mp.nome, ''), n.dono_email) as dono_nome,
  mperda.nome               as motivo_perda,
  (n.status = 'aberto'
   and n.previsao_fechamento is not null
   and n.previsao_fechamento < current_date) as atrasado
from negocios n
join organizacoes o        on o.id = n.organizacao_id
join etapas_funil e        on e.id = n.etapa_id
left join contatos c       on c.id = n.contato_id
left join produtos_servicos ps on ps.id = n.produto_servico_id
left join member_profiles mp   on mp.email = n.dono_email
left join motivos_perda mperda on mperda.id = n.motivo_perda_id;

alter view vw_quadro_negocios set (security_invoker = true);
