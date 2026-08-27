-- ════════════════════════════════════════════════════════════════
-- RECUPERAÇÃO — receitas perdidas entre 14/08 e 26/08 de 2026
--
-- Causa: o app passou a gravar `financeiro.pago` antes de a coluna existir.
-- O agendamento subia (não tem esse campo), a receita era recusada e sumia.
--
-- Nada é apagado nem alterado. Só INSERE o que faltou, reconstruído a partir
-- do próprio agendamento (valor, forma de pagamento, cliente e data ficaram
-- salvos lá). O `where not exists` garante que rodar duas vezes não duplica.
--
-- ⚠️ Rode o schema.sql ANTES (a coluna `pago` precisa existir).
-- ════════════════════════════════════════════════════════════════

-- ─── 1. Confira antes de inserir: o que está faltando ───
--   (rode só este bloco primeiro e compare com o que o Tavares lembra)
select a.data, a.hora, c.nome as cliente, a.valor, a.forma_pag
  from agendamentos a
  left join clientes c on c.id = a.cliente_id
 where a.status = 'concluido'
   and a.forma_pag not in ('pacote','permuta')
   and coalesce(a.valor,0) > 0
   and not exists (select 1 from financeiro f
                    where f.agendamento_id = a.id and f.tipo = 'receita')
 order by a.data, a.hora;

-- ─── 2. Recria as receitas ───
insert into financeiro (data, tipo, categoria, descricao, valor, forma_pag, auto, escopo, pago, agendamento_id)
select a.data,
       'receita',
       -- se tudo que saiu foi produto, é venda; senão é atendimento
       case when not exists (
              select 1 from agendamento_servicos i
                join servicos s on s.id = i.servico_id
               where i.agendamento_id = a.id and s.tipo <> 'produto')
            and exists (select 1 from agendamento_servicos i where i.agendamento_id = a.id)
            then 'Produtos' else 'Atendimento' end,
       coalesce((select string_agg(s.nome, ', ' order by i.created_at)
                   from agendamento_servicos i
                   join servicos s on s.id = i.servico_id
                  where i.agendamento_id = a.id), 'Atendimento')
         || ' — ' || coalesce(c.nome, '—'),
       a.valor,
       a.forma_pag,
       true,
       'barbearia',
       true,
       a.id
  from agendamentos a
  left join clientes c on c.id = a.cliente_id
 where a.status = 'concluido'
   and a.forma_pag not in ('pacote','permuta')
   and coalesce(a.valor,0) > 0
   and not exists (select 1 from financeiro f
                    where f.agendamento_id = a.id and f.tipo = 'receita');

-- ─── 3. Recria as taxas de maquineta (crédito 3,09% / débito 0,98%) ───
insert into financeiro (data, tipo, categoria, descricao, valor, forma_pag, auto, escopo, pago, agendamento_id)
select a.data,
       'despesa',
       'Taxa de cartão',
       'Taxa ' || case a.forma_pag when 'credito' then 'Crédito' else 'Débito' end
         || ' (' || case a.forma_pag when 'credito' then '3,09' else '0,98' end || '%) — '
         || coalesce(c.nome, '—'),
       coalesce(a.taxa_maquineta,
                round(a.valor * case a.forma_pag when 'credito' then 0.0309 else 0.0098 end, 2)),
       a.forma_pag,
       true,
       'barbearia',
       true,
       a.id
  from agendamentos a
  left join clientes c on c.id = a.cliente_id
 where a.status = 'concluido'
   and a.forma_pag in ('credito','debito')
   and coalesce(a.valor,0) > 0
   and not exists (select 1 from financeiro f
                    where f.agendamento_id = a.id
                      and f.tipo = 'despesa' and f.categoria = 'Taxa de cartão');

-- ─── 4. Confira o resultado: faturamento por mês ───
select to_char(data,'YYYY-MM') as mes,
       sum(valor) filter (where tipo = 'receita')                              as receita,
       sum(valor) filter (where tipo = 'despesa' and categoria = 'Taxa de cartão') as taxas
  from financeiro
 group by 1 order by 1;
