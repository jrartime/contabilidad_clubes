-- Catálogo común de conceptos justificativos y detalle libre del asiento.
-- La carga es idempotente y conserva conceptos históricos que no estén en este catálogo.

alter table public.contabilidad
  add column if not exists observaciones text;

comment on column public.contabilidad.observaciones is
  'Detalle concreto del gasto asociado al concepto justificativo seleccionado.';

insert into public.conceptos (club_id, concepto)
select club.id_club, catalogo.concepto
from public.clubes club
cross join (
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
    ('Otros')
) as catalogo(concepto)
where not exists (
  select 1
  from public.conceptos existente
  where existente.club_id = club.id_club
    and lower(btrim(existente.concepto)) = lower(catalogo.concepto)
);
