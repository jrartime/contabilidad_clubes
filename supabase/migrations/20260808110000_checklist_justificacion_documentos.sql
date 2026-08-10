begin;

-- ============================================================================
-- FASE 2 DE GESTIÓN ECONÓMICA (1/4): ADJUNTAR DOCUMENTOS AL CHECKLIST DE
-- JUSTIFICACIÓN
--
-- public.checklist_justificacion ya existía sin ninguna pantalla. Esta
-- migración permite adjuntar los documentos de cada partida del checklist
-- (memorias, anexos, facturas de justificación) reutilizando el modelo de
-- public.documentos, igual que ya se hace con contabilidad, nóminas,
-- personal y programas.
--
-- Cambios:
--   1. public.documentos.checklist_id (nullable) -> checklist_justificacion.
--   2. Bucket de Storage 'justificantes' (mismos límites que los existentes).
--   3. Ampliación del check de public.documentos.bucket para admitirlo.
--   4. Políticas de storage.objects dedicadas al bucket nuevo, sin tocar las
--      ya existentes de 'facturas'/'nominas'.
-- ============================================================================


-- ============================================================================
-- 1. GUARDS PREVIOS
-- ============================================================================

do $preflight$
begin
  if to_regclass('public.checklist_justificacion') is null then
    raise exception 'Migración abortada: no existe public.checklist_justificacion.';
  end if;

  if to_regclass('public.documentos') is null then
    raise exception 'Migración abortada: no existe public.documentos.';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'documentos'
      and column_name = 'checklist_id'
  ) then
    raise exception 'Migración abortada: public.documentos.checklist_id ya existe.';
  end if;
end;
$preflight$;


-- ============================================================================
-- 2. COLUMNA Y CLAVE FORÁNEA
-- ============================================================================

alter table public.documentos
  add column checklist_id bigint;

alter table public.documentos
  add constraint documentos_checklist_id_fkey
  foreign key (checklist_id)
  references public.checklist_justificacion (id_check)
  on delete cascade;

create index documentos_checklist_id_idx
  on public.documentos (checklist_id);


-- ============================================================================
-- 3. AMPLIAR EL CHECK DE BUCKET PERMITIDO
--
-- El nombre exacto de la constraint original no está fijado en el historial
-- versionado del repositorio (la tabla documentos ya existía antes de las
-- migraciones auditadas), así que se localiza dinámicamente por su
-- definición en lugar de asumir un nombre.
-- ============================================================================

do $extend_bucket_check$
declare
  v_conname text;
begin
  select conname
  into v_conname
  from pg_constraint
  where conrelid = 'public.documentos'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%bucket%';

  if v_conname is not null then
    execute format('alter table public.documentos drop constraint %I', v_conname);
  end if;

  alter table public.documentos
    add constraint documentos_bucket_check
    check (bucket in ('facturas', 'nominas', 'justificantes'));
end;
$extend_bucket_check$;


-- ============================================================================
-- 4. BUCKET DE STORAGE
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('justificantes', 'justificantes', false, 1048576, array['application/pdf','image/jpeg','image/png'])
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;


-- ============================================================================
-- 5. POLÍTICAS DE STORAGE (SOLO PARA EL BUCKET NUEVO)
-- ============================================================================

drop policy if exists storage_justificantes_select_auth on storage.objects;
drop policy if exists storage_justificantes_insert_auth on storage.objects;
drop policy if exists storage_justificantes_update_auth on storage.objects;
drop policy if exists storage_justificantes_delete_auth on storage.objects;

create policy storage_justificantes_select_auth
  on storage.objects for select
  to authenticated
  using (bucket_id = 'justificantes');

create policy storage_justificantes_insert_auth
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'justificantes');

create policy storage_justificantes_update_auth
  on storage.objects for update
  to authenticated
  using (bucket_id = 'justificantes')
  with check (bucket_id = 'justificantes');

create policy storage_justificantes_delete_auth
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'justificantes');

commit;


-- ============================================================================
-- ROLLBACK MANUAL COMPLETO
--
-- begin;
--
-- drop policy if exists storage_justificantes_select_auth on storage.objects;
-- drop policy if exists storage_justificantes_insert_auth on storage.objects;
-- drop policy if exists storage_justificantes_update_auth on storage.objects;
-- drop policy if exists storage_justificantes_delete_auth on storage.objects;
-- delete from storage.buckets where id = 'justificantes';
--
-- alter table public.documentos drop constraint if exists documentos_bucket_check;
-- alter table public.documentos
--   add constraint documentos_bucket_check check (bucket in ('facturas', 'nominas'));
--
-- alter table public.documentos drop constraint if exists documentos_checklist_id_fkey;
-- alter table public.documentos drop column if exists checklist_id;
--
-- commit;
-- ============================================================================
