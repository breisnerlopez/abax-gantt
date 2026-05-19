-- set_user_context: RPC para establecer contexto de usuario en el request
-- Usado por las Edge Functions tras autenticacion con Authentik
create or replace function public.set_user_context(user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce((select authentik_sub from public.profiles where id = user_id), ''), false);
  perform set_config('abax.user_id', user_id::text, false);
end;
$$;
