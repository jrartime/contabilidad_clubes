-- Inscripciones -> Recursos propios.
-- El detalle histórico se conserva en contabilidad.observaciones.

begin;

with conversiones as (
  select
    antiguo.club_id,
    antiguo.id_concepto as id_antiguo,
    antiguo.concepto as nombre_antiguo,
    oficial.id_concepto as id_oficial
  from public.conceptos antiguo
  join public.conceptos oficial
    on oficial.club_id = antiguo.club_id
   and lower(btrim(oficial.concepto)) = lower('Recursos propios')
  where lower(btrim(antiguo.concepto)) = lower('Inscripciones')
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

with conversiones as (
  select
    antiguo.club_id,
    antiguo.id_concepto as id_antiguo,
    oficial.id_concepto as id_oficial
  from public.conceptos antiguo
  join public.conceptos oficial
    on oficial.club_id = antiguo.club_id
   and lower(btrim(oficial.concepto)) = lower('Recursos propios')
  where lower(btrim(antiguo.concepto)) = lower('Inscripciones')
)
update public.bancos movimiento
set concepto_id = conversion.id_oficial
from conversiones conversion
where movimiento.club_id = conversion.club_id
  and movimiento.concepto_id = conversion.id_antiguo;

delete from public.conceptos antiguo
where lower(btrim(antiguo.concepto)) = lower('Inscripciones')
  and not exists (
    select 1 from public.contabilidad asiento
    where asiento.concepto_id = antiguo.id_concepto
  )
  and not exists (
    select 1 from public.bancos movimiento
    where movimiento.concepto_id = antiguo.id_concepto
  );

commit;
