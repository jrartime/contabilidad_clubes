-- Distingue claramente el concepto Otros de Otros ingresos.
-- Se conserva el mismo ID, por lo que todas las referencias siguen intactas.

update public.conceptos
set
  concepto = 'Otros gastos',
  naturaleza = 'gasto',
  en_listado = true,
  valido_clubes = true,
  valido_eventos = true,
  valido_eedd_ctd_discapacidad = true
where lower(btrim(concepto)) = lower('Otros');
