# Supabase Setup Guide

To get this FinBoom clone working, you need to set up a Supabase project and create the following table.

## 1. Database Setup

Run this SQL in your Supabase SQL Editor. This script is safe to run multiple times.

```sql
-- 1. Create assets table if it doesn't exist
create table if not exists assets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  name text not null,
  type text not null,
  initial_value numeric default 0 not null, -- Opening Balance
  value numeric not null, -- Current Value
  invested_value numeric default 0, -- For Stocks/Mutual Funds
  currency text default 'INR',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security for assets
alter table assets enable row level security;

-- Create policies for assets (safe to run multiple times)
do $$ 
begin
  if not exists (select 1 from information_schema.columns where table_name = 'assets' and column_name = 'initial_value') then
    alter table assets add column initial_value numeric default 0 not null;
    update assets set initial_value = value where initial_value = 0;
  end if;

  -- Add invested_value column if it doesn't exist (for existing tables)
  if not exists (select 1 from information_schema.columns where table_name = 'assets' and column_name = 'invested_value') then
    alter table assets add column invested_value numeric default 0;
  end if;

  if not exists (select 1 from pg_policies where tablename = 'assets' and policyname = 'Users can view their own assets') then
    create policy "Users can view their own assets" on assets for select using ( auth.uid() = user_id );
  end if;
  if not exists (select 1 from pg_policies where tablename = 'assets' and policyname = 'Users can insert their own assets') then
    create policy "Users can insert their own assets" on assets for insert with check ( auth.uid() = user_id );
  end if;
  if not exists (select 1 from pg_policies where tablename = 'assets' and policyname = 'Users can update their own assets') then
    create policy "Users can update their own assets" on assets for update using ( auth.uid() = user_id );
  end if;
  if not exists (select 1 from pg_policies where tablename = 'assets' and policyname = 'Users can delete their own assets') then
    create policy "Users can delete their own assets" on assets for delete using ( auth.uid() = user_id );
  end if;
end $$;

-- 2. Create categories table
create table if not exists categories (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  name text not null,
  type text not null, -- 'Income', 'Expense'
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security for categories
alter table categories enable row level security;

-- Create policies for categories
do $$ 
begin
  if not exists (select 1 from pg_policies where tablename = 'categories' and policyname = 'Users can view their own categories') then
    create policy "Users can view their own categories" on categories for select using ( auth.uid() = user_id );
  end if;
  if not exists (select 1 from pg_policies where tablename = 'categories' and policyname = 'Users can insert their own categories') then
    create policy "Users can insert their own categories" on categories for insert with check ( auth.uid() = user_id );
  end if;
  if not exists (select 1 from pg_policies where tablename = 'categories' and policyname = 'Users can delete their own categories') then
    create policy "Users can delete their own categories" on categories for delete using ( auth.uid() = user_id );
  end if;
end $$;

-- 3. Create investments table
create table if not exists investments (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  name text not null,
  ticker text,
  type text not null, -- 'Stock', 'Mutual Fund'
  quantity numeric default 0,
  buy_price numeric default 0,
  current_price numeric default 0,
  invested_value numeric not null,
  current_value numeric not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security for investments
alter table investments enable row level security;

-- Create policies for investments
do $$ 
begin
  -- Add new columns if they don't exist
  if not exists (select 1 from information_schema.columns where table_name = 'investments' and column_name = 'ticker') then
    alter table investments add column ticker text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'investments' and column_name = 'quantity') then
    alter table investments add column quantity numeric default 0;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'investments' and column_name = 'buy_price') then
    alter table investments add column buy_price numeric default 0;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'investments' and column_name = 'current_price') then
    alter table investments add column current_price numeric default 0;
  end if;

  if not exists (select 1 from pg_policies where tablename = 'investments' and policyname = 'Users can view their own investments') then
    create policy "Users can view their own investments" on investments for select using ( auth.uid() = user_id );
  end if;
  if not exists (select 1 from pg_policies where tablename = 'investments' and policyname = 'Users can insert their own investments') then
    create policy "Users can insert their own investments" on investments for insert with check ( auth.uid() = user_id );
  end if;
  if not exists (select 1 from pg_policies where tablename = 'investments' and policyname = 'Users can update their own investments') then
    create policy "Users can update their own investments" on investments for update using ( auth.uid() = user_id );
  end if;
  if not exists (select 1 from pg_policies where tablename = 'investments' and policyname = 'Users can delete their own investments') then
    create policy "Users can delete their own investments" on investments for delete using ( auth.uid() = user_id );
  end if;
end $$;

-- 4. Create transactions table if it doesn't exist
create table if not exists transactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  asset_id uuid references assets not null,
  to_asset_id uuid references assets, -- For transfers
  amount numeric not null,
  type text not null, -- 'Income', 'Expense', 'Transfer'
  category text not null,
  description text,
  date date default current_date not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security for transactions
alter table transactions enable row level security;

-- Create policies for transactions (safe to run multiple times)
do $$ 
begin
  if not exists (select 1 from pg_policies where tablename = 'transactions' and policyname = 'Users can view their own transactions') then
    create policy "Users can view their own transactions" on transactions for select using ( auth.uid() = user_id );
  end if;
  if not exists (select 1 from pg_policies where tablename = 'transactions' and policyname = 'Users can insert their own transactions') then
    create policy "Users can insert their own transactions" on transactions for insert with check ( auth.uid() = user_id );
  end if;
  if not exists (select 1 from pg_policies where tablename = 'transactions' and policyname = 'Users can update their own transactions') then
    create policy "Users can update their own transactions" on transactions for update using ( auth.uid() = user_id );
  end if;
  if not exists (select 1 from pg_policies where tablename = 'transactions' and policyname = 'Users can delete their own transactions') then
    create policy "Users can delete their own transactions" on transactions for delete using ( auth.uid() = user_id );
  end if;
end $$;

-- 5. Create loans table if it doesn't exist
create table if not exists loans (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  name text not null,
  lender text not null,
  loan_amount numeric not null,
  interest_rate numeric default 0 not null,
  emi_amount numeric default 0 not null,
  start_date date not null,
  status text default 'Active' not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table loans enable row level security;

do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'loans' and column_name = 'lender') then
    alter table loans add column lender text not null default '';
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'loans' and column_name = 'loan_amount') then
    alter table loans add column loan_amount numeric not null default 0;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'loans' and column_name = 'interest_rate') then
    alter table loans add column interest_rate numeric not null default 0;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'loans' and column_name = 'emi_amount') then
    alter table loans add column emi_amount numeric not null default 0;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'loans' and column_name = 'start_date') then
    alter table loans add column start_date date not null default current_date;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'loans' and column_name = 'status') then
    alter table loans add column status text not null default 'Active';
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'loans' and column_name = 'updated_at') then
    alter table loans add column updated_at timestamp with time zone default timezone('utc'::text, now()) not null;
  end if;

  if not exists (select 1 from pg_policies where tablename = 'loans' and policyname = 'Users can view their own loans') then
    create policy "Users can view their own loans" on loans for select using ( auth.uid() = user_id );
  end if;
  if not exists (select 1 from pg_policies where tablename = 'loans' and policyname = 'Users can insert their own loans') then
    create policy "Users can insert their own loans" on loans for insert with check ( auth.uid() = user_id );
  end if;
  if not exists (select 1 from pg_policies where tablename = 'loans' and policyname = 'Users can update their own loans') then
    create policy "Users can update their own loans" on loans for update using ( auth.uid() = user_id );
  end if;
  if not exists (select 1 from pg_policies where tablename = 'loans' and policyname = 'Users can delete their own loans') then
    create policy "Users can delete their own loans" on loans for delete using ( auth.uid() = user_id );
  end if;
end $$;

-- 6. Create loan_payments table if it doesn't exist
create table if not exists loan_payments (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  loan_id uuid references loans(id) on delete cascade not null,
  month text not null,
  payment_date date not null,
  emi_amount numeric not null,
  principal_component numeric default 0 not null,
  interest_component numeric default 0 not null,
  prepayment_amount numeric default 0 not null,
  notes text default '' not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (loan_id, month)
);

alter table loan_payments enable row level security;

do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'loan_payments' and column_name = 'payment_date') then
    alter table loan_payments add column payment_date date not null default current_date;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'loan_payments' and column_name = 'emi_amount') then
    alter table loan_payments add column emi_amount numeric not null default 0;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'loan_payments' and column_name = 'principal_component') then
    alter table loan_payments add column principal_component numeric not null default 0;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'loan_payments' and column_name = 'interest_component') then
    alter table loan_payments add column interest_component numeric not null default 0;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'loan_payments' and column_name = 'prepayment_amount') then
    alter table loan_payments add column prepayment_amount numeric not null default 0;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'loan_payments' and column_name = 'notes') then
    alter table loan_payments add column notes text not null default '';
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'loan_payments' and column_name = 'updated_at') then
    alter table loan_payments add column updated_at timestamp with time zone default timezone('utc'::text, now()) not null;
  end if;
  if not exists (
    select 1
    from pg_constraint
    where conname = 'loan_payments_loan_id_month_key'
  ) then
    alter table loan_payments add constraint loan_payments_loan_id_month_key unique (loan_id, month);
  end if;

  if not exists (select 1 from pg_policies where tablename = 'loan_payments' and policyname = 'Users can view their own loan payments') then
    create policy "Users can view their own loan payments" on loan_payments for select using ( auth.uid() = user_id );
  end if;
  if not exists (select 1 from pg_policies where tablename = 'loan_payments' and policyname = 'Users can insert their own loan payments') then
    create policy "Users can insert their own loan payments" on loan_payments for insert with check ( auth.uid() = user_id );
  end if;
  if not exists (select 1 from pg_policies where tablename = 'loan_payments' and policyname = 'Users can update their own loan payments') then
    create policy "Users can update their own loan payments" on loan_payments for update using ( auth.uid() = user_id );
  end if;
  if not exists (select 1 from pg_policies where tablename = 'loan_payments' and policyname = 'Users can delete their own loan payments') then
    create policy "Users can delete their own loan payments" on loan_payments for delete using ( auth.uid() = user_id );
  end if;
end $$;
```
## 2. Environment Variables

Add these to your `.env` file (or AI Studio Secrets):

- `SUPABASE_URL`: Your project URL
- `SUPABASE_ANON_KEY`: Your project's anonymous public key
