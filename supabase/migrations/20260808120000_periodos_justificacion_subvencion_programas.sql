begin;

-- ============================================================================
-- FASE 2 DE GESTIÓN ECONÓMICA (2/4): PERIODOS DE JUSTIFICACIÓN POR PROGRAMA
--
-- Una subvención (public.subvenciones) solo tenía una fecha límite de
-- justificación única. Algunas convocatorias (EEDD, CTD) trocean la
-- justificación en varios periodos con fechas propias -por ejemplo,
-- octubre-diciembre y enero-junio de un mismo curso-.
--
-- El club ya modela cada periodo como un programa contable distinto
-- (programas.anio + programas.fecha_limite + programas.subvencion ya
-- distinguen, p.ej., "EEDD oct-dic 2025" de "EEDD ene-may 2025"). Por eso
-- esta migración no crea una tabla "periodos" nueva y desconectada: amplía
-- public.subvencion_programas -la tabla que ya une una subvención con sus
-- programas- para que cada vínculo programa-subvención tenga su propio
-- periodo y su propia fecha límite de justificación.
-- ============================================================================


-- ============================================================================
-- 1. GUARDS PREVIOS
-- ============================================================================

do $preflight$
begin
  if to_regclass('public.subvencion_programas') is null then
    raise exception 'Migración abortada: no existe public.subvencion_programas.';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'subvencion_programas'
      and column_name = 'estado'
  ) then
    raise exception 'Migración abortada: public.subvencion_programas.estado ya existe.';
  end if;
end;
$preflight$;


-- ============================================================================
-- 2. COLUMNAS DE PERIODO
-- ============================================================================

alter table public.subvencion_programas
  add column fecha_inicio_periodo date,
  add column fecha_fin_periodo date,
  add column fecha_limite_justificacion date,
  add column estado text not null default 'pendiente';

alter table public.subvencion_programas
  add constraint subvencion_programas_estado_check
  check (estado in ('pendiente', 'presentado', 'justificado'));

alter table public.subvencion_programas
  add constraint subvencion_programas_periodo_fechas_check
  check (
    fecha_fin_periodo is null
    or fecha_inicio_periodo is null
    or fecha_fin_periodo >= fecha_inicio_periodo
  );

comment on column public.subvencion_programas.fecha_inicio_periodo is
  'Inicio del periodo de justificación de este programa dentro de la subvención (opcional, para convocatorias con varios tramos).';

comment on column public.subvencion_programas.fecha_fin_periodo is
  'Fin del periodo de justificación de este programa dentro de la subvención.';

comment on column public.subvencion_programas.fecha_limite_justificacion is
  'Fecha límite de justificación específica de este programa. Si es NULL se usa subvenciones.fecha_limite_justificacion.';

comment on column public.subvencion_programas.estado is
  'Estado de justificación de este periodo/programa: pendiente, presentado o justificado.';

commit;


-- ============================================================================
-- ROLLBACK MANUAL COMPLETO
--
-- begin;
--
-- alter table public.subvencion_programas drop constraint if exists subvencion_programas_periodo_fechas_check;
-- alter table public.subvencion_programas drop constraint if exists subvencion_programas_estado_check;
-- alter table public.subvencion_programas
--   drop column if exists estado,
--   drop column if exists fecha_limite_justificacion,
--   drop column if exists fecha_fin_periodo,
--   drop column if exists fecha_inicio_periodo;
--
-- commit;
-- ============================================================================
