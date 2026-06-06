-- Normalizacion RLS: cerrar politica public restante en public.clubes.
--
-- Estado previo observado:
-- - public.clubes.clubes_write aplica ALL a rol public con condicion is_admin().
--
-- Objetivo:
-- - Evitar politicas de escritura con rol public.
-- - Mantener capacidad de administracion global para usuarios autenticados administradores.

begin;

drop policy if exists clubes_write on public.clubes;

create policy clubes_write
  on public.clubes
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

commit;

