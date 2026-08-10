begin;

-- ============================================================================
-- REAPERTURA DE PRESUPUESTOS CERRADOS
--
-- Hasta ahora un presupuesto cerrado era inmutable: el trigger
-- validate_presupuesto_header() rechazaba cualquier UPDATE o DELETE en cuanto
-- old.estado = 'cerrado'. Esta migración sustituye esa inmutabilidad total por
-- una única transición explícita permitida: cerrado -> borrador (reapertura).
--
-- Reglas resultantes:
--   - Un presupuesto cerrado NO puede editarse ni eliminarse directamente.
--   - Puede reabrirse (estado -> 'borrador'), limpiando cerrado_at.
--   - La reapertura debe ser una operación atómica y exclusiva: no admite
--     colar cambios de cabecera (nombre, tipo, fechas, subvención...) en el
--     mismo UPDATE. Primero se reabre, después se edita como cualquier
--     borrador.
--   - Una vez en borrador, la edición, el borrado de partidas/programas y el
--     borrado de la propia cabecera siguen las reglas ya existentes para
--     borradores (sin cambios en esos triggers).
--   - Los snapshots histfricos (concepto_nombre_snapshot, naturaleza_snapshot,
--     subvencionabilidad_snapshot) de las partidas NO se limpian al reabrir:
--     la aplicación ya ignora esas columnas mientras el presupuesto está en
--     borrador, y un cierre posterior las sobrescribe siempre con el catálogo
--     vigente en ese momento.
-- ============================================================================


-- ============================================================================
-- 1. GUARDS PREVIOS
-- ============================================================================

do $preflight$
begin
  if to_regprocedure('public.validate_presupuesto_header()') is null then
    raise exception
      'Migración abortada: no existe public.validate_presupuesto_header().';
  end if;
end;
$preflight$;


-- ============================================================================
-- 2. NUEVA VERSIÓN DE validate_presupuesto_header()
-- ============================================================================

create or replace function public.validate_presupuesto_header()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_total_gastos numeric(14, 2);
  v_total_ingresos numeric(14, 2);
  v_programas_incompatibles bigint;
  v_conceptos_incompatibles bigint;
  v_total_partidas bigint;
  v_partidas_snapshot bigint;
