# Dom Tavares — ERP de Barbearia · Handoff Técnico

> Documento de continuidade para retomar o projeto no **Claude Code**.
> Entregável atual: `dom-tavares.html` (arquivo único, autocontido).
> Última iteração: reconstrução no formato do app "Gestão de Demandas Estratégicas" (janela `.appwin` + sidebar + chrome + cartões `.m3d` + drawers laterais), tema brass/dark.

---

## 1. Visão geral

ERP de gestão para a barbearia **Dom Tavares**. Aplicação **single-file HTML** (HTML + CSS + JS vanilla, sem build, sem framework), com dados persistidos em `localStorage` e fallback em memória. Pensado como protótipo funcional que deve evoluir para **Supabase** mantendo o mesmo shape de dados.

**Público/uso:** dono + recepção da barbearia. Foco em operação diária (agenda), cadastro e visão financeira.

**Idioma da UI e do código:** português (BR).

---

## 2. Stack e decisões de arquitetura

| Decisão | Escolha | Motivo |
|---|---|---|
| Estrutura | 1 arquivo `.html` | Pedido do cliente ("inicialmente só um html"); zero setup |
| JS | Vanilla, sem framework | Lean; sem build step |
| Persistência | `localStorage` com fallback em memória (`Store`) | Protótipo local; não quebra no preview do chat |
| Fontes | Stack neutra do sistema (sem dependência externa) | Legibilidade e zero download |
| Tema | Light (default) + Dark, toggle salvo em `localStorage` | Preferência do dono |
| Backend | Supabase (auth pronta; dados ainda locais) | Mesma stack dos outros projetos do João |

**Importante:** o app é mobile-first — o dono usa só o celular. A paleta é neutra (cinza/azul);
não há identidade visual de terceiros no produto.

---

## 3. Layout do arquivo (`dom-tavares.html`)

```
<head>
  <link> Google Fonts (Playfair Display, Barlow, Barlow Semi Condensed)
  <style> ... tokens + componentes (ver seção 6)
<body>
  .appwin
    ├─ aside.app-sidebar   → logo, nav (#nav gerado por JS), botão Config
    └─ .app-main-col
        ├─ header.chrome   → título, sync-chip, filtros, tema, fullscreen, "Agendar"
        └─ main#main       → conteúdo renderizado por view
  .fab-stack               → FAB dourado "novo agendamento"
  #drawer                  → drawer lateral (formulários/detalhes)
  #cmodal                  → modal central (Configurações)
  #toast
  <script> ... toda a lógica
```

---

## 4. Modelo de dados

Objeto global `db`, serializado em `localStorage["domtavares_db"]`. Campo `_upd` = timestamp da última gravação.

```js
db = {
  profissionais: [{
    id, nome, apelido, comissao /* number %, ex 40 */, cor /* hex */, ativo /* bool */, tel
  }],
  servicos: [{
    id, nome, tipo /* 'servico' | 'pacote' | 'produto' */,
    preco /* number */, duracao /* min; 0 p/ produto */, ativo,
    estoque /* number; só quando tipo === 'produto' */
  }],
  clientes: [{
    id, nome, tel, email, nasc /* 'YYYY-MM-DD' */,
    pontos /* number, fidelidade */, obs, cadastro /* 'YYYY-MM-DD' */
  }],
  agendamentos: [{
    id, clienteId, servicoId, profissionalId,
    data /* 'YYYY-MM-DD' */, hora /* 'HH:MM' */,
    status /* 'agendado'|'confirmado'|'concluido'|'cancelado'|'faltou' */,
    obs, formaPag /* 'pix'|'dinheiro'|'cartao'|'pacote' | null */
  }],
  financeiro: [{
    id, data, tipo /* 'receita' | 'despesa' */, categoria, descricao,
    valor /* number */, formaPag /* 'pix'|'dinheiro'|'cartao'|'boleto' | null */,
    auto /* bool: true = gerado por atendimento concluído */,
    agendamentoId /* presente quando auto */
  }],
  metas: [{ id, mes /* 'YYYY-MM' */, valor /* number */ }],
  config: {
    abertura /* 'HH:MM' */, fechamento /* 'HH:MM' */,
    inativoDias /* number */, pontosPorCorte /* number */, pontosResgate /* number */
  },
  _upd /* timestamp */
}
```

