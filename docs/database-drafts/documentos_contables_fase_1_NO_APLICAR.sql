-- BORRADOR DE ARQUITECTURA.
-- NO EJECUTAR EN PRODUCCIÓN.
-- Requiere implementar previamente la FASE DOCUMENTAL 1B.

-- ============================================================================
-- FASE DOCUMENTAL 1 (versión 20260807200000; evita colisión con 20260807190000)
--
-- Introduce una cabecera documental explícita para todos los registros actuales
-- de Contabilidad salvo Nóminas (tipo_id = 3). Esta fase es deliberadamente
-- aditiva: no cambia pagos, presupuestos, subvenciones, adjuntos ni Storage.
--
-- Estrategia de migración:
--   * una fila de contabilidad genera un documento por defecto;
--   * 473/474 comparten un documento de 3.260,00 euros;
--   * 476/477 comparten un documento de 200,00 euros;
--   * 2/130, 10/271 y 11/286 permanecen separados por ser ambiguos;
--   * las Nóminas quedan sin documento_contable_id para una fase especializada.
-- ============================================================================

begin;


-- ============================================================================
-- 1. GUARDS DE ESQUEMA Y DEPENDENCIAS
--
-- La migración aborta si ya existe alguno de los objetos que va a crear o si
-- faltan tablas y funciones de seguridad requeridas. Así no se sobrescribe un
-- intento parcial ni una evolución del esquema que no haya sido auditada.
-- ============================================================================

do $schema_guards$
begin
  if to_regclass('public.documentos_contables') is not null then
    raise exception
      'Fase documental 1 cancelada: public.documentos_contables ya existe.';
  end if;

  if to_regclass('public.contabilidad') is null
     or to_regclass('public.clubes') is null
     or to_regclass('public.tipos') is null
     or to_regclass('public.proveedores') is null
     or to_regclass('public.personal') is null
  then
    raise exception
      'Fase documental 1 cancelada: falta alguna tabla base requerida.';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_attribute as a
    where a.attrelid = 'public.contabilidad'::regclass
      and a.attname = 'documento_contable_id'
      and a.attnum > 0
      and not a.attisdropped
  ) then
    raise exception
      'Fase documental 1 cancelada: contabilidad.documento_contable_id ya existe.';
  end if;

  if to_regprocedure('public.can_access_club(bigint)') is null
     or to_regprocedure('public.can_edit_club(bigint)') is null
  then
    raise exception
      'Fase documental 1 cancelada: faltan can_access_club(bigint) o can_edit_club(bigint).';
  end if;
end;
$schema_guards$;


-- Bloquea escrituras concurrentes sobre Contabilidad antes de leer cualquier
-- dato o fingerprint. De este modo nadie puede cambiar las filas auditadas
-- entre los guards y la copia. Las lecturas ordinarias siguen permitidas y la
-- transacción libera el lock automáticamente al hacer COMMIT o ROLLBACK.
lock table public.contabilidad in share row exclusive mode;


-- Una vez adquirido el lock se validan todas las precondiciones de datos. Las
-- tablas padre no se copian salvo por sus identificadores; las futuras FKs
-- compuestas protegerán esos identificadores frente a cambios concurrentes.
do $source_data_guards$
begin

  -- La cabecera exige un tipo estructurado. Las Nóminas se excluyen y cualquier
  -- fila restante sin tipo debe revisarse antes de crear documentos definitivos.
  if exists (
    select 1
    from public.contabilidad as c
    where c.tipo_id is null
  ) then
    raise exception
      'Fase documental 1 cancelada: existen filas de contabilidad sin tipo_id.';
  end if;

  -- Los importes negativos requerirían notas de crédito o devoluciones, que no
  -- forman parte de esta primera versión del modelo documental.
  if exists (
    select 1
    from public.contabilidad as c
    where c.tipo_id is distinct from 3
      and c.importe_total < 0
  ) then
    raise exception
      'Fase documental 1 cancelada: existen documentos no Nómina con importe_total negativo.';
  end if;

  -- Las FKs actuales de Contabilidad son simples y no garantizan aislamiento
  -- por club. Antes de crear las nuevas FKs compuestas se comprueba que todos
  -- los padres que se copiarán pertenecen ya al mismo club que su fila origen.
  if exists (
    select 1
    from public.contabilidad as c
    join public.proveedores as p
      on p.id_proveedor = c.proveedor_id
    where c.tipo_id is distinct from 3
      and c.club_id is distinct from p.club_id
  ) then
    raise exception
      'Fase documental 1 cancelada: existe un proveedor de otro club en Contabilidad.';
  end if;

  if exists (
    select 1
    from public.contabilidad as c
    join public.personal as p
      on p.id_personal = c.personal_id
    where c.tipo_id is distinct from 3
      and c.club_id is distinct from p.club_id
  ) then
    raise exception
      'Fase documental 1 cancelada: existe una persona de otro club en Contabilidad.';
  end if;

  if exists (
    select 1
    from public.contabilidad as c
    join public.tipos as t
      on t.id_tipo = c.tipo_id
    where c.tipo_id is distinct from 3
      and c.club_id is distinct from t.club_id
  ) then
    raise exception
      'Fase documental 1 cancelada: existe un tipo documental de otro club en Contabilidad.';
  end if;
