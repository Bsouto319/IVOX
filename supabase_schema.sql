-- iVox — Schema Supabase

-- Tabela de usuários (espelha auth.users)
create table public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  name        text default '',
  credits     int  not null default 0,
  created_at  timestamptz default now()
);

-- Contatos salvos por usuário
create table public.contacts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  name       text not null,
  phone      text not null,
  created_at timestamptz default now(),
  unique(user_id, phone)
);

-- Histórico de ligações
create table public.call_logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  phone         text not null,
  transcription text default '',
  translation   text default '',
  call_sid      text default '',
  credits_used  int  not null default 1,
  created_at    timestamptz default now()
);

-- RLS
alter table public.users    enable row level security;
alter table public.contacts enable row level security;
alter table public.call_logs enable row level security;

create policy "users own data"     on public.users     for all using (auth.uid() = id);
create policy "contacts own data"  on public.contacts  for all using (auth.uid() = user_id);
create policy "call_logs own data" on public.call_logs for all using (auth.uid() = user_id);

-- Função: desconta 1 crédito (atômica)
create or replace function deduct_credit(user_id uuid)
returns void language plpgsql security definer as $$
begin
  update public.users set credits = credits - 1
  where id = user_id and credits > 0;
  if not found then
    raise exception 'insufficient_credits';
  end if;
end;
$$;

-- Função: adiciona créditos
create or replace function add_credits(user_id uuid, amount int)
returns void language plpgsql security definer as $$
begin
  update public.users set credits = credits + amount where id = user_id;
end;
$$;