begin
  -- Un presupuesto cerrado no puede eliminarse directamente: hay que
  -- reabrirlo primero para conservar un rastro explícito de la reapertura.
  if tg_op = 'DELETE' and old.estado = 'cerrado' then
    raise exception
      'El presupuesto % está cerrado. Reábrelo antes de eliminarlo.',
      old.id_presupuesto;
  end if;

  -- Único cambio permitido sobre una cabecera cerrada: pasar a borrador.
  if tg_op = 'UPDATE' and old.estado = 'cerrado' then
    if new.estado is distinct from 'borrador' then
      raise exception
        'El presupuesto % está cerrado. Solo puede reabrirse (volver a borrador) antes de modificarse.',
        old.id_presupuesto;
    end if;

    -- La reapertura no admite cambios simultáneos de cabecera: deben hacerse
    -- después, ya en borrador, con las reglas normales de edición.
    if new.nombre is distinct from old.nombre
       or new.tipo_programa is distinct from old.tipo_programa
       or new.subtipo_programa is distinct from old.subtipo_programa
       or new.periodo_tipo is distinct from old.periodo_tipo
       or new.anio_inicio is distinct from old.anio_inicio
       or new.anio_fin is distinct from old.anio_fin
       or new.fecha_inicio is distinct from old.fecha_inicio
       or new.fecha_fin is distinct from old.fecha_fin
       or new.subvencion_id is distinct from old.subvencion_id
       or new.observaciones is distinct from old.observaciones
       or new.club_id is distinct from old.club_id
    then
      raise exception
        'La reapertura del presupuesto % no puede combinarse con otros cambios de cabecera.',
        old.id_presupuesto;
    end if;

    new.cerrado_at := null;
    new.updated_at := now();
    return new;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  -- A partir de aquí, old.estado solo puede ser 'borrador' (o no existir, en INSERT).

  -- El club propietario es inmutable después de crear el presupuesto.
  if tg_op = 'UPDATE' and new.club_id <> old.club_id then
    raise exception
      'No se puede cambiar el club de un presupuesto existente.';
  end if;

  if tg_op = 'UPDATE' then
    -- Si cambia el tipo o el intervalo de años, todos los programas ya
    -- relacionados deben seguir siendo compatibles.
    if new.tipo_programa is distinct from old.tipo_programa
       or new.anio_inicio is distinct from old.anio_inicio
       or new.anio_fin is distinct from old.anio_fin
    then
      select count(*)
      into v_programas_incompatibles
      from public.presupuesto_programas as pp
      join public.programas as pr
        on pr.id_programa = pp.programa_id
       and pr.club_id = pp.club_id
      where pp.presupuesto_id = new.id_presupuesto
        and (
          pr.tipo_programa is distinct from new.tipo_programa
          or pr.anio is null
          or pr.anio < new.anio_inicio
          or pr.anio > new.anio_fin
        );

      if v_programas_incompatibles > 0 then
        raise exception
          'No puede cambiarse la cabecera: % programa(s) quedarían fuera del tipo o periodo del presupuesto.',
          v_programas_incompatibles;
      end if;
    end if;

    -- El cambio de familia funcional también revalida todos los conceptos.
    if new.tipo_programa is distinct from old.tipo_programa then
      select count(*)
      into v_conceptos_incompatibles
      from public.presupuesto_partidas as pp
      join public.conceptos as c
        on c.id_concepto = pp.concepto_id
       and c.club_id = pp.club_id
      where pp.presupuesto_id = new.id_presupuesto
        and (
          case new.tipo_programa
            when 'clubes' then c.valido_clubes
            when 'eventos' then c.valido_eventos
            when 'eedd_ctd_discapacidad'
              then c.valido_eedd_ctd_discapacidad
            else false
          end
        ) is not true;

      if v_conceptos_incompatibles > 0 then
        raise exception
          'No puede cambiarse el tipo: % concepto(s) quedarían incompatibles.',
          v_conceptos_incompatibles;
      end if;
    end if;

    -- Una nueva subvención debe incluir todos los programas ya asociados.
    if new.subvencion_id is distinct from old.subvencion_id
       and new.subvencion_id is not null
       and exists (
         select 1
         from public.presupuesto_programas as pp
         where pp.presupuesto_id = new.id_presupuesto
           and not exists (
             select 1
             from public.subvencion_programas as sp
             where sp.subvencion_id = new.subvencion_id
               and sp.programa_id = pp.programa_id
               and sp.club_id = new.club_id
           )
       )
    then
      raise exception
        'La nueva subvención no incluye todos los programas del presupuesto.';
    end if;
  end if;

  -- No se puede insertar una cabecera ya cerrada porque todavía no puede
  -- contener programas ni partidas.
  if tg_op = 'INSERT' and new.estado = 'cerrado' then
    raise exception
      'Un presupuesto debe crearse como borrador antes de poder cerrarse.';
  end if;

  if tg_op = 'UPDATE'
     and old.estado = 'borrador'
     and new.estado = 'cerrado'
  then
    if not exists (
      select 1
      from public.presupuesto_programas as pp
      where pp.presupuesto_id = new.id_presupuesto
    ) then
      raise exception
        'No puede cerrarse el presupuesto: no contiene programas contables.';
    end if;

    select count(*)
    into v_total_partidas
    from public.presupuesto_partidas as pp
    where pp.presupuesto_id = new.id_presupuesto;

    if v_total_partidas = 0 then
      raise exception
        'No puede cerrarse el presupuesto: no contiene partidas.';
    end if;

    -- Revalida todos los programas en el instante exacto del cierre.
    select count(*)
    into v_programas_incompatibles
    from public.presupuesto_programas as pp
    join public.programas as pr
      on pr.id_programa = pp.programa_id
     and pr.club_id = pp.club_id
    where pp.presupuesto_id = new.id_presupuesto
      and (
        pr.tipo_programa is distinct from new.tipo_programa
        or pr.anio is null
        or pr.anio < new.anio_inicio
        or pr.anio > new.anio_fin
      );

    if v_programas_incompatibles > 0 then
      raise exception
        'No puede cerrarse el presupuesto: % programa(s) son incompatibles.',
        v_programas_incompatibles;
    end if;

    -- Revalida los flags de los conceptos antes de congelar el catálogo.
    select count(*)
    into v_conceptos_incompatibles
    from public.presupuesto_partidas as pp
    join public.conceptos as c
      on c.id_concepto = pp.concepto_id
     and c.club_id = pp.club_id
    where pp.presupuesto_id = new.id_presupuesto
      and (
        case new.tipo_programa
          when 'clubes' then c.valido_clubes
          when 'eventos' then c.valido_eventos
          when 'eedd_ctd_discapacidad'
            then c.valido_eedd_ctd_discapacidad
          else false
        end
      ) is not true;

    if v_conceptos_incompatibles > 0 then
      raise exception
        'No puede cerrarse el presupuesto: % concepto(s) son incompatibles.',
        v_conceptos_incompatibles;
    end if;

    -- Congela el catálogo vigente. El JOIN incluye club_id para mantener el
    -- aislamiento incluso dentro de esta operación SECURITY DEFINER.
    update public.presupuesto_partidas as pp
    set
      concepto_nombre_snapshot = c.concepto,
      naturaleza_snapshot = c.naturaleza,
      subvencionabilidad_snapshot = c.subvencionabilidad
    from public.conceptos as c
    where pp.presupuesto_id = new.id_presupuesto
      and pp.club_id = new.club_id
      and c.id_concepto = pp.concepto_id
      and c.club_id = pp.club_id;

    get diagnostics v_partidas_snapshot = row_count;

    -- Una diferencia de recuentos significa que al menos una partida no pudo
    -- resolver su concepto. Aunque las FKs también lo protegen, esta comprobación
    -- hace que el cierre falle de forma explícita y defensiva.
    if v_partidas_snapshot <> v_total_partidas then
      raise exception
        'No puede cerrarse el presupuesto: se obtuvieron snapshots para % de % partidas.',
        v_partidas_snapshot,
        v_total_partidas;
    end if;

    -- Garantía cruzada: una cabecera cerrada nunca se confirma si alguna
    -- partida carece de cualquiera de sus tres campos históricos.
    if exists (
      select 1
      from public.presupuesto_partidas as pp
      where pp.presupuesto_id = new.id_presupuesto
        and (
          pp.concepto_nombre_snapshot is null
          or pp.naturaleza_snapshot is null
          or pp.subvencionabilidad_snapshot is null
        )
    ) then
      raise exception
        'No puede cerrarse el presupuesto: existen partidas con snapshot incompleto.';
    end if;

    -- En un presupuesto vinculado a subvención se utiliza ya el snapshot que
    -- quedará congelado. "condicionada" se permite y se advertirá en la UI.
    if new.subvencion_id is not null
       and exists (
         select 1
         from public.presupuesto_partidas as pp
         where pp.presupuesto_id = new.id_presupuesto
           and pp.subvencionabilidad_snapshot = 'no_subvencionable'
       )
    then
      raise exception
        'No puede cerrarse el presupuesto: contiene conceptos no subvencionables.';
    end if;

    -- El equilibrio se calcula desde los snapshots recién creados. No se
    -- almacenan columnas de totales y futuras modificaciones del catálogo no
    -- alterarán la interpretación histórica del cierre.
    select
      coalesce(
        sum(pp.importe_presupuestado)
          filter (where pp.naturaleza_snapshot = 'gasto'),
        0
      ),
      coalesce(
        sum(pp.importe_presupuestado)
          filter (where pp.naturaleza_snapshot = 'ingreso'),
        0
      )
    into v_total_gastos, v_total_ingresos
    from public.presupuesto_partidas as pp
    where pp.presupuesto_id = new.id_presupuesto;

    if v_total_gastos <= 0
       or v_total_ingresos <= 0
       or v_total_gastos <> v_total_ingresos
    then
      raise exception
        'No puede cerrarse el presupuesto: total de gastos = %, total de ingresos = %. Ambos deben ser mayores que cero e iguales.',
        v_total_gastos,
        v_total_ingresos;
    end if;

    new.cerrado_at := now();
  else
    new.cerrado_at := null;
  end if;

  new.updated_at := now();
  return new;
end;
$function$;

commit;


-- ============================================================================
-- ROLLBACK MANUAL (vuelve a la inmutabilidad total de los cerrados)
--
-- Copiar aquí el CREATE OR REPLACE FUNCTION anterior tal y como quedó en
-- 20260807150000_crear_presupuestos_con_snapshot_historico.sql si alguna vez
-- hay que revertir esta migración.
-- ============================================================================
