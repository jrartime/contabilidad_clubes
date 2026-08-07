-- Seguridad e higiene en el Trabajo -> Servicios profesionales.

begin;

update public.contabilidad asiento
set
  concepto_id = 132,
  observaciones = concat_ws(
    E'\n',
    nullif(btrim(asiento.observaciones), ''),
    'Concepto anterior: Seguridad e higiene en el Trabajo'
  )
where asiento.club_id = 1
  and asiento.concepto_id = 16
  and exists (
    select 1
    from public.conceptos oficial
    where oficial.id_concepto = 132
      and oficial.club_id = asiento.club_id
      and lower(btrim(oficial.concepto)) = lower('Servicios profesionales')
  );

update public.bancos movimiento
set concepto_id = 132
where movimiento.club_id = 1
  and movimiento.concepto_id = 16
  and exists (
    select 1
    from public.conceptos oficial
    where oficial.id_concepto = 132
      and oficial.club_id = movimiento.club_id
      and lower(btrim(oficial.concepto)) = lower('Servicios profesionales')
  );

delete from public.conceptos antiguo
where antiguo.id_concepto = 16
  and antiguo.club_id = 1
  and lower(btrim(antiguo.concepto)) = lower('Seguridad e higiene en el Trabajo')
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

commit;
