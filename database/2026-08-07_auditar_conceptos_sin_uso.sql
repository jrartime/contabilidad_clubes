-- Lista conceptos sin referencias en Contabilidad ni Bancos.
-- La ausencia de referencias no implica que un concepto deba borrarse: los
-- personalizados pueden representar ingresos u otras categorías necesarias.

with conceptos_oficiales(concepto) as (
  values
    ('Personal'),
    ('Derechos federativos'),
    ('Licencias federativas'),
    ('Arbitrajes y jueces'),
    ('Desplazamientos'),
    ('Alojamiento'),
    ('Transportes'),
    ('Servicios profesionales'),
    ('Gastos sanitarios'),
    ('Seguros'),
    ('Vestuario deportivo'),
    ('Material deportivo'),
    ('Trofeos'),
    ('Premios'),
    ('Comunicación'),
    ('Material de oficina'),
    ('Imprenta'),
    ('Publicidad y propaganda'),
    ('Local o sede del club'),
    ('Otros gastos'),
    ('Subvención del Ayuntamiento de Oviedo'),
    ('Aportaciones y/o subvenciones de otras Administraciones Públicas'),
    ('Aportaciones privadas'),
    ('Recursos propios'),
    ('Otros ingresos')
),
usos_contabilidad as (
  select concepto_id, count(*) as usos
  from public.contabilidad
  where concepto_id is not null
  group by concepto_id
),
usos_bancos as (
  select concepto_id, count(*) as usos
  from public.bancos
  where concepto_id is not null
  group by concepto_id
)
select
  concepto.id_concepto,
  concepto.club_id,
  concepto.concepto,
  coalesce(contabilidad.usos, 0) as usos_contabilidad,
  coalesce(bancos.usos, 0) as usos_bancos,
  case
    when oficial.concepto is not null then 'OFICIAL: conservar'
    else 'PERSONALIZADO: revisar antes de eliminar'
  end as recomendacion
from public.conceptos concepto
left join usos_contabilidad contabilidad
  on contabilidad.concepto_id = concepto.id_concepto
left join usos_bancos bancos
  on bancos.concepto_id = concepto.id_concepto
left join conceptos_oficiales oficial
  on lower(btrim(oficial.concepto)) = lower(btrim(concepto.concepto))
where coalesce(contabilidad.usos, 0) = 0
  and coalesce(bancos.usos, 0) = 0
order by
  case when oficial.concepto is null then 0 else 1 end,
  concepto.club_id,
  concepto.concepto;
