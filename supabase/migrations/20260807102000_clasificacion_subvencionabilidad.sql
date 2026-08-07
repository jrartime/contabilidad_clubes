-- Clasificación independiente entre contabilización y justificación de subvenciones.

alter table public.conceptos
  add column if not exists subvencionabilidad text not null default 'subvencionable';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'conceptos_subvencionabilidad_check') then
    alter table public.conceptos
      add constraint conceptos_subvencionabilidad_check
      check (subvencionabilidad in ('subvencionable', 'no_subvencionable', 'condicionada'));
  end if;
end $$;

with catalogo(concepto) as (
  values ('Intereses bancarios'), ('Gastos financieros'), ('Sanciones')
)
insert into public.conceptos (
  club_id, concepto, naturaleza, en_listado,
  valido_clubes, valido_eventos, valido_eedd_ctd_discapacidad,
  subvencionabilidad, requisito_descripcion
)
select
  club.id_club, catalogo.concepto, 'gasto', false,
  true, true, true, 'no_subvencionable', 'obligatoria'
from public.clubes club
cross join catalogo
where not exists (
  select 1 from public.conceptos existente
  where existente.club_id = club.id_club
    and lower(btrim(existente.concepto)) = lower(catalogo.concepto)
);

update public.conceptos
set
  naturaleza = 'gasto',
  en_listado = false,
  valido_clubes = true,
  valido_eventos = true,
  valido_eedd_ctd_discapacidad = true,
  subvencionabilidad = 'no_subvencionable',
  requisito_descripcion = 'obligatoria'
where lower(btrim(concepto)) in (
  lower('Intereses bancarios'), lower('Gastos financieros'), lower('Sanciones')
);
