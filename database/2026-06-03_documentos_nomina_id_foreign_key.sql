-- Normalizacion FK: public.documentos.nomina_id.
--
-- Requisitos previos:
-- - Ejecutar 2026-06-03_documentos_nomina_id_audit.sql.
-- - Los dos conteos deben ser 0.
--
-- Nota:
-- - La FK garantiza que nomina_id apunte a public.contabilidad.
-- - La regla "debe ser tipo_id = 3" queda auditada, no puede expresarse como FK simple.

begin;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'documentos_nomina_id_fkey'
      and conrelid = 'public.documentos'::regclass
  ) then
    alter table public.documentos
      add constraint documentos_nomina_id_fkey
      foreign key (nomina_id)
      references public.contabilidad(id_contabilidad)
      on delete cascade
      not valid;
  end if;
end $$;

create index if not exists documentos_nomina_id_idx
  on public.documentos(nomina_id);

alter table public.documentos validate constraint documentos_nomina_id_fkey;

commit;

