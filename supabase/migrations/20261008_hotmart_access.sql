begin;

alter table public.buyer_access
  add column if not exists manual_access boolean;

-- Todo comprador existente fue habilitado manualmente antes de Hotmart.
update public.buyer_access
set manual_access = true
where manual_access is null;

alter table public.buyer_access
  alter column manual_access set default true,
  alter column manual_access set not null;

create table if not exists public.hotmart_transactions (
  transaction text primary key,
  buyer_email text not null check (buyer_email = lower(buyer_email)),
  product_id bigint,
  product_ucode text,
  status text not null,
  active boolean not null default false,
  last_event_id text not null,
  last_event_creation_date bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(transaction) between 1 and 200),
  check (length(last_event_id) between 1 and 200),
  check (product_id is not null or nullif(product_ucode, '') is not null)
);

create table if not exists public.hotmart_webhook_events (
  event_id text primary key,
  event_type text not null,
  transaction text not null,
  buyer_email text not null check (buyer_email = lower(buyer_email)),
  product_id bigint,
  product_ucode text,
  purchase_status text not null,
  creation_date bigint not null,
  outcome text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz not null default now(),
  check (length(event_id) between 1 and 200),
  check (outcome in ('processed', 'duplicate', 'out_of_order'))
);

create index if not exists hotmart_transactions_buyer_active_idx
  on public.hotmart_transactions (buyer_email, active);
create index if not exists hotmart_transactions_product_idx
  on public.hotmart_transactions (product_id, product_ucode);
create index if not exists hotmart_webhook_events_transaction_idx
  on public.hotmart_webhook_events (transaction, creation_date desc);
create index if not exists hotmart_webhook_events_received_idx
  on public.hotmart_webhook_events (received_at desc);

alter table public.hotmart_transactions enable row level security;
alter table public.hotmart_webhook_events enable row level security;

-- No se crean políticas para anon/authenticated: solo service_role puede operar estas tablas.

create or replace function public.recompute_buyer_access(p_email text)
returns public.buyer_access
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
  v_row public.buyer_access;
begin
  if v_email = '' or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'invalid_email';
  end if;

  insert into public.buyer_access (email, active, lifetime_access, manual_access, notes)
  values (v_email, false, true, false, 'Acceso administrado por Hotmart')
  on conflict (email) do nothing;

  update public.buyer_access b
  set active = b.manual_access or exists (
    select 1
    from public.hotmart_transactions h
    where h.buyer_email = v_email and h.active = true
  )
  where b.email = v_email
  returning b.* into v_row;

  return v_row;
end;
$$;

create or replace function public.process_hotmart_event(
  p_event_id text,
  p_creation_date bigint,
  p_event_type text,
  p_transaction text,
  p_email text,
  p_product_id bigint,
  p_product_ucode text,
  p_status text,
  p_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
  v_existing public.hotmart_transactions;
  v_outcome text := 'processed';
  v_current_terminal boolean;
  v_incoming_terminal boolean := upper(p_status) in ('REFUNDED', 'CHARGEBACK', 'CANCELLED');
begin
  if coalesce(trim(p_event_id), '') = '' or coalesce(trim(p_transaction), '') = '' then
    raise exception 'invalid_event_identity';
  end if;

  -- El event_id único vuelve idempotente cada reintento, incluso bajo concurrencia.
  insert into public.hotmart_webhook_events (
    event_id, event_type, transaction, buyer_email, product_id, product_ucode,
    purchase_status, creation_date, outcome
  ) values (
    p_event_id, p_event_type, p_transaction, v_email, p_product_id, p_product_ucode,
    upper(p_status), p_creation_date, 'processed'
  ) on conflict (event_id) do nothing;

  if not found then
    return jsonb_build_object('outcome', 'duplicate', 'transaction', p_transaction);
  end if;

  -- Serializa todos los eventos de una misma transacción.
  perform pg_advisory_xact_lock(hashtextextended(p_transaction, 0));
  select * into v_existing
  from public.hotmart_transactions
  where transaction = p_transaction
  for update;

  if found then
    v_current_terminal := upper(v_existing.status) in ('REFUNDED', 'CHARGEBACK', 'CANCELLED');
    if p_creation_date < v_existing.last_event_creation_date
       or (v_current_terminal and not v_incoming_terminal) then
      v_outcome := 'out_of_order';
      update public.hotmart_webhook_events set outcome = v_outcome where event_id = p_event_id;
      perform public.recompute_buyer_access(v_existing.buyer_email);
      return jsonb_build_object('outcome', v_outcome, 'transaction', p_transaction);
    end if;
  end if;

  insert into public.hotmart_transactions (
    transaction, buyer_email, product_id, product_ucode, status, active,
    last_event_id, last_event_creation_date
  ) values (
    p_transaction, v_email, p_product_id, nullif(p_product_ucode, ''), upper(p_status), coalesce(p_active, false),
    p_event_id, p_creation_date
  )
  on conflict (transaction) do update set
    buyer_email = excluded.buyer_email,
    product_id = excluded.product_id,
    product_ucode = excluded.product_ucode,
    status = excluded.status,
    active = coalesce(p_active, hotmart_transactions.active),
    last_event_id = excluded.last_event_id,
    last_event_creation_date = excluded.last_event_creation_date,
    updated_at = now();

  if v_existing.buyer_email is not null and v_existing.buyer_email <> v_email then
    perform public.recompute_buyer_access(v_existing.buyer_email);
  end if;
  perform public.recompute_buyer_access(v_email);

  return jsonb_build_object('outcome', v_outcome, 'transaction', p_transaction);
end;
$$;

revoke all on table public.hotmart_transactions from anon, authenticated;
revoke all on table public.hotmart_webhook_events from anon, authenticated;
revoke all on function public.recompute_buyer_access(text) from public, anon, authenticated;
revoke all on function public.process_hotmart_event(text, bigint, text, text, text, bigint, text, text, boolean) from public, anon, authenticated;
grant execute on function public.recompute_buyer_access(text) to service_role;
grant execute on function public.process_hotmart_event(text, bigint, text, text, text, bigint, text, text, boolean) to service_role;

commit;
