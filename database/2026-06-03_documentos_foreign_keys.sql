-- Normalizacion FK: public.documentos.
--
-- Requisitos previos:
-- - public.documentos existe.
-- - public.clubes, public.contabilidad, public.personal y public.programas existen.
--
-- Nota:
-- - nomina_id no se toca aqui porque no existe una tabla public.nominas normalizada.
-- - Las columnas nullable pueden seguir siendo null; la FK solo valida valores no null.

begin;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'documentos_club_id_fkey'
      and conrelid = 'public.documentos'::regclass
  ) then
    alter table public.documentos
      add constraint documentos_club_id_fkey
      foreign key (club_id)
      references public.clubes(id_club)
      on delete restrict
      not valid;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'documentos_contabilidad_id_fkey'
      and conrelid = 'public.documentos'::regclass
  ) then
    alter table public.documentos
      add constraint documentos_contabilidad_id_fkey
      foreign key (contabilidad_id)
      references public.contabilidad(id_contabilidad)
      on delete cascade
      not valid;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'documentos_personal_id_fkey'
      and conrelid = 'public.documentos'::regclass
  ) then
    alter table public.documentos
      add constraint documentos_personal_id_fkey
      foreign key (personal_id)
      references public.personal(id_personal)
      on delete set null
      not valid;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'documentos_programa_id_fkey'
      and conrelid = 'public.documentos'::regclass
  ) then
    alter table public.documentos
      add constraint documentos_programa_id_fkey
      foreign key (programa_id)
      references public.programas(id_programa)
      on delete set null
      not valid;
  end if;
end $$;

create index if not exists documentos_club_id_idx
  on public.documentos(club_id);

create index if not exists documentos_contabilidad_id_idx
  on public.documentos(contabilidad_id);

create index if not exists documentos_personal_id_idx
  on public.documentos(personal_id);

create index if not exists documentos_programa_id_idx
  on public.documentos(programa_id);

alter table public.documentos validate constraint documentos_club_id_fkey;
alter table public.documentos validate constraint documentos_contabilidad_id_fkey;
alter table public.documentos validate constraint documentos_personal_id_fkey;
alter table public.documentos validate constraint documentos_programa_id_fkey;

commit;

