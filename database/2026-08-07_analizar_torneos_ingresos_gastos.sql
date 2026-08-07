-- Consulta de solo lectura para determinar la naturaleza de:
--   2  Torneo los Prados
--   46 Torneo Pablo Morán

select
  concepto.id_concepto,
  concepto.concepto,
  'Contabilidad' as origen,
  asiento.id_contabilidad as id_registro,
  asiento.fecha_pago as fecha,
  tipo.tipo as tipo_contable,
  programa.programa,
  asiento.detalle,
  asiento.importe_total,
  asiento.importe_imputado,
  null::numeric as debe,
  null::numeric as haber,
  asiento.observaciones
from public.contabilidad asiento
join public.conceptos concepto
  on concepto.id_concepto = asiento.concepto_id
left join public.tipos tipo
  on tipo.id_tipo = asiento.tipo_id
 and tipo.club_id = asiento.club_id
left join public.programas programa
  on programa.id_programa = asiento.programa_id
 and programa.club_id = asiento.club_id
where asiento.concepto_id in (2, 46)

union all

select
  concepto.id_concepto,
  concepto.concepto,
  'Bancos' as origen,
  movimiento.id_banco as id_registro,
  movimiento.fecha_operativa as fecha,
  case
    when coalesce(movimiento.haber, 0) > 0 and coalesce(movimiento.debe, 0) = 0 then 'Revisar: movimiento en Haber'
    when coalesce(movimiento.debe, 0) > 0 and coalesce(movimiento.haber, 0) = 0 then 'Revisar: movimiento en Debe'
    else 'Revisar dirección del movimiento'
  end as tipo_contable,
  programa.programa,
  movimiento.detalle,
  movimiento.importe as importe_total,
  null::numeric as importe_imputado,
  movimiento.debe,
  movimiento.haber,
  null::text as observaciones
from public.bancos movimiento
join public.conceptos concepto
  on concepto.id_concepto = movimiento.concepto_id
left join public.programas programa
  on programa.id_programa = movimiento.programa_id
 and programa.club_id = movimiento.club_id
where movimiento.concepto_id in (2, 46)

order by id_concepto, fecha, origen, id_registro;
