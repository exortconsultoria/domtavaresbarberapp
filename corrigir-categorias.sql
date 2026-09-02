-- ════════════════════════════════════════════════════════════════
-- Categorias de despesa — correção combinada em 01/09/2026
--
-- Os custos fixos estavam com o NOME DO ESCOPO no lugar da categoria
-- ("Barbearia", "Pessoal"), então os lançamentos de setembro a dezembro
-- nasceriam sem categoria útil e o gráfico "Para onde vai o dinheiro"
-- não separaria nada.
--
-- Decisões do Tavares:
--   Ração Frida  → Pet (categoria nova)
--   Lavanderia   → despesa pessoal dele
--   Empréstimo   → é dele, não da barbearia (muda de escopo)
--   Água mineral → existe dos dois lados; a de R$66 é da barbearia
--
-- Nada é apagado. Rodar duas vezes não faz efeito nenhum (as condições
-- deixam de casar depois da primeira).
-- ════════════════════════════════════════════════════════════════

-- ─── 1. Antes: como está hoje ───
select 'custo fixo' as onde, nome as item, escopo, categoria, valor
  from custos_fixos
 where categoria in ('Barbearia','Pessoal','Outros')
union all
select 'lançamento', descricao, escopo, categoria, valor
  from financeiro
 where tipo = 'despesa'
   and (categoria in ('Aluguel / Moradia','Pessoal')
        or (descricao = 'Almoço'       and categoria = 'Outros')
        or (descricao = 'Lavanderia'   and categoria = 'Roupas')
        or (descricao = 'Empréstimo'   and categoria = 'Outros')
        or (descricao = 'Água mineral' and categoria = 'Água'))
 order by 1, 2;

-- ─── 2. Custos fixos: categoria de verdade no lugar do nome do escopo ───
update custos_fixos set categoria = 'Internet'     where nome = 'Internet ( Barbearia )';
update custos_fixos set categoria = 'Lavanderia'   where nome = 'Lavanderia (Toalhas)';
update custos_fixos set categoria = 'Água mineral' where nome = 'Água mineral';
update custos_fixos set categoria = 'Pensão'       where nome = 'Pensão de Théo';
update custos_fixos set categoria = 'Aluguel'      where nome = 'Aluguel ( ap )';
update custos_fixos set categoria = 'Internet'     where nome = 'Internet ( ap )';
-- o empréstimo é dele, não do negócio
update custos_fixos set categoria = 'Empréstimo', escopo = 'pessoal' where nome = 'Empréstimo';

-- ─── 3. Lançamentos já feitos ───
update financeiro set categoria = 'Aluguel'
 where tipo = 'despesa' and categoria = 'Aluguel / Moradia';
update financeiro set categoria = 'Almoço'
 where tipo = 'despesa' and descricao = 'Almoço' and categoria = 'Outros';
update financeiro set categoria = 'Mercado'
 where tipo = 'despesa' and descricao = 'Padaria' and categoria = 'Pessoal';
update financeiro set categoria = 'Pet'
 where tipo = 'despesa' and descricao = 'Ração Frida' and categoria = 'Pessoal';
update financeiro set categoria = 'Lavanderia'
 where tipo = 'despesa' and descricao = 'Lavanderia' and categoria = 'Roupas' and escopo = 'pessoal';
update financeiro set categoria = 'Empréstimo', escopo = 'pessoal'
 where tipo = 'despesa' and descricao = 'Empréstimo' and categoria = 'Outros';
update financeiro set categoria = 'Água mineral'
 where tipo = 'despesa' and descricao = 'Água mineral' and categoria = 'Água';

-- ─── 4. Depois: como fica o gráfico de cada lado ───
select escopo, categoria, sum(valor) as total
  from financeiro
 where tipo = 'despesa'
 group by escopo, categoria
 order by escopo, total desc;
