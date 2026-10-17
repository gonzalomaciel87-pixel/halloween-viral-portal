-- Ingreso con código para compradores sin Gmail (Halloween Viral)
-- Uso: select public.create_access_code('correo@cliente.com');  -> devuelve el código de 6 números para mandar por WhatsApp.
-- Volver a correrlo genera un código nuevo e invalida el anterior.

create table if not exists public.access_codes (
  email           text primary key,
  code_hash       text not null,
  failed_attempts int  not null default 0,
  created_at      timestamptz not null default now(),
  last_used_at    timestamptz
);

-- Solo el servidor (service role) lee/escribe esta tabla: RLS activo y sin políticas.
alter table public.access_codes enable row level security;

create or replace function public.create_access_code(p_email text)
returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_email text := lower(trim(p_email));
  v_code  text;
begin
  if not exists (select 1 from public.buyer_access where email = v_email and active) then
    raise exception 'El correo % no tiene acceso activo en buyer_access. Habilitalo primero.', v_email;
  end if;
  v_code := lpad(((('x' || encode(gen_random_bytes(4), 'hex'))::bit(32)::bigint) % 1000000)::text, 6, '0');
  insert into public.access_codes (email, code_hash)
  values (v_email, encode(digest(v_code, 'sha256'), 'hex'))
  on conflict (email) do update
    set code_hash = excluded.code_hash, failed_attempts = 0, created_at = now(), last_used_at = null;
  return v_code;
end;
$$;

revoke all on function public.create_access_code(text) from public, anon, authenticated;
