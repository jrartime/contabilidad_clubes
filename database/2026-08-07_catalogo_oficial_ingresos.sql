-- Catálogo oficial de ingresos y metadatos configurables de los conceptos.

begin;

alter table public.conceptos
  add column if not exists naturaleza text not null default 'gasto',
  add column if not exists codigo_interno text,
  add column if not exists requisito_entidad_origen text not null default 'no',
  add column if not exists requisito_descripcion text not null default 'opcional';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'conceptos_naturaleza_check') then
    alter table public.conceptos add constraint conceptos_naturaleza_check check (naturaleza in ('gasto', 'ingreso'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'conceptos_requisito_entidad_check') then
    alter table public.conceptos add constraint conceptos_requisito_entidad_check check (requisito_entidad_origen in ('no', 'opcional', 'obligatoria'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'conceptos_requisito_descripcion_check') then
    alter table public.conceptos add constraint conceptos_requisito_descripcion_check check (requisito_descripcion in ('no', 'opcional', 'obligatoria'));
  end if;
end $$;

create unique index if not exists conceptos_club_codigo_interno_unique
  on public.conceptos (club_id, codigo_interno)
  where codigo_interno is not null;

-- Aprovecha el concepto Subvención existente como concepto municipal.
update public.conceptos
set concepto = 'Subvención del Ayuntamiento de Oviedo'
where lower(btrim(concepto)) = lower('Subvención');

with catalogo(codigo, concepto, requisito_entidad, requisito_descripcion) as (
  values
    ('subvencion_ayuntamiento_oviedo', 'Subvención del Ayuntamiento de Oviedo', 'no', 'no'),
    ('otras_subvenciones_publicas', 'Aportaciones y/o subvenciones de otras Administraciones Públicas', 'obligatoria', 'obligatoria'),
    ('aportaciones_privadas', 'Aportaciones privadas', 'obligatoria', 'obligatoria'),
    ('recursos_propios', 'Recursos propios', 'no', 'opcional'),
    ('otros_ingresos', 'Otros ingresos', 'opcional', 'obligatoria')
)
insert into public.conceptos (
  club_id, concepto, naturaleza, codigo_interno, en_listado,
  valido_clubes, valido_eventos, valido_eedd_ctd_discapacidad,
  requisito_entidad_origen, requisito_descripcion
)
select
  club.id_club, catalogo.concepto, 'ingreso', catalogo.codigo, true,
  true, true, true, catalogo.requisito_entidad, catalogo.requisito_descripcion
from public.clubes club
cross join catalogo
where not exists (
  select 1 from public.conceptos existente
  where existente.club_id = club.id_club
    and lower(btrim(existente.concepto)) = lower(catalogo.concepto)
);

with catalogo(codigo, concepto, requisito_entidad, requisito_descripcion) as (
  values
    ('subvencion_ayuntamiento_oviedo', 'Subvención del Ayuntamiento de Oviedo', 'no', 'no'),
    ('otras_subvenciones_publicas', 'Aportaciones y/o subvenciones de otras Administraciones Públicas', 'obligatoria', 'obligatoria'),
    ('aportaciones_privadas', 'Aportaciones privadas', 'obligatoria', 'obligatoria'),
    ('recursos_propios', 'Recursos propios', 'no', 'opcional'),
    ('otros_ingresos', 'Otros ingresos', 'opcional', 'obligatoria')
)
update public.conceptos existente
set
  naturaleza = 'ingreso', codigo_interno = catalogo.codigo, en_listado = true,
  valido_clubes = true, valido_eventos = true, valido_eedd_ctd_discapacidad = true,
  requisito_entidad_origen = catalogo.requisito_entidad,
  requisito_descripcion = catalogo.requisito_descripcion
from catalogo
where lower(btrim(existente.concepto)) = lower(catalogo.concepto);

-- Equivalencias históricas inequívocas. Inscripciones queda fuera por poder ser gasto o ingreso.
with equivalencias(antiguo, oficial) as (
  values
    ('Aportaciones de Socios', 'Recursos propios'),
    ('Aportaciones de socios/Recursos Propios', 'Recursos propios'),
    ('Patrocinio Deportivo', 'Aportaciones privadas'),
    ('Loteria del Club', 'Otros ingresos'),
    ('Programa La Noche es Tuya', 'Subvención del Ayuntamiento de Oviedo')
), conversiones as (
  select a.club_id, a.id_concepto id_antiguo, a.concepto nombre_antiguo, o.id_concepto id_oficial
  from equivalencias e
  join public.conceptos a on lower(btrim(a.concepto)) = lower(e.antiguo)
  join public.conceptos o on o.club_id = a.club_id and lower(btrim(o.concepto)) = lower(e.oficial)
)
update public.contabilidad c
set concepto_id = x.id_oficial,
    observaciones = concat_ws(E'\n', nullif(btrim(c.observaciones), ''), 'Concepto anterior: ' || x.nombre_antiguo)
from conversiones x
where c.club_id = x.club_id and c.concepto_id = x.id_antiguo;

with equivalencias(antiguo, oficial) as (
  values
    ('Aportaciones de Socios', 'Recursos propios'),
    ('Aportaciones de socios/Recursos Propios', 'Recursos propios'),
    ('Patrocinio Deportivo', 'Aportaciones privadas'),
    ('Loteria del Club', 'Otros ingresos'),
    ('Programa La Noche es Tuya', 'Subvención del Ayuntamiento de Oviedo')
), conversiones as (
  select a.club_id, a.id_concepto id_antiguo, o.id_concepto id_oficial
  from equivalencias e
  join public.conceptos a on lower(btrim(a.concepto)) = lower(e.antiguo)
  join public.conceptos o on o.club_id = a.club_id and lower(btrim(o.concepto)) = lower(e.oficial)
)
update public.bancos b set concepto_id = x.id_oficial
from conversiones x
where b.club_id = x.club_id and b.concepto_id = x.id_antiguo;

delete from public.conceptos c
where lower(btrim(c.concepto)) in (
  lower('Aportaciones de Socios'), lower('Aportaciones de socios/Recursos Propios'),
  lower('Patrocinio Deportivo'), lower('Loteria del Club'), lower('Programa La Noche es Tuya')
)
and not exists (select 1 from public.contabilidad x where x.concepto_id = c.id_concepto)
and not exists (select 1 from public.bancos x where x.concepto_id = c.id_concepto);

commit;
