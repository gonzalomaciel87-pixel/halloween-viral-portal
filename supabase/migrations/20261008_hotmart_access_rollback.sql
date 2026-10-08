begin;

-- Ejecutar solo si la activación debe revertirse.
-- Conserva buyer_access y todos los compradores previos.
drop function if exists public.process_hotmart_event(text, bigint, text, text, text, bigint, text, text, boolean);
drop function if exists public.recompute_buyer_access(text);
drop table if exists public.hotmart_webhook_events;
drop table if exists public.hotmart_transactions;

-- Recupera el comportamiento anterior: todos los registros existentes quedan activos.
update public.buyer_access
set active = true,
    lifetime_access = true;

alter table public.buyer_access
  drop column if exists manual_access;

commit;
