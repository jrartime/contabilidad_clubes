-- Unifica los conceptos de ingresos por subvenciones y separa sus reintegros.
-- Club 1: el concepto común de destino para los ingresos es id 110, Subvención.

begin;

-- Detiene la operación si el concepto de destino no es el esperado.
do $$
begin
  if not exists (
    select 1
    from public.conceptos
    where id_concepto = 110
      and club_id = 1
      and lower(btrim(concepto)) = lower('Subvención')
  ) then
    raise exception 'No existe el concepto de destino 110 (Subvención) para el club 1';
  end if;
end $$;

with conceptos_a_unificar(id_antiguo) as (
  values (106), (111), (112), (113), (114), (115), (116)
),
conversiones as (
  select
    antiguo.id_concepto as id_antiguo,
    antiguo.concepto as nombre_antiguo
  from conceptos_a_unificar listado
  join public.conceptos antiguo
    on antiguo.id_concepto = listado.id_antiguo
   and antiguo.club_id = 1
)
update public.contabilidad asiento
set
  concepto_id = 110,
  observaciones = concat_ws(
    E'\n',
    nullif(btrim(asiento.observaciones), ''),
    'Concepto anterior: ' || conversion.nombre_antiguo
  )
from conversiones conversion
where asiento.club_id = 1
  and asiento.concepto_id = conversion.id_antiguo;

update public.bancos movimiento
set concepto_id = 110
where movimiento.club_id = 1
  and movimiento.concepto_id in (106, 111, 112, 113, 114, 115, 116);

delete from public.conceptos antiguo
where antiguo.club_id = 1
  and antiguo.id_concepto in (106, 111, 112, 113, 114, 115, 116)
  and not exists (
    select 1
    from public.contabilidad asiento
    where asiento.concepto_id = antiguo.id_concepto
  )
  and not exists (
    select 1
    from public.bancos movimiento
    where movimiento.concepto_id = antiguo.id_concepto
  );

-- El reintegro no se mezcla con los ingresos por subvenciones. Antes de
-- renombrarlo se conserva su denominación histórica en los asientos existentes.
update public.contabilidad asiento
set observaciones = concat_ws(
  E'\n',
  nullif(btrim(asiento.observaciones), ''),
  'Concepto anterior: Devolución Subvención EEDD oct-dic 2023'
)
where asiento.club_id = 1
  and asiento.concepto_id = 27
  and position(
    lower('Concepto anterior: Devolución Subvención EEDD oct-dic 2023')
    in lower(coalesce(asiento.observaciones, ''))
  ) = 0;

update public.conceptos
set concepto = 'Reintegro de subvención'
where id_concepto = 27
  and club_id = 1
  and lower(btrim(concepto)) = lower('Devolución Subvención EEDD oct-dic 2023');

commit;