end;
$source_data_guards$;


-- ============================================================================
-- 2. GUARD EXACTO DE LOS GRUPOS AUDITADOS
--
-- Se verifican todos los campos documentales que se copiarán, además de los
-- campos de imputación que permitieron clasificar cada grupo. Las comparaciones
-- usan IS DISTINCT FROM para que NULL también forme parte del fingerprint.
-- ============================================================================

do $audited_rows_guard$
declare
  v_changed_rows integer;
begin
  with expected (
    id_contabilidad,
    club_id,
    tipo_id,
    tipo_documento,
    proveedor_id,
    personal_id,
    numero_factura,
    fecha,
    fecha_pago,
    importe_total,
    importe_imputado,
    detalle,
    observaciones,
    programa_id,
    concepto_id,
    entidad_id,
    categoria_id
  ) as (
    values
      (2::bigint,   1::bigint, 4::bigint, 'Factura'::text, 59::bigint, null::bigint, 'S-24-2'::text,  date '2024-02-01', date '2024-02-01', 635.25::numeric, 535.50::numeric, 'Gastos Generales del Club'::text, 'Concepto anterior: Alquiler Local'::text, 5::bigint, 149::bigint, 4::bigint, 1::bigint),
      (10::bigint,  1::bigint, 2::bigint, 'SS'::text,      59::bigint, null::bigint, 'S-24-10'::text, date '2024-10-01', date '2024-10-01', 635.25::numeric, 535.50::numeric, 'Gastos Generales del Club'::text, null::text,                                  5::bigint, 118::bigint, 5::bigint, 2::bigint),
      (11::bigint,  1::bigint, 4::bigint, 'Factura'::text, 59::bigint, null::bigint, 'S-24-11'::text, date '2024-11-01', date '2024-11-04', 635.25::numeric, 535.50::numeric, 'Gastos Generales del Club'::text, 'Concepto anterior: Alquiler Local'::text, 5::bigint, 149::bigint, 5::bigint, 2::bigint),
      (130::bigint, 1::bigint, 4::bigint, 'Factura'::text, 59::bigint, null::bigint, 'S-24-2'::text,  date '2024-02-01', date '2024-02-01', 635.25::numeric, 535.50::numeric, 'Gastos Generales del Club'::text, 'Concepto anterior: Alquiler Local'::text, 1::bigint, 149::bigint, 4::bigint, 1::bigint),
      (271::bigint, 1::bigint, 4::bigint, 'Factura'::text, 59::bigint, null::bigint, 'S-24-10'::text, date '2024-10-01', date '2024-10-01', 635.25::numeric, 535.50::numeric, 'Gastos Generales del Club'::text, 'Concepto anterior: Alquiler Local'::text, 1::bigint, 149::bigint, 5::bigint, 2::bigint),
      (286::bigint, 1::bigint, 4::bigint, 'Factura'::text, 59::bigint, null::bigint, 'S-24-11'::text, date '2024-11-01', date '2024-11-04', 635.25::numeric, 535.50::numeric, 'Gastos Generales del Club'::text, 'Concepto anterior: Alquiler Local'::text, 1::bigint, 149::bigint, 5::bigint, 2::bigint),
      (473::bigint, 1::bigint, 4::bigint, 'Factura'::text, 41::bigint, null::bigint, '22'::text,      date '2023-01-10', date '2023-01-13', 3260.00::numeric, 2680.00::numeric, 'Licencias Federativas'::text, 'Concepto anterior: Gastos Federativos'::text, 4::bigint, 120::bigint, 4::bigint, 1::bigint),
      (474::bigint, 1::bigint, 4::bigint, 'Factura'::text, 41::bigint, null::bigint, '22'::text,      date '2023-01-10', date '2023-01-13', 3260.00::numeric, 580.00::numeric,  'Licencias Federativas'::text, 'Concepto anterior: Gastos Federativos'::text, 14::bigint, 120::bigint, 4::bigint, 1::bigint),
      (476::bigint, 1::bigint, 4::bigint, 'Factura'::text, 41::bigint, null::bigint, '29'::text,      date '2023-01-17', date '2023-02-27', 200.00::numeric,  120.00::numeric,  'Licencias Federativas'::text, 'Concepto anterior: Gastos Federativos'::text, 14::bigint, 120::bigint, 3::bigint, 2::bigint),
      (477::bigint, 1::bigint, 4::bigint, 'Factura'::text, 41::bigint, null::bigint, '29'::text,      date '2023-01-17', date '2023-02-27', 200.00::numeric,  80.00::numeric,   'Licencias Federativas'::text, 'Concepto anterior: Gastos Federativos'::text, 14::bigint, 120::bigint, 4::bigint, 1::bigint)
  )
  select count(*)
  into v_changed_rows
  from expected as e
  left join public.contabilidad as c
    on c.id_contabilidad = e.id_contabilidad
  where c.id_contabilidad is null
     or c.club_id is distinct from e.club_id
     or c.tipo_id is distinct from e.tipo_id
     or c.tipo_documento is distinct from e.tipo_documento
     or c.proveedor_id is distinct from e.proveedor_id
     or c.personal_id is distinct from e.personal_id
     or c.numero_factura is distinct from e.numero_factura
     or c.fecha is distinct from e.fecha
     or c.fecha_pago is distinct from e.fecha_pago
     or c.importe_total is distinct from e.importe_total
     or c.importe_imputado is distinct from e.importe_imputado
     or c.detalle is distinct from e.detalle
     or c.observaciones is distinct from e.observaciones
     or c.programa_id is distinct from e.programa_id
     or c.concepto_id is distinct from e.concepto_id
     or c.entidad_id is distinct from e.entidad_id
     or c.categoria_id is distinct from e.categoria_id;

  if v_changed_rows <> 0 then
    raise exception
      'Fase documental 1 cancelada: % filas de los grupos auditados han cambiado o faltan.',
      v_changed_rows;
  end if;
