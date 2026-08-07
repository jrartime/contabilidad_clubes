-- Consulta de solo lectura: localiza dónde se utiliza el concepto 10, Comidas.

select
  'Contabilidad' as origen,
  asiento.id_contabilidad as id_registro,
  asiento.fecha_pago as fecha,
  programa.programa,
  asiento.detalle,
  asiento.importe_total,
  asiento.importe_imputado,
  null::numeric as debe,
  null::numeric as haber,
  asiento.observaciones
from public.contabilidad asiento
left join public.programas programa
  on programa.id_programa = asiento.programa_id
 and programa.club_id = asiento.club_id
where asiento.concepto_id = 10

union all

select
  'Bancos' as origen,
  movimiento.id_banco as id_registro,
  movimiento.fecha_operativa as fecha,
  programa.programa,
  movimiento.detalle,
  movimiento.importe as importe_total,
  null::numeric as importe_imputado,
  movimiento.debe,
  movimiento.haber,
  null::text as observaciones
from public.bancos movimiento
left join public.programas programa
  on programa.id_programa = movimiento.programa_id
 and programa.club_id = movimiento.club_id
where movimiento.concepto_id = 10

order by fecha, origen, id_registro;
