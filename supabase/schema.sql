-- Construction Budget Manager - Supabase/PostgreSQL schema
-- This starter has NO login. RLS below intentionally allows anon CRUD so the app works immediately.
-- If you deploy publicly, add Supabase Auth and replace these policies with user-based policies.

create extension if not exists pgcrypto;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text default '',
  total_budget numeric(14,2) not null check (total_budget >= 0),
  start_date date,
  status text not null default 'Active' check (status in ('Active','Completed','On Hold')),
  notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.allocations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  category text not null,
  allocated_amount numeric(14,2) not null check (allocated_amount >= 0),
  notes text default '',
  created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  allocation_id uuid not null references public.allocations(id) on delete cascade,
  category text not null,
  supplier text default '',
  description text default '',
  bill_amount numeric(14,2) not null check (bill_amount >= 0),
  expense_date date not null default current_date,
  notes text default '',
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  expense_id uuid not null references public.expenses(id) on delete cascade,
  amount numeric(14,2) not null check (amount >= 0),
  payment_mode text not null check (payment_mode in ('Cash','UPI','Bank Transfer','Cheque','Other')),
  recipient text default '',
  reference_number text default '',
  payment_date date not null default current_date,
  notes text default '',
  created_at timestamptz not null default now()
);

create index if not exists allocations_project_id_idx on public.allocations(project_id);
create index if not exists expenses_project_id_idx on public.expenses(project_id);
create index if not exists expenses_allocation_id_idx on public.expenses(allocation_id);
create index if not exists payments_project_id_idx on public.payments(project_id);
create index if not exists payments_expense_id_idx on public.payments(expense_id);

alter table public.projects enable row level security;
alter table public.allocations enable row level security;
alter table public.expenses enable row level security;
alter table public.payments enable row level security;

-- Remove old starter policies if the script is run again.
drop policy if exists "projects anon all" on public.projects;
drop policy if exists "allocations anon all" on public.allocations;
drop policy if exists "expenses anon all" on public.expenses;
drop policy if exists "payments anon all" on public.payments;

create policy "projects anon all" on public.projects for all to anon using (true) with check (true);
create policy "allocations anon all" on public.allocations for all to anon using (true) with check (true);
create policy "expenses anon all" on public.expenses for all to anon using (true) with check (true);
create policy "payments anon all" on public.payments for all to anon using (true) with check (true);

-- Also allow authenticated users so Auth can be added later without changing table permissions.
create policy "projects authenticated all" on public.projects for all to authenticated using (true) with check (true);
create policy "allocations authenticated all" on public.allocations for all to authenticated using (true) with check (true);
create policy "expenses authenticated all" on public.expenses for all to authenticated using (true) with check (true);
create policy "payments authenticated all" on public.payments for all to authenticated using (true) with check (true);