end;
$audited_rows_guard$;


-- ============================================================================
-- 3. GUARD DEL UNIVERSO DE GRUPOS MULTIFILA DE ALTA COINCIDENCIA
--
-- La clave se usa solo para detectar cambios, nunca como UNIQUE ni como regla
-- general de fusión. En la auditoría produjo exactamente cinco grupos. Dos son
-- fiables y tres ambiguos. Si aparece cualquier grupo adicional o desaparece
-- alguno, la migración aborta para que una persona revise el nuevo escenario.
-- ============================================================================

do $document_groups_guard$
declare
  v_group_count integer;
  v_unexpected_count integer;
begin
  with strong_groups as (
    select
      array_agg(c.id_contabilidad order by c.id_contabilidad) as ids
    from public.contabilidad as c
    where c.tipo_id is distinct from 3
      and nullif(lower(btrim(c.numero_factura)), '') is not null
      and c.proveedor_id is not null
      and c.fecha is not null
    group by
      c.club_id,
      c.proveedor_id,
      lower(btrim(c.numero_factura)),
      c.fecha,
      c.importe_total
    having count(*) > 1
  )
  select
    count(*),
    count(*) filter (
      where ids::text not in (
        '{2,130}',
        '{10,271}',
        '{11,286}',
        '{473,474}',
        '{476,477}'
      )
    )
  into v_group_count, v_unexpected_count
  from strong_groups;

  if v_group_count <> 5 or v_unexpected_count <> 0 then
    raise exception
      'Fase documental 1 cancelada: se esperaban 5 grupos multifila auditados y se encontraron %, con % inesperados.',
      v_group_count,
      v_unexpected_count;
  end if;
end;
$document_groups_guard$;


