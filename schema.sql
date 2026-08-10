-- ════════════════════════════════════════════════════════════════
-- Dom Tavares — schema do Supabase
-- Espelha o shape de dados do dom-tavares.html (ver seed()/blankDB()).
-- Seguro rodar mais de uma vez: tudo usa IF NOT EXISTS, nada é dropado.
-- ════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ─────────── profissionais ───────────
create table if not exists profissionais (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  apelido    text not null,
  comissao   numeric(5,2) not null default 0,   -- % sobre o serviço, ex.: 40.00
  cor        text not null default '#2f6fb0',   -- cor na agenda
  ativo      boolean not null default true,
  tel        text,
  created_at timestamptz not null default now()
);

-- ─────────── serviços / pacotes / produtos ───────────
create table if not exists servicos (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  tipo       text not null check (tipo in ('servico','pacote','produto')),
  preco      numeric(10,2) not null default 0,
  duracao    integer not null default 0,        -- minutos; 0 para produto
  estoque    integer,                            -- só usado quando tipo = 'produto'
  ativo      boolean not null default true,
  created_at timestamptz not null default now()
);

-- ─────────── clientes ───────────
create table if not exists clientes (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  tel        text,
  email      text,
  nasc       date,
  pontos     integer not null default 0,        -- fidelidade
  obs        text,
  cadastro   date not null default current_date,
  created_at timestamptz not null default now()
);

-- ─────────── agendamentos ───────────
create table if not exists agendamentos (
  id               uuid primary key default gen_random_uuid(),
  cliente_id       uuid references clientes(id) on delete restrict,
  servico_id       uuid references servicos(id) on delete restrict,
  profissional_id  uuid references profissionais(id) on delete restrict,
  data             date not null,
  hora             time not null,
  status           text not null default 'agendado'
                     check (status in ('agendado','confirmado','concluido','cancelado','faltou')),
  obs              text,
  forma_pag        text check (forma_pag in ('pix','dinheiro','cartao','pacote','boleto','permuta')),
  -- snapshot gravado na conclusão (evita recalcular o histórico se preço/comissão mudar depois)
  valor            numeric(10,2),
  comissao_pct     numeric(5,2),
  duracao_min      integer,
  concluida_em     timestamptz,
  created_at       timestamptz not null default now()
);
create index if not exists idx_agendamentos_data on agendamentos (data);
create index if not exists idx_agendamentos_cliente on agendamentos (cliente_id);
create index if not exists idx_agendamentos_profissional on agendamentos (profissional_id);

-- ─────────── financeiro (receitas e despesas) ───────────
create table if not exists financeiro (
  id             uuid primary key default gen_random_uuid(),
  data           date not null,
  tipo           text not null check (tipo in ('receita','despesa')),
  categoria      text not null default 'Geral',
  descricao      text not null,
  valor          numeric(10,2) not null,
  forma_pag      text check (forma_pag in ('pix','dinheiro','cartao','pacote','boleto','permuta')),
  auto           boolean not null default false,   -- true = gerado pela conclusão de um atendimento
  agendamento_id uuid references agendamentos(id) on delete cascade,
  created_at     timestamptz not null default now()
);
create index if not exists idx_financeiro_data on financeiro (data);

-- ─────────── metas de faturamento por mês ───────────
create table if not exists metas (
  id         uuid primary key default gen_random_uuid(),
  mes        text not null unique check (mes ~ '^\d{4}-\d{2}$'),  -- 'YYYY-MM'
  valor      numeric(10,2) not null,
  created_at timestamptz not null default now()
);

-- ─────────── custos fixos (recorrentes todo mês) ───────────
create table if not exists custos_fixos (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  categoria  text not null default 'Geral',
  valor      numeric(10,2) not null,
  dia_venc   integer not null default 5 check (dia_venc between 1 and 31),
  ativo      boolean not null default true,
  created_at timestamptz not null default now()
);
-- liga o lançamento gerado ao custo fixo que o originou (evita lançar 2x no mesmo mês)
alter table financeiro add column if not exists custo_fixo_id uuid references custos_fixos(id) on delete set null;

-- ─────────── log de disparos de WhatsApp ───────────
create table if not exists mensagens_enviadas (
  id         uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id) on delete cascade,
  segmento   text not null check (segmento in ('confirmar','aniversario','retorno','todos')),
  data       date not null,
  created_at timestamptz not null default now(),
  unique (cliente_id, segmento, data)             -- evita registrar o mesmo disparo duas vezes no dia
);

-- ─────────── configurações (linha única) ───────────
create table if not exists configuracoes (
  id              boolean primary key default true,
  constraint configuracoes_singleton check (id),  -- garante que só existe 1 linha
  nome_usuario    text not null default 'Tavares',
  nome_barbearia  text not null default 'Dom Tavares',
  abertura        time not null default '09:00',
  fechamento      time not null default '20:00',
  inativo_dias    integer not null default 45,
  pontos_por_corte  integer not null default 1,
  pontos_resgate    integer not null default 10,
  updated_at      timestamptz not null default now()
);
insert into configuracoes (id) values (true) on conflict (id) do nothing;

-- ════════════════════════════════════════════════════════════════
-- RLS — o app vai pro GitHub Pages, ou seja, público na internet.
-- A chave "anon" do Supabase fica visível no HTML de qualquer visitante.
-- Por isso: RLS travado para authenticated, nada liberado para anon.
-- Isso exige login (Supabase Auth) no app antes de ir ao ar — ver nota abaixo.
-- ════════════════════════════════════════════════════════════════
alter table custos_fixos        enable row level security;
alter table profissionais       enable row level security;
alter table servicos            enable row level security;
alter table clientes            enable row level security;
alter table agendamentos        enable row level security;
alter table financeiro          enable row level security;
alter table metas               enable row level security;
alter table mensagens_enviadas  enable row level security;
alter table configuracoes       enable row level security;

do $$
declare t text;
begin
  for t in select unnest(array[
    'profissionais','servicos','clientes','agendamentos',
    'financeiro','metas','mensagens_enviadas','configuracoes','custos_fixos'
  ]) loop
    if not exists (
      select 1 from pg_policies where tablename = t and policyname = 'somente_dono'
    ) then
      execute format(
        'create policy somente_dono on %I for all to authenticated using (true) with check (true)', t
      );
    end if;
  end loop;
end $$;
