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
