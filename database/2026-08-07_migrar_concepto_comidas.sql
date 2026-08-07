-- Comidas -> Otros, conservando la naturaleza anterior del gasto.

begin;

do $$
begin
  if not exists (
    select 1
    from public.conceptos
    where id_concepto = 151
      and club_id = 1
      and lower(btrim(concepto)) = lower('Otros')
  ) then
    raise exception 'No existe el concepto de destino 151 (Otros) para el club 1';
  end if;
end $$;

update public.contabilidad asiento
set
  concepto_id = 151,
  observaciones = concat_ws(
    E'\n',
    nullif(btrim(asiento.observaciones), ''),
    'Concepto anterior: Comidas'
  )
where asiento.club_id = 1
  and asiento.concepto_id = 10;

update public.bancos movimiento
set concepto_id = 151
where movimiento.club_id = 1
  and movimiento.concepto_id = 10;

delete from public.conceptos antiguo
where antiguo.id_concepto = 10
  and antiguo.club_id = 1
  and lower(btrim(antiguo.concepto)) = lower('Comidas')
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