-- ============================================================================
-- 4. GUARD DE COHERENCIA DOCUMENTAL DE LOS DOS GRUPOS QUE SE FUSIONARÁN
--
-- Programa, concepto, entidad, categoría e importe imputado pueden variar entre
-- imputaciones. Todos los campos siguientes pertenecen a la cabecera y deben
-- coincidir antes de crear un único documento.
-- ============================================================================

do $mergeable_groups_guard$
declare
  v_group record;
begin
  for v_group in
    select pairs.first_id, pairs.second_id
    from (
      values
        (473::bigint, 474::bigint),
        (476::bigint, 477::bigint)
    ) as pairs (first_id, second_id)
  loop
    if exists (
      select 1
      from public.contabilidad as a
      join public.contabilidad as b
        on b.id_contabilidad = v_group.second_id
      where a.id_contabilidad = v_group.first_id
        and (
          a.club_id is distinct from b.club_id
          or a.tipo_id is distinct from b.tipo_id
          or a.tipo_documento is distinct from b.tipo_documento
          or a.proveedor_id is distinct from b.proveedor_id
          or a.personal_id is distinct from b.personal_id
          or a.numero_factura is distinct from b.numero_factura
          or a.fecha is distinct from b.fecha
          or a.fecha_pago is distinct from b.fecha_pago
          or a.importe_total is distinct from b.importe_total
          or a.detalle is distinct from b.detalle
          or a.observaciones is distinct from b.observaciones
        )
    ) then
      raise exception
        'Fase documental 1 cancelada: las filas % y % ya no comparten la misma cabecera documental.',
        v_group.first_id,
        v_group.second_id;
    end if;
  end loop;

  -- La suma imputada acredita que ambos grupos reparten exactamente su total.
  if (select sum(c.importe_imputado) from public.contabilidad as c where c.id_contabilidad in (473, 474)) <> 3260.00
     or (select sum(c.importe_imputado) from public.contabilidad as c where c.id_contabilidad in (476, 477)) <> 200.00
  then
    raise exception
      'Fase documental 1 cancelada: ha cambiado el equilibrio de los grupos 473/474 o 476/477.';
  end if;

  if exists (
    select 1
    from public.contabilidad as c
    where c.id_contabilidad in (473, 474, 476, 477)
      and c.tipo_id = 3
  ) then
    raise exception
      'Fase documental 1 cancelada: un grupo fusionable contiene una Nómina.';
  end if;
end;
$mergeable_groups_guard$;


-- ============================================================================
-- 5. TABLA DE CABECERAS DOCUMENTALES
--
-- No existe una clave natural UNIQUE: números nulos o reutilizados y datos
-- históricos ambiguos hacen que solo el identificador técnico sea universal.
-- Las UNIQUE auxiliares (id, club) permiten FKs compuestas y evitan referencias
-- cruzadas a tipos, proveedores o personas pertenecientes a otro club.
-- ============================================================================

alter table public.proveedores
  add constraint proveedores_id_club_documentos_key
  unique (id_proveedor, club_id);

alter table public.personal
  add constraint personal_id_club_documentos_key
  unique (id_personal, club_id);

alter table public.tipos
  add constraint tipos_id_club_documentos_key
  unique (id_tipo, club_id);

create table public.documentos_contables (
  id_documento_contable bigint generated by default as identity,
  club_id bigint not null,

  -- tipo_id es la única fuente de verdad del tipo. El texto histórico de
  -- contabilidad.tipo_documento coincide con tipos.tipo cuando está informado
  -- y es NULL en 66 filas, por lo que copiarlo añadiría una duplicidad mutable.
  tipo_id bigint not null,

  proveedor_id bigint null,
  personal_id bigint null,
  numero_documento text null,
  fecha_documento date null,
  fecha_pago_declarada date null,
  importe_total numeric(12, 2) not null,
  detalle text null,
  observaciones text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint documentos_contables_pkey
    primary key (id_documento_contable),

  constraint documentos_contables_id_club_key
    unique (id_documento_contable, club_id),

  constraint documentos_contables_importe_total_check
    check (importe_total >= 0),

  constraint documentos_contables_club_id_fkey
    foreign key (club_id)
    references public.clubes (id_club)
    on delete restrict,

  constraint documentos_contables_tipo_id_fkey
    foreign key (tipo_id, club_id)
    references public.tipos (id_tipo, club_id)
    on delete restrict,

  constraint documentos_contables_proveedor_id_fkey
    foreign key (proveedor_id, club_id)
    references public.proveedores (id_proveedor, club_id)
    on delete restrict,

  constraint documentos_contables_personal_id_fkey
    foreign key (personal_id, club_id)
    references public.personal (id_personal, club_id)
    on delete restrict
);


