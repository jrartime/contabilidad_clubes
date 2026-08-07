-- Agrupa gastos históricos genéricos dentro de Gastos varios.
-- Requiere haber ejecutado antes 2026-08-07_conceptos_checks_editables.sql.

begin;

with conceptos_antiguos(concepto) as (
  values
    ('Agua Participantes'),
    ('Gastos Competiciones'),
    ('Gastos Generales del Club')
),
conversiones as (
  select
    antiguo.club_id,
    antiguo.id_concepto as id_antiguo,
    antiguo.concepto as nombre_antiguo,
    oficial.id_concepto as id_oficial
  from conceptos_antiguos listado
  join public.conceptos antiguo
    on lower(btrim(antiguo.concepto)) = lower(listado.concepto)
  join public.conceptos oficial
    on oficial.club_id = antiguo.club_id
   and lower(btrim(oficial.concepto)) = lower('Gastos varios')
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

with conceptos_antiguos(concepto) as (
  values
    ('Agua Participantes'),
    ('Gastos Competiciones'),
    ('Gastos Generales del Club')
),
conversiones as (
  select
    antiguo.club_id,
    antiguo.id_concepto as id_antiguo,
    oficial.id_concepto as id_oficial
  from conceptos_antiguos listado
  join public.conceptos antiguo
    on lower(btrim(antiguo.concepto)) = lower(listado.concepto)
  join public.conceptos oficial
    on oficial.club_id = antiguo.club_id
   and lower(btrim(oficial.concepto)) = lower('Gastos varios')
)
update public.bancos movimiento
set concepto_id = conversion.id_oficial
from conversiones conversion
where movimiento.club_id = conversion.club_id
  and movimiento.concepto_id = conversion.id_antiguo;

with conceptos_antiguos(concepto) as (
  values
    ('Agua Participantes'),
    ('Gastos Competiciones'),
    ('Gastos Generales del Club')
)
delete from public.conceptos antiguo
using conceptos_antiguos listado
where lower(btrim(antiguo.concepto)) = lower(listado.concepto)
  and not exists (
    select 1 from public.contabilidad asiento
    where asiento.concepto_id = antiguo.id_concepto
  )
  and not exists (
    select 1 from public.bancos movimiento
    where movimiento.concepto_id = antiguo.id_concepto
  );

commit;
