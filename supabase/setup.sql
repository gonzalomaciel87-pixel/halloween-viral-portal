create table if not exists public.buyer_access (
  email text primary key check (email = lower(email)),
  active boolean not null default true,
  lifetime_access boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.buyer_access enable row level security;

create policy "buyers can verify their own access" on public.buyer_access
for select to authenticated
using (lower(email) = lower(auth.jwt() ->> 'email'));

insert into storage.buckets (id, name, public)
values ('ebooks', 'ebooks', false)
on conflict (id) do update set public = false;

create policy "approved buyers can read ebooks" on storage.objects
for select to authenticated
using (
  bucket_id = 'ebooks'
  and exists (
    select 1 from public.buyer_access
    where lower(email) = lower(auth.jwt() ->> 'email') and active = true
  )
);

-- Habilitar una compra confirmada:
-- insert into public.buyer_access (email, notes)
-- values ('cliente@gmail.com', 'Transferencia confirmada')
-- on conflict (email) do update set active = true;