-- Índices de navegación. Ninguno impone una identidad documental artificial.
create index documentos_contables_club_idx
  on public.documentos_contables (club_id);

create index documentos_contables_proveedor_idx
  on public.documentos_contables (club_id, proveedor_id)
  where proveedor_id is not null;

create index documentos_contables_personal_idx
  on public.documentos_contables (club_id, personal_id)
  where personal_id is not null;

create index documentos_contables_numero_idx
  on public.documentos_contables (club_id, numero_documento)
  where numero_documento is not null;

create index documentos_contables_fecha_idx
  on public.documentos_contables (club_id, fecha_documento);


-- ============================================================================
-- 6. UPDATED_AT
--
-- El proyecto no dispone de una función genérica reutilizable. Se crea una sola
-- función específica para esta tabla y se impide su ejecución directa por
-- PUBLIC; PostgreSQL la invoca únicamente mediante el trigger.
-- ============================================================================

create function public.set_documentos_contables_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

revoke all
on function public.set_documentos_contables_updated_at()
from public, anon, authenticated, service_role;

create trigger documentos_contables_set_updated_at
before update
on public.documentos_contables
for each row
execute function public.set_documentos_contables_updated_at();


-- ============================================================================
-- 7. RELACIÓN COMPUESTA DESDE CONTABILIDAD
--
-- La columna permanece nullable. La FK compuesta hace imposible enlazar una
-- imputación con un documento de otro club. RESTRICT evita que eliminar una
-- cabecera borre o deje huérfanas sus imputaciones.
-- ============================================================================

alter table public.contabilidad
  add column documento_contable_id bigint null;

alter table public.contabilidad
  add constraint contabilidad_documento_contable_club_fkey
  foreign key (documento_contable_id, club_id)
  references public.documentos_contables (id_documento_contable, club_id)
  on delete restrict;

-- Esta constraint temporal formaliza el límite de la fase: ninguna Nómina puede
-- enlazarse hasta que exista su modelo documental especializado.
alter table public.contabilidad
  add constraint contabilidad_documento_no_nomina_check
  check (tipo_id is distinct from 3 or documento_contable_id is null);

create index contabilidad_documento_contable_idx
  on public.contabilidad (documento_contable_id)
  where documento_contable_id is not null;


-- ============================================================================
-- 8. MIGRACIÓN DE DATOS
--
-- Se crean primero los dos documentos compartidos. Después, cada fila restante
-- no Nómina recibe su propio documento. No se modifica ningún campo económico
-- existente de Contabilidad: únicamente documento_contable_id.
-- ============================================================================

do $migrate_document_headers$
declare
  v_document_id bigint;
  v_updated_count integer;
  v_source public.contabilidad%rowtype;
  v_row public.contabilidad%rowtype;