**IDs:** strings curtas via `uid()` (`Math.random().toString(36)`). No seed, ids fixos (`p1`, `s1`, `c1`, `m1`) pra facilitar leitura.

**Datas:** sempre string ISO local (`YYYY-MM-DD`) via `isoOf()`/`todayISO()` — nunca `toISOString()` (evita bug de fuso). Horas em `HH:MM`.

---

## 5. Módulos / features implementadas

**Visão Geral (`renderPainel`)** — saudação + manchete dinâmica; cartão de comando (agendamentos de hoje → abrir agenda); 4 KPIs `.m3d` (faturamento, ticket médio, hoje, comissões a pagar); barra de meta; próximos agendamentos; serviços mais realizados; "Lembrar hoje" (não confirmados, com WhatsApp); "Recuperar clientes" (inativos); aniversariantes do mês.

**Agenda (`renderAgenda`)** — duas views: **Calendário** (grade semanal por hora, blocos coloridos por profissional, clique em slot vazio cria, clique no bloco abre detalhe) e **Listagem**. Filtro por profissional (dropdown + painel de filtros no chrome). Navegação de semana. Detalhe do agendamento com ações: **Confirmar / Faltou / Concluir / Cancelar / Excluir** + botão **WhatsApp** com mensagem pré-preenchida (`wa.me`).

**Concluir atendimento (`concluir`)** — automação central: marca `concluido`, gera lançamento de **receita** (`auto:true`), credita **pontos de fidelidade** e avisa se atingiu resgate. (A comissão é calculada on-the-fly, não gravada.)

**Clientes (`renderClientes`)** — busca por nome/telefone; tabela com fidelidade (●) e última visita; detalhe com histórico, total gasto, pontos; CRUD; WhatsApp.

**Serviços & Produtos (`renderServicos`)** — abas Serviços / Pacotes / Produtos; produtos têm estoque (com alerta ≤3); CRUD.

**Profissionais (`renderProfissionais`)** — cartões `.m3d` com % de comissão, atendimentos do mês, faturamento gerado e **comissão a pagar**; cor na agenda; CRUD.

**Financeiro (`renderFinanceiro`)** — abas:
- *Receitas & Despesas*: KPIs + lançamentos com forma de pagamento (lançamentos `auto` marcados).
- *Comissões*: fecha total a pagar por profissional no mês.
- *Projeções*: realizado + agenda confirmada vs meta; projeção por ritmo diário; lucro projetado.
- *Metas*: meta de faturamento por mês, com progresso.

**Configurações (`openConfig`)** — horário de funcionamento, regras de fidelidade, dias p/ inativo, export/import JSON e restaurar exemplo.

---

## 6. Design system (tokens principais)

Definidos em `:root` e `body.light`. **Não introduzir cores fora destes tokens.**

```
--bg #100d09  --surface #181410  --surface-2 #201b14  --surface-3 #2a2318
--border #332a1c  --text #ece3d2  --text-dim #9a8f7c  --text-mute #665e4e
--accent #c79a3e (brass)  --accent-bright #e3ba5b  --accent-soft rgba(199,154,62,.14)
--oxblood #8a352f (secundária)
status: --st-pend / --st-wait / --st-late / --st-done   (+ *-soft)
semânticos: --green (ok) / --red (perigo) / --blue / --yellow
fontes: --font-display Playfair · --font-body Barlow · --font-cond Barlow Semi Condensed
```

**Componentes reutilizáveis:** `.m3d` (cartão KPI com tilt), `.p-block` (painel), `.li` (linha de lista), `.st-row` (barra), `.tag.st-*` (status), `.avatar`, `.view-seg`/`.mtab` (segmentos/abas), `.tbl-wrap` (tabela), `.cal*` (calendário), `.overlay.drawer`/`.overlay.center` (drawer/modal), `.fab-btn`, `.toast`.

---

## 7. Mapa do código (funções-chave)

