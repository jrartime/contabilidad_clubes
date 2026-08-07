-- Convierte la pertenencia al catálogo y a cada tipo de programa en configuración editable.

alter table public.conceptos
  add column if not exists en_listado boolean not null default false,
  add column if not exists valido_clubes boolean not null default false,
  add column if not exists valido_eventos boolean not null default false,
  add column if not exists valido_eedd_ctd_discapacidad boolean not null default false;

update public.conceptos
set en_listado = lower(btrim(concepto)) in (
  'personal', 'derechos federativos', 'licencias federativas', 'arbitrajes y jueces',
  'desplazamientos', 'alojamiento', 'transportes', 'servicios profesionales',
  'gastos sanitarios', 'seguros', 'vestuario deportivo', 'material deportivo',
  'trofeos', 'premios', 'comunicación', 'material de oficina', 'imprenta',
  'publicidad y propaganda', 'local o sede del club', 'otros gastos',
  'subvención del ayuntamiento de oviedo', 'aportaciones y/o subvenciones de otras administraciones públicas',
  'aportaciones privadas', 'recursos propios', 'otros ingresos'
),
valido_clubes = lower(btrim(concepto)) in (
  'personal', 'derechos federativos', 'licencias federativas', 'arbitrajes y jueces',
  'desplazamientos', 'alojamiento', 'transportes', 'servicios profesionales', 'seguros',
  'vestuario deportivo', 'material deportivo', 'trofeos', 'premios', 'comunicación',
  'material de oficina', 'imprenta', 'publicidad y propaganda', 'local o sede del club',
  'otros gastos', 'subvención del ayuntamiento de oviedo',
  'aportaciones y/o subvenciones de otras administraciones públicas', 'aportaciones privadas',
  'recursos propios', 'otros ingresos'
),
valido_eventos = lower(btrim(concepto)) in (
  'personal', 'derechos federativos', 'arbitrajes y jueces', 'desplazamientos',
  'alojamiento', 'transportes', 'servicios profesionales', 'gastos sanitarios', 'seguros',
  'material deportivo', 'trofeos', 'premios', 'comunicación', 'material de oficina',
  'imprenta', 'publicidad y propaganda', 'otros gastos', 'subvención del ayuntamiento de oviedo',
  'aportaciones y/o subvenciones de otras administraciones públicas', 'aportaciones privadas',
  'recursos propios', 'otros ingresos'
),
valido_eedd_ctd_discapacidad = lower(btrim(concepto)) in (
  'personal', 'derechos federativos', 'arbitrajes y jueces', 'desplazamientos',
  'alojamiento', 'transportes', 'servicios profesionales', 'seguros', 'material deportivo',
  'trofeos', 'premios', 'otros gastos', 'subvención del ayuntamiento de oviedo',
  'aportaciones y/o subvenciones de otras administraciones públicas', 'aportaciones privadas',
  'recursos propios', 'otros ingresos'
);
