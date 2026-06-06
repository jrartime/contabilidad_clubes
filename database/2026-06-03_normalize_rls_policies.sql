-- Normalizacion RLS inicial.
--
-- Requisitos previos:
-- - public.personal.club_id existe.
-- - public.can_access_club(bigint) existe y funciona con public.club_miembros.
--
-- Objetivo:
-- - Activar RLS en personal.
-- - Sustituir politicas de documentos demasiado permisivas por can_access_club(club_id).
-- - Anadir una politica moderna para actualizar clubes mediante club_miembros.

begin;

-- PERSONAL
alter table public.personal enable row level security;

drop policy if exists personal_all on public.personal;

create policy personal_all
  on public.personal
  for all
  to authenticated
  using (public.can_access_club(club_id))
  with check (public.can_access_club(club_id));

-- CONTABILIDAD_DOCUMENTOS
alter table public.contabilidad_documentos enable row level security;

drop policy if exists contabilidad_documentos_select_auth on public.contabilidad_documentos;
drop policy if exists contabilidad_documentos_insert_auth on public.contabilidad_documentos;
drop policy if exists contabilidad_documentos_update_auth on public.contabilidad_documentos;
drop policy if exists contabilidad_documentos_delete_auth on public.contabilidad_documentos;
drop policy if exists contabilidad_documentos_select_by_club on public.contabilidad_documentos;
drop policy if exists contabilidad_documentos_insert_by_club on public.contabilidad_documentos;
drop policy if exists contabilidad_documentos_update_by_club on public.contabilidad_documentos;
drop policy if exists contabilidad_documentos_delete_by_club on public.contabilidad_documentos;

create policy contabilidad_documentos_select_by_club
  on public.contabilidad_documentos
  for select
  to authenticated
  using (public.can_access_club(club_id));

create policy contabilidad_documentos_insert_by_club
  on public.contabilidad_documentos
  for insert
  to authenticated
  with check (public.can_access_club(club_id));

create policy contabilidad_documentos_update_by_club
  on public.contabilidad_documentos
  for update
  to authenticated
  using (public.can_access_club(club_id))
  with check (public.can_access_club(club_id));

create policy contabilidad_documentos_delete_by_club
  on public.contabilidad_documentos
  for delete
  to authenticated
  using (public.can_access_club(club_id));

-- DOCUMENTOS
-- La tabla antigua documentos tambien tiene club_id segun el backup restaurado.
alter table public.documentos enable row level security;

drop policy if exists documentos_select_auth on public.documentos;
drop policy if exists documentos_insert_auth on public.documentos;
drop policy if exists documentos_update_auth on public.documentos;
drop policy if exists documentos_delete_auth on public.documentos;
drop policy if exists documentos_select_by_club on public.documentos;
drop policy if exists documentos_insert_by_club on public.documentos;
drop policy if exists documentos_update_by_club on public.documentos;
drop policy if exists documentos_delete_by_club on public.documentos;

create policy documentos_select_by_club
  on public.documentos
  for select
  to authenticated
  using (public.can_access_club(club_id));

create policy documentos_insert_by_club
  on public.documentos
  for insert
  to authenticated
  with check (public.can_access_club(club_id));

create policy documentos_update_by_club
  on public.documentos
  for update
  to authenticated
  using (public.can_access_club(club_id))
  with check (public.can_access_club(club_id));

create policy documentos_delete_by_club
  on public.documentos
  for delete
  to authenticated
  using (public.can_access_club(club_id));

-- CLUBES
-- Mantener las politicas antiguas por compatibilidad, pero anadir una basada en club_miembros.
drop policy if exists clubes_update_miembro_admin on public.clubes;

create policy clubes_update_miembro_admin
  on public.clubes
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.club_miembros cm
      where cm.club_id = clubes.id_club
        and cm.user_id = auth.uid()
        and cm.rol in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1
      from public.club_miembros cm
      where cm.club_id = clubes.id_club
        and cm.user_id = auth.uid()
        and cm.rol in ('owner', 'admin')
    )
  );

commit;