begin
  -- --------------------------------------------------------------------------
  -- Factura 22: filas 473 y 474, total documental único de 3.260,00 euros.
  -- --------------------------------------------------------------------------
  select c.*
  into strict v_source
  from public.contabilidad as c
  where c.id_contabilidad = 473
  for update;

  insert into public.documentos_contables (
    club_id,
    tipo_id,
    proveedor_id,
    personal_id,
    numero_documento,
    fecha_documento,
    fecha_pago_declarada,
    importe_total,
    detalle,
    observaciones
  ) values (
    v_source.club_id,
    v_source.tipo_id,
    v_source.proveedor_id,
    v_source.personal_id,
    v_source.numero_factura,
    v_source.fecha,
    v_source.fecha_pago,
    v_source.importe_total,
    v_source.detalle,
    v_source.observaciones
  )
  returning id_documento_contable into v_document_id;

  update public.contabilidad
  set documento_contable_id = v_document_id
  where id_contabilidad in (473, 474)
    and club_id = v_source.club_id
    and tipo_id is distinct from 3
    and documento_contable_id is null;

  get diagnostics v_updated_count = row_count;
  if v_updated_count <> 2 then
    raise exception
      'Fase documental 1 cancelada: se esperaban 2 enlaces para 473/474 y se actualizaron %.',
      v_updated_count;
  end if;

  -- --------------------------------------------------------------------------
  -- Factura 29: filas 476 y 477, total documental único de 200,00 euros.
  -- --------------------------------------------------------------------------
  select c.*
  into strict v_source
  from public.contabilidad as c
  where c.id_contabilidad = 476
  for update;

  insert into public.documentos_contables (
    club_id,
    tipo_id,
    proveedor_id,
    personal_id,
    numero_documento,
    fecha_documento,
    fecha_pago_declarada,
    importe_total,
    detalle,
    observaciones
  ) values (
    v_source.club_id,
    v_source.tipo_id,
    v_source.proveedor_id,
    v_source.personal_id,
    v_source.numero_factura,
    v_source.fecha,
    v_source.fecha_pago,
    v_source.importe_total,
    v_source.detalle,
    v_source.observaciones
  )
  returning id_documento_contable into v_document_id;

  update public.contabilidad
  set documento_contable_id = v_document_id
  where id_contabilidad in (476, 477)
    and club_id = v_source.club_id
    and tipo_id is distinct from 3
    and documento_contable_id is null;

  get diagnostics v_updated_count = row_count;
  if v_updated_count <> 2 then
    raise exception
      'Fase documental 1 cancelada: se esperaban 2 enlaces para 476/477 y se actualizaron %.',
      v_updated_count;
  end if;

  -- --------------------------------------------------------------------------
  -- Resto de documentos: una cabecera independiente por fila. Esto incluye SS
  -- (tipo_id = 2), porque una liquidación puede conservarse como documento
  -- individual sin asumir todavía su relación con Nóminas o pagos agregados.
  -- --------------------------------------------------------------------------
  for v_row in
    select c.*
    from public.contabilidad as c
    where c.tipo_id is distinct from 3
      and c.id_contabilidad not in (473, 474, 476, 477)
      and c.documento_contable_id is null
    order by c.id_contabilidad
    for update
  loop
    insert into public.documentos_contables (
      club_id,
      tipo_id,
      proveedor_id,
      personal_id,
      numero_documento,
      fecha_documento,
      fecha_pago_declarada,
      importe_total,
      detalle,
      observaciones
    ) values (
      v_row.club_id,
      v_row.tipo_id,
      v_row.proveedor_id,
      v_row.personal_id,
      v_row.numero_factura,
      v_row.fecha,
      v_row.fecha_pago,
      v_row.importe_total,
      v_row.detalle,
      v_row.observaciones
    )
    returning id_documento_contable into v_document_id;

    update public.contabilidad
    set documento_contable_id = v_document_id
    where id_contabilidad = v_row.id_contabilidad
      and club_id = v_row.club_id
      and tipo_id is distinct from 3
      and documento_contable_id is null;

    get diagnostics v_updated_count = row_count;
    if v_updated_count <> 1 then
      raise exception
        'Fase documental 1 cancelada: no se pudo enlazar de forma exclusiva contabilidad.id_contabilidad = %.',
        v_row.id_contabilidad;
    end if;
  end loop;

  -- Todas las filas no Nómina deben quedar vinculadas y todas las Nóminas deben
  -- seguir fuera de esta fase.
  if exists (
    select 1
    from public.contabilidad as c
    where c.tipo_id is distinct from 3
      and c.documento_contable_id is null
  ) then
    raise exception
      'Fase documental 1 cancelada: quedó alguna fila no Nómina sin documento.';
  end if;

  if exists (
    select 1
    from public.contabilidad as c
    where c.tipo_id = 3
      and c.documento_contable_id is not null
  ) then
    raise exception
      'Fase documental 1 cancelada: se intentó vincular una Nómina.';
  end if;

  -- Ningún documento debe quedar huérfano después de la migración inicial.
  if exists (
    select 1
    from public.documentos_contables as d
    where not exists (
      select 1
      from public.contabilidad as c
      where c.documento_contable_id = d.id_documento_contable
        and c.club_id = d.club_id
    )
  ) then
    raise exception
      'Fase documental 1 cancelada: se creó algún documento sin imputaciones.';
  end if;

  -- Revalida que todos los campos copiados coincidan con sus imputaciones. En
  -- los dos documentos compartidos esta misma consulta valida ambas filas.
  if exists (
    select 1
    from public.contabilidad as c
    join public.documentos_contables as d
      on d.id_documento_contable = c.documento_contable_id
     and d.club_id = c.club_id
    where c.tipo_id is distinct from 3
      and (
        d.tipo_id is distinct from c.tipo_id
        or d.proveedor_id is distinct from c.proveedor_id
        or d.personal_id is distinct from c.personal_id
        or d.numero_documento is distinct from c.numero_factura
        or d.fecha_documento is distinct from c.fecha
        or d.fecha_pago_declarada is distinct from c.fecha_pago
        or d.importe_total is distinct from c.importe_total
        or d.detalle is distinct from c.detalle
        or d.observaciones is distinct from c.observaciones
      )
  ) then
    raise exception
      'Fase documental 1 cancelada: alguna cabecera creada no coincide con su fuente contable.';
  end if;

  -- Los grupos ambiguos deben tener dos documentos diferentes cada uno.
  if (select count(distinct c.documento_contable_id) from public.contabilidad as c where c.id_contabilidad in (2, 130)) <> 2
     or (select count(distinct c.documento_contable_id) from public.contabilidad as c where c.id_contabilidad in (10, 271)) <> 2
     or (select count(distinct c.documento_contable_id) from public.contabilidad as c where c.id_contabilidad in (11, 286)) <> 2
  then
    raise exception
      'Fase documental 1 cancelada: algún grupo ambiguo fue fusionado.';
  end if;

  -- Los grupos fiables deben compartir exactamente una cabecera cada uno.
  if (select count(distinct c.documento_contable_id) from public.contabilidad as c where c.id_contabilidad in (473, 474)) <> 1
     or (select count(distinct c.documento_contable_id) from public.contabilidad as c where c.id_contabilidad in (476, 477)) <> 1
  then
    raise exception
      'Fase documental 1 cancelada: algún grupo fiable no comparte documento.';
  end if;
