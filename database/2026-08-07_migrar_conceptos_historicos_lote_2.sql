-- Segundo lote de equivalencias de conceptos históricos confirmado.
-- Conserva el concepto anterior en contabilidad.observaciones, actualiza también
-- bancos y elimina los conceptos antiguos únicamente si quedan sin referencias.

begin;

with equivalencias(concepto_antiguo, concepto_oficial) as (
  values
    ('Gastos Federativos', 'Derechos federativos'),
    ('Canon Circuito de ajedrez', 'Derechos federativos'),
    ('Azafata Evento', 'Servicios profesionales'),
    ('Comisiones bancarias', 'Servicios profesionales'),
    ('Software Informático y suministros web', 'Material de oficina'),
    ('Ordenador Portatil', 'Material de oficina'),
    ('IRPF alquiler 3T', 'Local o sede del club')
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

with equivalencias(concepto_antiguo, concepto_oficial) as (
  values
    ('Gastos Federativos', 'Derechos federativos'),
    ('Canon Circuito de ajedrez', 'Derechos federativos'),
    ('Azafata Evento', 'Servicios profesionales'),
    ('Comisiones bancarias', 'Servicios profesionales'),
    ('Software Informático y suministros web', 'Material de oficina'),
    ('Ordenador Portatil', 'Material de oficina'),
    ('IRPF alquiler 3T', 'Local o sede del club')
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
    ('Gastos Federativos'),
    ('Canon Circuito de ajedrez'),
    ('Azafata Evento'),
    ('Comisiones bancarias'),
    ('Software Informático y suministros web'),
    ('Ordenador Portatil'),
    ('IRPF alquiler 3T')
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
