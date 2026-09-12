-- POKER V2 - ESEGUI UNA SOLA VOLTA NEL SQL EDITOR DI SUPABASE

alter table public.movements
  add column if not exists reversed boolean not null default false,
  add column if not exists reversed_at timestamptz,
  add column if not exists credit_id uuid references public.credits(id) on delete set null,
  add column if not exists previous_avg_cost numeric;

alter table public.credits
  add column if not exists extra_paid numeric not null default 0;