end;
$migrate_document_headers$;


-- ============================================================================
-- 9. RLS Y PERMISOS
--
-- Viewer puede leer. Owner/admin/manager pueden insertar, actualizar y borrar,
-- aunque DELETE seguirá bloqueado por la FK RESTRICT mientras haya imputaciones.
-- ============================================================================

alter table public.documentos_contables enable row level security;

create policy documentos_contables_select_by_club
on public.documentos_contables
for select
to authenticated
using (public.can_access_club(club_id));

create policy documentos_contables_insert_by_club
on public.documentos_contables
for insert
to authenticated
with check (public.can_edit_club(club_id));

create policy documentos_contables_update_by_club
on public.documentos_contables
for update
to authenticated
using (public.can_edit_club(club_id))
with check (public.can_edit_club(club_id));

create policy documentos_contables_delete_by_club
on public.documentos_contables
for delete
to authenticated
using (public.can_edit_club(club_id));

-- Los default privileges remotos conceden permisos a anon. Se revocan de forma
-- explícita para que ni la tabla ni su identity sequence queden abiertas fuera
-- del rol authenticated protegido por RLS.
revoke all
on table public.documentos_contables
from anon;

grant select, insert, update, delete
on table public.documentos_contables
to authenticated;

revoke all
on sequence public.documentos_contables_id_documento_contable_seq
from anon;

grant usage, select
on sequence public.documentos_contables_id_documento_contable_seq
to authenticated;


-- ============================================================================
-- 10. VERIFICACIONES FINALES DENTRO DE LA TRANSACCIÓN
-- ============================================================================

do $final_guards$
declare
  v_non_payroll_rows bigint;
  v_document_count bigint;
begin
  select count(*)
  into v_non_payroll_rows
  from public.contabilidad as c
  where c.tipo_id is distinct from 3;

  select count(*)
  into v_document_count
  from public.documentos_contables;

  -- Dos parejas comparten cabecera, por lo que deben existir exactamente dos
  -- documentos menos que filas no Nómina.
  if v_document_count <> v_non_payroll_rows - 2 then
    raise exception
      'Fase documental 1 cancelada: se esperaban % documentos y se crearon %.',
      v_non_payroll_rows - 2,
      v_document_count;
  end if;

  -- La FK compuesta ya valida cada enlace, pero esta consulta hace explícito el
  -- objetivo de aislamiento por club en el resultado migrado.
  if exists (
    select 1
    from public.contabilidad as c
    join public.documentos_contables as d
      on d.id_documento_contable = c.documento_contable_id
    where c.club_id is distinct from d.club_id
  ) then
    raise exception
      'Fase documental 1 cancelada: existe un enlace entre clubes diferentes.';
  end if;
end;
$final_guards$;

