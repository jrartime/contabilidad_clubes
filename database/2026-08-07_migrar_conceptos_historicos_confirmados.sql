-- Migra conceptos históricos a su equivalente en el catálogo regulado.
-- Conserva la trazabilidad en contabilidad.observaciones y elimina únicamente
-- los conceptos antiguos que hayan quedado sin referencias.

begin;

with equivalencias(concepto_antiguo, concepto_oficial) as (
  values
    ('Alojamientos competiciones', 'Alojamiento'),
    ('Alquiler Local', 'Local o sede del club'),
    ('Arbitrajes y jueces en comp. oficiales', 'Arbitrajes y jueces'),
    ('Electricidad Local', 'Local o sede del club'),
    ('Equipaciones', 'Vestuario deportivo'),
    ('Gestoría y administración', 'Servicios profesionales'),
    ('Nóminas y SS', 'Personal'),
    ('Promoción y representación', 'Comunicación'),
    ('Reparaciones Local', 'Local o sede del club'),
    ('Revisión extintores', 'Local o sede del club'),
    ('Telefonía Móvil', 'Comunicación'),
    ('Vídeo Promocional', 'Comunicación'),
    ('Vigilancia de la Salud', 'Servicios profesionales')
),
conversiones as (
  select
    antiguo.club_id,
    antiguo.id_concepto as id_antiguo,
    antiguo.concepto as nombre_antiguo,
    oficial.id_concepto as id_oficial
  from equivalencias e
  join public.conceptos antiguo
    on lower(btrim(antiguo.concepto)) = lower(e.concepto_antiguo)
  join public.conceptos oficial
    on oficial.club_id = antiguo.club_id
   and lower(btrim(oficial.concepto)) = lower(e.concepto_oficial)
)
update public.contabilidad asiento
set
  concepto_id = conversion.id_oficial,
  observaciones = concat_ws(
    E'\n',
    nullif(btrim(asiento.observaciones), ''),
    'Concepto anterior: ' || conversion.nombre_antiguo
  )
from conversiones conversion
where asiento.club_id = conversion.club_id
  and asiento.concepto_id = conversion.id_antiguo;

-- Los movimientos bancarios comparten el mismo catálogo de conceptos. No tienen
-- columna de observaciones, por lo que aquí solo se reasigna la clave foránea.
with equivalencias(concepto_antiguo, concepto_oficial) as (
  values
    ('Alojamientos competiciones', 'Alojamiento'),
    ('Alquiler Local', 'Local o sede del club'),
    ('Arbitrajes y jueces en comp. oficiales', 'Arbitrajes y jueces'),
    ('Electricidad Local', 'Local o sede del club'),
    ('Equipaciones', 'Vestuario deportivo'),
    ('Gestoría y administración', 'Servicios profesionales'),
    ('Nóminas y SS', 'Personal'),
    ('Promoción y representación', 'Comunicación'),
    ('Reparaciones Local', 'Local o sede del club'),
    ('Revisión extintores', 'Local o sede del club'),
    ('Telefonía Móvil', 'Comunicación'),
    ('Vídeo Promocional', 'Comunicación'),
    ('Vigilancia de la Salud', 'Servicios profesionales')
),
conversiones as (
  select
    antiguo.club_id,
    antiguo.id_concepto as id_antiguo,
    oficial.id_concepto as id_oficial
  from equivalencias e
  join public.conceptos antiguo
    on lower(btrim(antiguo.concepto)) = lower(e.concepto_antiguo)
  join public.conceptos oficial
    on oficial.club_id = antiguo.club_id
   and lower(btrim(oficial.concepto)) = lower(e.concepto_oficial)
)
update public.bancos movimiento
set concepto_id = conversion.id_oficial
from conversiones conversion
where movimiento.club_id = conversion.club_id
  and movimiento.concepto_id = conversion.id_antiguo;

with conceptos_antiguos(concepto) as (
  values
    ('Alojamientos competiciones'),
    ('Alquiler Local'),
    ('Arbitrajes y jueces en comp. oficiales'),
    ('Electricidad Local'),
    ('Equipaciones'),
    ('Gestoría y administración'),
    ('Nóminas y SS'),
    ('Promoción y representación'),
    ('Reparaciones Local'),
    ('Revisión extintores'),
    ('Telefonía Móvil'),
    ('Vídeo Promocional'),
    ('Vigilancia de la Salud')
)
delete from public.conceptos antiguo
using conceptos_antiguos listado
where lower(btrim(antiguo.concepto)) = lower(listado.concepto)
  and not exists (
    select 1
    from public.contabilidad asiento
    where asiento.club_id = antiguo.club_id
      and asiento.concepto_id = antiguo.id_concepto
  )
  and not exists (
    select 1
    from public.bancos movimiento
    where movimiento.club_id = antiguo.club_id
      and movimiento.concepto_id = antiguo.id_concepto
  );

commit;
