# Dom Tavares — Gestão da Barbearia

App de gestão para a barbearia Dom Tavares: agenda, clientes, catálogo, financeiro
e disparo de mensagens no WhatsApp. Feito para uso no **celular**.

**No ar:** https://exortconsultoria.github.io/domtavaresbarberapp/

## Como funciona

Arquivo único (`index.html`) — HTML, CSS e JavaScript puro, sem build e sem dependências
além do SDK do Supabase (carregado por CDN).

- **Login:** Supabase Auth (usuário/senha).
- **Dados:** hoje ficam no `localStorage` do próprio aparelho. A migração para o
  Supabase está pendente — ver "Próximos passos".
- **Tema:** claro por padrão, com opção escura.

## Estrutura

| Arquivo | O que é |
|---|---|
| `index.html` | O app inteiro |
| `schema.sql` | Tabelas do Supabase (rodar no SQL Editor) |

## Telas

- **Visão Geral** — faturamento do mês, ticket médio, atendimentos do dia, meta.
- **Agenda** — visão por dia (padrão), semana ou lista. Concluir um atendimento lança
  a receita e credita pontos de fidelidade automaticamente.
- **Cadastros** — clientes, catálogo (serviços/pacotes/produtos), equipe e metas.
- **Financeiro** — receitas e despesas, comissões (quando houver equipe), projeções.
- **Mensagens** — filas de WhatsApp: confirmar hoje, aniversariantes, sumidos, todos.
  O WhatsApp não permite envio em massa por link, então o app monta a fila e marca
  quem já recebeu no dia; o envio é um a um.

## Próximos passos

1. **Fechar o cadastro público no Supabase** (Authentication → Providers → Email →
   desligar "Allow new users to sign up"). Sem isso, qualquer pessoa cria conta.
2. **Restringir o RLS** ao usuário dono, em vez de liberar para todo `authenticated`.
3. **Migrar os dados** do `localStorage` para o Supabase, gravando os campos de
   snapshot (`valor`, `comissao_pct`, `duracao_min`) na conclusão do atendimento.
# Relatório mensal em PDF

No **Financeiro**, toque em **Relatório do mês · PDF**. Escolha o mês e toque em **Baixar relatório em PDF**. A consulta abre em uma página separada e permite voltar ao financeiro.

O documento separa os lançamentos da barbearia e os pessoais de Tavares, com data, descrição, categoria, forma de pagamento, situação e valor. Despesas a pagar e entradas previstas ficam fora dos totais pagos/recebidos. A seleção usa a data do lançamento, não uma data de liquidação bancária. Meses anteriores são identificados como encerrados pelo calendário, sem afirmar que foram conciliados. O mês atual permanece em andamento.

Esta funcionalidade somente lê os dados disponíveis no aparelho; não altera o Supabase nem divide automaticamente as receitas. Um aviso acompanha o PDF quando há erro de sincronização ou falta de conexão. Os valores completos aparecem no PDF mesmo se estiverem ocultos no app.

Publicar juntos `index.html`, `relatorio.js`, `jspdf.umd.min.js` e `jspdf.plugin.autotable.min.js`. As bibliotecas de PDF são locais e mantêm seus avisos de licença. Não há SQL novo. Teste isolado com dados fictícios: `node test-relatorio.cjs`.