commit;


-- ============================================================================
-- CONSULTAS DE VERIFICACIÓN POSTERIOR (SOLO LECTURA; NO SE EJECUTAN AQUÍ)
-- ============================================================================

-- 1) Todas las filas no Nómina deben estar enlazadas y las Nóminas no.
-- select
--   count(*) filter (where tipo_id is distinct from 3 and documento_contable_id is null)
--     as no_nomina_sin_documento,
--   count(*) filter (where tipo_id = 3 and documento_contable_id is not null)
--     as nominas_vinculadas
-- from public.contabilidad;

-- 2) Los grupos fiables comparten documento y los ambiguos no.
-- select id_contabilidad, documento_contable_id
-- from public.contabilidad
-- where id_contabilidad in (2, 10, 11, 130, 271, 286, 473, 474, 476, 477)
-- order by id_contabilidad;

-- 3) 473/474 deben mostrar total documental 3.260; 476/477, 200.
-- select
--   d.id_documento_contable,
--   d.importe_total,
--   array_agg(c.id_contabilidad order by c.id_contabilidad) as imputaciones,
--   sum(c.importe_imputado) as total_imputado
-- from public.documentos_contables as d
-- join public.contabilidad as c
--   on c.documento_contable_id = d.id_documento_contable
--  and c.club_id = d.club_id
-- where c.id_contabilidad in (473, 474, 476, 477)
-- group by d.id_documento_contable, d.importe_total
-- order by min(c.id_contabilidad);

-- 4) Debe devolver cero filas: la FK compuesta impide cruces de club.
-- select c.id_contabilidad, c.club_id, d.club_id as documento_club_id
-- from public.contabilidad as c
-- join public.documentos_contables as d
--   on d.id_documento_contable = c.documento_contable_id
-- where c.club_id is distinct from d.club_id;

-- 5) Pagos, Presupuestos y sus cálculos continúan usando las columnas antiguas.
-- Estas consultas permiten comparar los totales antes y después de la migración.
-- select count(*) as pagos, coalesce(sum(importe_pagado), 0) as total_pagado
-- from public.pagos;
--
-- select programa_id, concepto_id, sum(importe_imputado) as ejecutado
-- from public.contabilidad
-- group by programa_id, concepto_id
-- order by programa_id, concepto_id;


-- ============================================================================
-- ROLLBACK COMPLETO (EJECUTAR POR SEPARADO; NO FORMA PARTE DE LA MIGRACIÓN)
--
-- Es seguro mientras esta fase siga siendo puramente aditiva y ninguna interfaz
-- haya empezado a crear cabeceras como fuente de verdad. El guard evita borrar
-- documentos huérfanos o una topología distinta de la migración inicial.
-- ============================================================================

-- begin;
--
-- do $rollback_guard$
-- declare
--   v_non_payroll_rows bigint;
--   v_document_count bigint;
-- begin
--   select count(*) into v_non_payroll_rows
--   from public.contabilidad
--   where tipo_id is distinct from 3;
--
--   select count(*) into v_document_count
--   from public.documentos_contables;
--
--   if v_document_count <> v_non_payroll_rows - 2
--      or exists (
--        select 1
--        from public.documentos_contables as d
--        where not exists (
--          select 1
--          from public.contabilidad as c
--          where c.documento_contable_id = d.id_documento_contable
--            and c.club_id = d.club_id
--        )
--      )
--   then
--     raise exception
--       'Rollback cancelado: documentos_contables ya no conserva la topología inicial.';
--   end if;
-- end;
-- $rollback_guard$;
--
-- alter table public.contabilidad
--   drop constraint contabilidad_documento_no_nomina_check;
--
-- alter table public.contabilidad
--   drop constraint contabilidad_documento_contable_club_fkey;
--
-- drop index public.contabilidad_documento_contable_idx;
--
-- alter table public.contabilidad
--   drop column documento_contable_id;
--
-- drop trigger documentos_contables_set_updated_at
--   on public.documentos_contables;
--
-- drop table public.documentos_contables;
--
-- drop function public.set_documentos_contables_updated_at();
--
-- alter table public.tipos
--   drop constraint tipos_id_club_documentos_key;
--
-- alter table public.personal
--   drop constraint personal_id_club_documentos_key;
--
-- alter table public.proveedores
--   drop constraint proveedores_id_club_documentos_key;
--
-- commit;