```
Persistência : Store (IIFE resiliente), loadDB, saveDB
Helpers      : uid, money/BRL, isoOf/todayISO/parseISO, fmtDate/fmtDateLong,
               monthKey/curMonthKey, hhmmToMin/minToHHMM, initials, esc, waBtn, toast
Estado       : db, getCli/getProf/getSrv, seed()
Navegação    : VIEWS[], buildNav, switchTab, render (dispatcher), updateBadges
Métricas     : metrics(), clientesInativos()
Views        : renderPainel, renderAgenda(+calGrid, agLista), renderClientes,
               renderServicos, renderProfissionais, renderFinanceiro
               (+ finMov, finComissoes, finProj, finMetas)
Ações        : openApptForm/openApptDetail/setStatus/concluir,
               openClienteForm/Detail, openServicoForm, openProfForm,
               openFinForm/delFin, openMetaForm, openConfig/salvarConfig
UI infra     : openDrawer/closeDrawer, openConfig(modal central),
               toggleTheme/applyTheme, toggleFullscreen, toggleSidebar,
               toggleFiltros, updateSyncChip
Boot         : boot() → loadDB, applyTheme, buildNav, switchTab('painel')
```

**Convenções:**
- Toda mutação chama `saveDB()` e depois `render()`.
- Formulários e detalhes de entidade abrem no **drawer** (`openDrawer(title, htmlBody, actions[])`); só Configurações usa modal central.
- `render()` é o dispatcher por `activeTab`; cada view escreve em `#main`.
- Textos vindos de dados sempre passam por `esc()`.

---

## 8. Limitações conhecidas (candidatas a corrigir)

- **Sem checagem de conflito de horário** (mesmo profissional, mesmo slot pode duplicar).
- **Sem bloqueio de horários** (folga/almoço do barbeiro).
- **Comissão não versionada:** se o `%` do profissional mudar, recalcula histórico retroativo (calculada on-the-fly).
- **Estoque de produto não dá baixa** automática ao vender.
- **Pacote não controla saldo** de cortes consumidos.
- **Projeção linear** (média diária) — não considera sazonalidade por dia da semana.
- `localStorage` **não persiste no preview do chat**; só ao abrir o arquivo baixado.
- Sem auth / multiusuário / multi-unidade.

---

## 9. Próximos passos sugeridos (roadmap)

**Prioridade alta**
1. **Fechamento de caixa diário** por forma de pagamento (PIX/cartão/dinheiro) — fecha o dia e concilia.
2. **Conflito de agenda:** validar sobreposição por profissional ao criar/editar agendamento.
3. **Baixa de estoque** ao concluir venda de produto; alerta de reposição.

**Prioridade média**
4. **Faturamento por dia da semana** (sazonalidade) → substituir a projeção linear por uma ponderada (sábado ≠ terça).
5. **Bloqueio de horários** (folga, almoço, feriado) no calendário.
6. **Saldo de pacotes** (ex.: "Pacote Mensal 4 cortes" → debita a cada uso).

**Migração para Supabase** (seguir o padrão do app de demandas do João: client + RLS + upsert)
7. Criar tabelas espelhando o `seed()`: `profissionais`, `servicos`, `clientes`, `agendamentos`, `financeiro`, `metas`, `config`.
8. Trocar `Store`/`localStorage` por `sb.from(...)` mantendo o mesmo shape (as funções `getCli/getProf/getSrv` e `db.*` isolam bem esse acоplamento).
9. Auth simples (dono/recepção) + RLS por unidade se virar multi-loja.

---

## 10. Como rodar / retomar

- Abrir `dom-tavares.html` no navegador (dados salvam em `localStorage`).
- **Resetar** para dados de exemplo: Configurações → "Restaurar exemplo".
- **Backup/restore:** Configurações → Exportar/Importar JSON.
- Dados de exemplo (seed): 3 profissionais (Dom 0%, Rafa 40%, Léo 45%), 6 serviços + 1 pacote + 2 produtos, 6 clientes, ~10 agendamentos na semana corrente, lançamentos financeiros e meta do mês (R$ 12.000).

---

### Notas de estilo para quem continuar
- Manter **single-file** até a migração; não adicionar dependências além das fontes.
- Respeitar os **tokens** de cor e os componentes existentes (`.m3d`, `.p-block`, `.tag.st-*`, drawer).
- UI e mensagens em **português**; valores em BRL via `money()`.
- Preferir evoluir o **shape de dados** já pensando nas tabelas do Supabase.
