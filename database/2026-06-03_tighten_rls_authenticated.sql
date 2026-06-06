-- Normalizacion RLS: reducir politicas heredadas y evitar rol public en tablas de negocio.
--
-- Requisitos previos:
-- - public.can_access_club(bigint) existe.
-- - public.club_miembros es la tabla actual de pertenencia.
--
-- Objetivo:
-- - Cambiar politicas ALL de tablas de negocio desde public a authenticated.
-- - Eliminar politicas antiguas de public.clubes basadas en user_clubs.
-- - Mantener politicas de administrador existentes donde no afectan al flujo actual.

begin;

-- Tablas con acceso por club.
drop policy if exists bancos_all on public.bancos;
create policy bancos_all
  on public.bancos
  for all
  to authenticated
  using (public.can_access_club(club_id))
  with check (public.can_access_club(club_id));

drop policy if exists checklist_all on public.checklist_justificacion;
create policy checklist_all
  on public.checklist_justificacion
  for all
  to authenticated
  using (public.can_access_club(club_id))
  with check (public.can_access_club(club_id));

drop policy if exists conceptos_all on public.conceptos;
create policy conceptos_all
  on public.conceptos
  for all
  to authenticated
  using (public.can_access_club(club_id))
  with check (public.can_access_club(club_id));

drop policy if exists contabilidad_all on public.contabilidad;
create policy contabilidad_all
  on public.contabilidad
  for all
  to authenticated
  using (public.can_access_club(club_id))
  with check (public.can_access_club(club_id));

drop policy if exists entidades_all on public.entidades;
create policy entidades_all
  on public.entidades
  for all
  to authenticated
  using (public.can_access_club(club_id))
  with check (public.can_access_club(club_id));

drop policy if exists imputaciones_all on public.imputaciones;
create policy imputaciones_all
  on public.imputaciones
  for all
  to authenticated
  using (public.can_access_club(club_id))
  with check (public.can_access_club(club_id));

drop policy if exists pagos_all on public.pagos;
create policy pagos_all
  on public.pagos
  for all
  to authenticated
  using (public.can_access_club(club_id))
  with check (public.can_access_club(club_id));

drop policy if exists programas_all on public.programas;
create policy programas_all
  on public.programas
  for all
  to authenticated
  using (public.can_access_club(club_id))
  with check (public.can_access_club(club_id));

drop policy if exists proveedores_all on public.proveedores;
create policy proveedores_all
  on public.proveedores
  for all
  to authenticated
  using (public.can_access_club(club_id))
  with check (public.can_access_club(club_id));

drop policy if exists subvencion_programas_all on public.subvencion_programas;
create policy subvencion_programas_all
  on public.subvencion_programas
  for all
  to authenticated
  using (public.can_access_club(club_id))
  with check (public.can_access_club(club_id));

drop policy if exists subvenciones_all on public.subvenciones;
create policy subvenciones_all
  on public.subvenciones
  for all
  to authenticated
  using (public.can_access_club(club_id))
  with check (public.can_access_club(club_id));

drop policy if exists tipos_all on public.tipos;
create policy tipos_all
  on public.tipos
  for all
  to authenticated
  using (public.can_access_club(club_id))
  with check (public.can_access_club(club_id));

-- CLUB_MIEMBROS
drop policy if exists club_miembros_all on public.club_miembros;
create policy club_miembros_all
  on public.club_miembros
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists club_miembros_select_propios on public.club_miembros;
create policy club_miembros_select_propios
  on public.club_miembros
  for select
  to authenticated
  using (user_id = auth.uid());

-- PERFILES
drop policy if exists perfiles_write on public.perfiles;
create policy perfiles_write
  on public.perfiles
  for all
  to authenticated
  using (public.is_admin() or user_id = auth.uid())
  with check (public.is_admin() or user_id = auth.uid());

-- CLUBES: retirar politicas heredadas basadas en user_clubs.
-- Las politicas actuales validas son:
-- - clubes_select_miembro
-- - clubes_update_miembro_admin
-- - politicas is_admin para administracion global
drop policy if exists clubes_select on public.clubes;
drop policy if exists clubes_update on public.clubes;

-- Normalizar tambien el rol de lectura por membresia.
drop policy if exists clubes_select_miembro on public.clubes;
create policy clubes_select_miembro
  on public.clubes
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.club_miembros cm
      where cm.club_id = clubes.id_club
        and cm.user_id = auth.uid()
    )
  );

commit;

