-- Esegui questo file nel SQL Editor di Supabase.
-- Le tabelle sono legate all'utente autenticato tramite user_id.

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  qty_g numeric not null default 0,
  avg_cost_per_g numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type text not null check (type in ('purchase','sale')),
  product_id uuid references public.products(id) on delete set null,
  client text,
  qty_g numeric not null default 0,
  total_amount numeric not null default 0,
  cash_received numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.credits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client text not null,
  product text,
  qty_g numeric not null default 0,
  total numeric not null default 0,
  paid numeric not null default 0,
  created_at timestamptz not null default now()
);

alter table public.products enable row level security;
alter table public.movements enable row level security;
alter table public.credits enable row level security;

create policy "own products select" on public.products for select using (auth.uid() = user_id);
create policy "own products insert" on public.products for insert with check (auth.uid() = user_id);
create policy "own products update" on public.products for update using (auth.uid() = user_id);
create policy "own products delete" on public.products for delete using (auth.uid() = user_id);

create policy "own movements select" on public.movements for select using (auth.uid() = user_id);
create policy "own movements insert" on public.movements for insert with check (auth.uid() = user_id);
create policy "own movements update" on public.movements for update using (auth.uid() = user_id);
create policy "own movements delete" on public.movements for delete using (auth.uid() = user_id);

create policy "own credits select" on public.credits for select using (auth.uid() = user_id);
create policy "own credits insert" on public.credits for insert with check (auth.uid() = user_id);
create policy "own credits update" on public.credits for update using (auth.uid() = user_id);
create policy "own credits delete" on public.credits for delete using (auth.uid() = user_id);
