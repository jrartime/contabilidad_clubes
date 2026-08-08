import Link from "next/link";
import { redirect } from "next/navigation";
import { AutoSubmitFilters } from "@/components/AutoSubmitFilters";
import { Icon } from "@/components/Icon";
import { getActiveClubId } from "@/lib/club";
import { canEditClubData, getMyClubRole } from "@/lib/clubRole";
import {
  conceptoPermitido,
  isTipoPrograma,
} from "@/lib/conceptRules";
import { normalizeDecimalString } from "@/lib/decimal";
import { buildFilterHref } from "@/lib/filters";
import { formatDateEs, formatDecimal } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { PresupuestoHeaderForm } from "./PresupuestoHeaderForm";
import {
  PresupuestoProgramas,
  type ProgramaCompatibleOption,
  type ProgramaPresupuestoItem,
} from "./PresupuestoProgramas";
import {
  PresupuestoPartidas,
  type ConceptoPresupuestoOption,
  type PresupuestoPartidaItem,
} from "./PresupuestoPartidas";
import { PresupuestoCierre, type CierreCheck } from "./PresupuestoCierre";
import {
  PresupuestoEjecucion,
  type EjecucionPresupuestoItem,
} from "./PresupuestoEjecucion";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PresupuestoRow = Database["public"]["Tables"]["presupuestos"]["Row"];
type SubvencionRow = Database["public"]["Tables"]["subvenciones"]["Row"];
type ProgramaRow = Database["public"]["Tables"]["programas"]["Row"];
type ConceptoRow = Database["public"]["Tables"]["conceptos"]["Row"];
type PartidaRow = Database["public"]["Tables"]["presupuesto_partidas"]["Row"];
type TipoPrograma = "clubes" | "eventos" | "eedd_ctd_discapacidad";
type EstadoPresupuesto = "borrador" | "cerrado";

const TIPO_LABELS: Record<TipoPrograma, string> = {
  clubes: "Clubes deportivos",
  eventos: "Eventos y competiciones",
  eedd_ctd_discapacidad: "EEDD / CTD",
};

const SUBTIPO_LABELS: Record<string, string> = {
  eedd: "Escuela Deportiva",
  ctd: "Centro de Tecnificación",
  eedd_discapacidad: "Escuela Deportiva discapacidad",
};

/** Presenta fecha y hora de actualización en el huso y formato del usuario. */
function formatUpdatedAt(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? formatDateEs(value)
    : new Intl.DateTimeFormat("es-ES", { dateStyle: "short", timeStyle: "short" }).format(date);
}

/** Resume el intervalo sin inferir programas ni ejecución presupuestaria. */
function formatPeriodo(row: PresupuestoRow) {
  const label = row.periodo_tipo === "ejercicio" ? "Ejercicio" : row.periodo_tipo === "temporada" ? "Temporada" : "Evento";
  const years = row.anio_inicio === row.anio_fin ? String(row.anio_inicio) : `${row.anio_inicio}-${row.anio_fin}`;
  return `${label} ${years}`;
}

/** Convierte un numeric(14,2) a céntimos enteros para sumar sin error binario. */
function decimalToCents(value: unknown) {
  const normalized = normalizeDecimalString(value || 0);
  const negative = normalized.startsWith("-");
  const unsigned = negative ? normalized.slice(1) : normalized;
  const [integer = "0", decimals = ""] = unsigned.split(".");
  const cents =
    BigInt(integer || "0") * BigInt(100) +
    BigInt(decimals.padEnd(2, "0").slice(0, 2) || "0");
  return negative ? -cents : cents;
}

/** Formatea céntimos; numeric(14,2) permanece dentro del entero seguro de JS. */
function formatCents(value: bigint) {
  return formatDecimal(Number(value) / 100);
}

/** Adapta el catálogo SQL a los valores cerrados que consume la interfaz. */
function toConceptoOption(row: ConceptoRow): ConceptoPresupuestoOption | null {
  if (row.naturaleza !== "gasto" && row.naturaleza !== "ingreso") return null;
  if (
    row.subvencionabilidad !== "subvencionable" &&
    row.subvencionabilidad !== "condicionada" &&
    row.subvencionabilidad !== "no_subvencionable"
  ) return null;
  if (
    row.requisito_descripcion !== "no" &&
    row.requisito_descripcion !== "opcional" &&
    row.requisito_descripcion !== "obligatoria"
  ) return null;
  return {
    id_concepto: row.id_concepto,
    concepto: row.concepto,
    en_listado: row.en_listado,
    valido_clubes: row.valido_clubes,
    valido_eventos: row.valido_eventos,
    valido_eedd_ctd_discapacidad: row.valido_eedd_ctd_discapacidad,
    naturaleza: row.naturaleza,
    requisito_descripcion: row.requisito_descripcion,
    subvencionabilidad: row.subvencionabilidad,
  };
}

/** Panel de consulta usado por viewer y por cualquier presupuesto cerrado. */
function ReadOnlyHeader({ row, subvencion }: { row: PresupuestoRow; subvencion: string | null }) {
  const values = [
    ["Nombre", row.nombre],
    ["Tipo", TIPO_LABELS[row.tipo_programa as TipoPrograma] ?? row.tipo_programa],
    ["Subtipo", row.subtipo_programa ? SUBTIPO_LABELS[row.subtipo_programa] ?? row.subtipo_programa : "-"],
    ["Periodo", formatPeriodo(row)],
    ["Fechas", `${formatDateEs(row.fecha_inicio)} – ${formatDateEs(row.fecha_fin)}`],
    ["Subvención", subvencion ?? "Presupuesto interno"],
    ["Versión", String(row.version)],
    ["Estado", row.estado],
  ];
  return (
    <div className="side-drawer-body">
      {/* Los cerrados y los viewer reciben texto, nunca inputs modificables. */}
      <dl className="presupuesto-detail-grid">
        {values.map(([label, value]) => (
          <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
        ))}
      </dl>
      {row.observaciones ? <div className="presupuesto-observaciones"><strong>Observaciones</strong><p>{row.observaciones}</p></div> : null}
    </div>
  );
}

export default async function PresupuestosPage({
  searchParams,
}: {
  searchParams?: Promise<{
    buscar?: string;
    anio?: string;
    tipo_programa?: string;
    estado?: string;
    panel?: string;
    edit?: string;
    error?: string;
    success?: string;
  }>;
}) {
  const sp = (await searchParams) ?? {};
  const buscar = String(sp.buscar ?? "").trim();
  const anioRaw = String(sp.anio ?? "").trim();
  const anio = /^\d{4}$/.test(anioRaw) ? Number(anioRaw) : null;
  const tipo = (["clubes", "eventos", "eedd_ctd_discapacidad"] as string[]).includes(String(sp.tipo_programa))
    ? (sp.tipo_programa as TipoPrograma)
    : "";
  const estado = (["borrador", "cerrado"] as string[]).includes(String(sp.estado))
    ? (sp.estado as EstadoPresupuesto)
    : "";
  const editId = /^\d+$/.test(String(sp.edit ?? "")) ? Number(sp.edit) : null;

  const supabase = await createSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) redirect("/login");

  // El club activo procede de la cookie validada contra club_miembros.
  const clubId = await getActiveClubId();
  if (!clubId) redirect("/clubs");
  const role = await getMyClubRole(clubId);
  const canEdit = canEditClubData(role);

  let query = supabase
    .from("presupuestos")
    .select("id_presupuesto, serie_id, club_id, subvencion_id, nombre, tipo_programa, subtipo_programa, periodo_tipo, anio_inicio, anio_fin, fecha_inicio, fecha_fin, version, estado, observaciones, created_by, created_at, updated_at, cerrado_at")
    .eq("club_id", clubId)
    .order("updated_at", { ascending: false });
  if (buscar) query = query.ilike("nombre", `%${buscar}%`);
  if (anio !== null) query = query.lte("anio_inicio", anio).gte("anio_fin", anio);
  if (tipo) query = query.eq("tipo_programa", tipo);
  if (estado) query = query.eq("estado", estado);

  const [{ data, error }, { data: subvencionesData, error: subvencionesError }] = await Promise.all([
    query.limit(1000),
    supabase
      .from("subvenciones")
      .select("id_subvencion, nombre, anio")
      .eq("club_id", clubId)
      .order("anio", { ascending: false })
      .order("nombre", { ascending: true }),
  ]);
  const rows = (data ?? []) as PresupuestoRow[];
  const subvenciones = (subvencionesData ?? []) as Pick<SubvencionRow, "id_subvencion" | "nombre" | "anio">[];
  const subvencionNames = new Map(subvenciones.map((item) => [item.id_subvencion, `${item.anio} · ${item.nombre}`]));

  // Un edit fuera del filtro se consulta de nuevo, siempre limitado al club activo.
  let selected = editId ? rows.find((row) => row.id_presupuesto === editId) ?? null : null;
  if (editId && !selected) {
    const { data: selectedData } = await supabase
      .from("presupuestos")
      .select("id_presupuesto, serie_id, club_id, subvencion_id, nombre, tipo_programa, subtipo_programa, periodo_tipo, anio_inicio, anio_fin, fecha_inicio, fecha_fin, version, estado, observaciones, created_by, created_at, updated_at, cerrado_at")
      .eq("club_id", clubId)
      .eq("id_presupuesto", editId)
      .maybeSingle();
    selected = selectedData as PresupuestoRow | null;
  }

  const filterParams = { buscar, anio: anioRaw, tipo_programa: tipo, estado };
  const listHref = buildFilterHref("/presupuestos", filterParams);
  const detailHref = selected
    ? buildFilterHref("/presupuestos", { ...filterParams, edit: selected.id_presupuesto })
    : listHref;
  const newHref = buildFilterHref("/presupuestos", { ...filterParams, panel: "new" });
  const showNew = canEdit && sp.panel === "new";
  const showDrawer = showNew || selected !== null;
  const selectedCanEdit = canEdit && selected?.estado === "borrador";

  let programasIncluidos: ProgramaPresupuestoItem[] = [];
  let programasCompatibles: ProgramaCompatibleOption[] = [];
  let subvencionSinProgramas = false;
  let subvencionProgramaIds: number[] | null = null;
  let programasLoadError: string | null = null;
  let programasRelacionCount = 0;
  let programasIncluidosIds: number[] = [];

  if (selected) {
    // Primero se cargan las relaciones del presupuesto y después sus programas
    // dentro del mismo club. Así también se muestran los que ahora estén inactivos.
    const { data: relacionesData, error: relacionesError } = await supabase
      .from("presupuesto_programas")
      .select("id_presupuesto_programa, programa_id")
      .eq("club_id", clubId)
      .eq("presupuesto_id", selected.id_presupuesto)
      .order("created_at", { ascending: true });

    if (relacionesError) {
      programasLoadError = relacionesError.message;
    } else {
      const relaciones = relacionesData ?? [];
      programasRelacionCount = relaciones.length;
      const incluidosIds = relaciones.map((relacion) => relacion.programa_id);
      programasIncluidosIds = incluidosIds;
      let incluidosRows: ProgramaRow[] = [];

      if (incluidosIds.length) {
        const { data: incluidosData, error: incluidosError } = await supabase
          .from("programas")
          .select("id_programa, club_id, programa, anio, activo, tipo_programa, created_at, subvencion, fecha_limite")
          .eq("club_id", clubId)
          .in("id_programa", incluidosIds)
          .order("anio", { ascending: true, nullsFirst: false })
          .order("programa", { ascending: true });
        if (incluidosError) programasLoadError = incluidosError.message;
        incluidosRows = (incluidosData ?? []) as ProgramaRow[];
      }

      const programaById = new Map(incluidosRows.map((programa) => [programa.id_programa, programa]));
      programasIncluidos = relaciones.flatMap((relacion) => {
        const programa = programaById.get(relacion.programa_id);
        return programa
          ? [{
              id_presupuesto_programa: relacion.id_presupuesto_programa,
              id_programa: programa.id_programa,
              programa: programa.programa,
              anio: programa.anio,
              activo: programa.activo,
              tipo_programa: programa.tipo_programa,
            }]
          : [];
      });

      // La relación con subvención se carga también para viewers, porque
      // forma parte del panel informativo de cierre, no solo del selector.
      if (selected.subvencion_id !== null) {
        const { data: subvencionProgramas, error: subvencionProgramasError } = await supabase
          .from("subvencion_programas")
          .select("programa_id")
          .eq("club_id", clubId)
          .eq("subvencion_id", selected.subvencion_id);
        if (subvencionProgramasError) {
          programasLoadError = subvencionProgramasError.message;
        } else {
          subvencionProgramaIds = (subvencionProgramas ?? []).map((item) => item.programa_id);
          subvencionSinProgramas = subvencionProgramaIds.length === 0;
        }
      }

      if (selectedCanEdit) {

        // Las opciones usan solo columnas estructuradas: club, tipo y año.
        // No se aplican heurísticas EEDD/CTD basadas en el nombre.
        if (!subvencionSinProgramas && !programasLoadError) {
          let compatiblesQuery = supabase
            .from("programas")
            .select("id_programa, programa, anio, activo")
            .eq("club_id", clubId)
            .eq("tipo_programa", selected.tipo_programa)
            .gte("anio", selected.anio_inicio)
            .lte("anio", selected.anio_fin)
            .order("anio", { ascending: true })
            .order("programa", { ascending: true });

          if (subvencionProgramaIds !== null) {
            compatiblesQuery = compatiblesQuery.in("id_programa", subvencionProgramaIds);
          }

          const { data: compatiblesData, error: compatiblesError } = await compatiblesQuery;
          if (compatiblesError) {
            programasLoadError = compatiblesError.message;
          } else {
            const yaIncluidos = new Set(incluidosIds);
            programasCompatibles = ((compatiblesData ?? []) as ProgramaCompatibleOption[])
              .filter((programa) => !yaIncluidos.has(programa.id_programa));
          }
        }
      }
    }
  }

  let partidas: PresupuestoPartidaItem[] = [];
  let conceptosDisponibles: ConceptoPresupuestoOption[] = [];
  let partidasLoadError: string | null = null;
  let conceptosCompatibles = true;

  if (selected) {
    // La consulta incluye ambas fuentes. El estado de la cabecera decide cuál
    // puede utilizarse: catálogo actual en borrador o snapshot en cerrado.
    const { data: partidasData, error: partidasError } = await supabase
      .from("presupuesto_partidas")
      .select("id_partida, club_id, presupuesto_id, concepto_id, descripcion, importe_presupuestado, orden, concepto_nombre_snapshot, naturaleza_snapshot, subvencionabilidad_snapshot, created_at, updated_at")
      .eq("club_id", clubId)
      .eq("presupuesto_id", selected.id_presupuesto)
      .order("orden", { ascending: true })
      .order("id_partida", { ascending: true });

    if (partidasError) {
      partidasLoadError = partidasError.message;
    } else {
      const partidasRows = (partidasData ?? []) as PartidaRow[];
      const conceptoIds = partidasRows.map((partida) => partida.concepto_id);

      if (selected.estado === "cerrado") {
        // Un cerrado nunca consulta conceptos para reconstruir nombre,
        // naturaleza o subvencionabilidad. Esto preserva su sentido aunque el
        // catálogo cambie posteriormente; concepto_id se conserva para fase 5.
        partidas = partidasRows.flatMap((partida) => {
          const naturaleza = partida.naturaleza_snapshot;
          const subvencionabilidad = partida.subvencionabilidad_snapshot;
          if (
            !partida.concepto_nombre_snapshot ||
            (naturaleza !== "gasto" && naturaleza !== "ingreso") ||
            (subvencionabilidad !== "subvencionable" &&
              subvencionabilidad !== "condicionada" &&
              subvencionabilidad !== "no_subvencionable")
          ) return [];

          return [{
            id_partida: partida.id_partida,
            concepto_id: partida.concepto_id,
            concepto: partida.concepto_nombre_snapshot,
            naturaleza,
            // Este requisito no forma parte del snapshot y no se presenta en modo histórico.
            requisito_descripcion: "opcional" as const,
            subvencionabilidad,
            descripcion: partida.descripcion,
            importe_presupuestado: partida.importe_presupuestado,
            orden: partida.orden,
            historical: true,
          }];
        });

        if (partidas.length !== partidasRows.length) {
          partidasLoadError = "Alguna partida cerrada no contiene un snapshot histórico completo.";
        }
      } else {
        let conceptosActuales: ConceptoRow[] = [];

        // En borrador se cargan también conceptos fuera de listado para que
        // una desactivación posterior no oculte una partida ya creada.
        if (conceptoIds.length) {
          const { data: conceptosData, error: conceptosError } = await supabase
            .from("conceptos")
            .select("id_concepto, club_id, concepto, created_at, en_listado, valido_clubes, valido_eventos, valido_eedd_ctd_discapacidad, naturaleza, codigo_interno, requisito_entidad_origen, requisito_descripcion, subvencionabilidad")
            .eq("club_id", clubId)
            .in("id_concepto", conceptoIds);
          if (conceptosError) partidasLoadError = conceptosError.message;
          conceptosActuales = (conceptosData ?? []) as ConceptoRow[];
        }

        const conceptoById = new Map(
          conceptosActuales
            .map(toConceptoOption)
            .filter((concepto): concepto is ConceptoPresupuestoOption => concepto !== null)
            .map((concepto) => [concepto.id_concepto, concepto])
        );

        partidas = partidasRows.flatMap((partida) => {
          const concepto = conceptoById.get(partida.concepto_id);
          if (!concepto) return [];
          return [{
            id_partida: partida.id_partida,
            concepto_id: partida.concepto_id,
            concepto: concepto.concepto,
            naturaleza: concepto.naturaleza,
            requisito_descripcion: concepto.requisito_descripcion,
            subvencionabilidad: concepto.subvencionabilidad,
            descripcion: partida.descripcion,
            importe_presupuestado: partida.importe_presupuestado,
            orden: partida.orden,
            historical: false,
          }];
        });

        conceptosCompatibles = isTipoPrograma(selected.tipo_programa) && partidas.every((partida) => {
          const concepto = conceptoById.get(partida.concepto_id);
          return concepto
            ? conceptoPermitido(selected.tipo_programa as Parameters<typeof conceptoPermitido>[0], concepto)
            : false;
        });

        if (partidas.length !== partidasRows.length && !partidasLoadError) {
          partidasLoadError = "Alguna partida no pudo resolver su concepto actual.";
        }

        if (selectedCanEdit && isTipoPrograma(selected.tipo_programa)) {
          const { data: catalogoData, error: catalogoError } = await supabase
            .from("conceptos")
            .select("id_concepto, club_id, concepto, created_at, en_listado, valido_clubes, valido_eventos, valido_eedd_ctd_discapacidad, naturaleza, codigo_interno, requisito_entidad_origen, requisito_descripcion, subvencionabilidad")
            .eq("club_id", clubId)
            .eq("en_listado", true)
            .order("naturaleza", { ascending: true })
            .order("concepto", { ascending: true });
          if (catalogoError) {
            partidasLoadError = catalogoError.message;
          } else {
            const usados = new Set(conceptoIds);
            conceptosDisponibles = ((catalogoData ?? []) as ConceptoRow[])
              .map(toConceptoOption)
              .filter((concepto): concepto is ConceptoPresupuestoOption => concepto !== null)
              .filter((concepto) => !usados.has(concepto.id_concepto))
              .filter((concepto) => conceptoPermitido(selected.tipo_programa as Parameters<typeof conceptoPermitido>[0], concepto));
          }
        }
      }
    }
  }

  let ejecucionLoadError: string | null = null;
  const ejecutadoGastosByConcepto = new Map<number, bigint>();

  if (selected && programasIncluidosIds.length && partidas.length) {
    const gastoConceptoIds = [...new Set(
      partidas
        .filter((partida) => partida.naturaleza === "gasto")
        .map((partida) => partida.concepto_id)
    )];

    if (gastoConceptoIds.length) {
      // Se consulta Contabilidad por páginas, no por partida. Normalmente solo
      // se ejecuta la primera consulta; la paginación evita truncar resultados
      // si un conjunto supera el límite de filas configurado en PostgREST.
      const pageSize = 1000;
      let offset = 0;
      let hasMore = true;
      while (hasMore) {
        const { data: movimientos, error: movimientosError } = await supabase
          .from("contabilidad")
          .select("id_contabilidad, concepto_id, importe_imputado")
          .eq("club_id", clubId)
          .in("programa_id", programasIncluidosIds)
          .in("concepto_id", gastoConceptoIds)
          .order("id_contabilidad", { ascending: true })
          .range(offset, offset + pageSize - 1);

        if (movimientosError) {
          ejecucionLoadError = movimientosError.message;
          break;
        }

        for (const movimiento of movimientos ?? []) {
          if (movimiento.concepto_id === null) continue;
          const current = ejecutadoGastosByConcepto.get(movimiento.concepto_id) ?? BigInt(0);
          ejecutadoGastosByConcepto.set(
            movimiento.concepto_id,
            current + decimalToCents(movimiento.importe_imputado)
          );
        }

        hasMore = (movimientos?.length ?? 0) === pageSize;
        offset += pageSize;
      }
    }
  }

  // La presentación ya está normalizada: borradores usan conceptos y cerrados
  // snapshots. El cruce del ejecutado se hace siempre por el concepto_id estable.
  const ejecucionItems: EjecucionPresupuestoItem[] = partidas.map((partida) => ({
    idPartida: partida.id_partida,
    conceptoId: partida.concepto_id,
    concepto: partida.concepto,
    naturaleza: partida.naturaleza,
    presupuestadoCents: decimalToCents(partida.importe_presupuestado),
    ejecutadoCents: partida.naturaleza === "gasto"
      ? ejecutadoGastosByConcepto.get(partida.concepto_id) ?? BigInt(0)
      : null,
  }));

  // Cada total se reduce en enteros; no se acumulan números decimales binarios.
  const totalGastosCents = partidas
    .filter((partida) => partida.naturaleza === "gasto")
    .map((partida) => decimalToCents(partida.importe_presupuestado))
    .reduce((total, importe) => total + importe, BigInt(0));
  const totalIngresosCents = partidas
    .filter((partida) => partida.naturaleza === "ingreso")
    .map((partida) => decimalToCents(partida.importe_presupuestado))
    .reduce((total, importe) => total + importe, BigInt(0));
  const diferenciaCents = totalIngresosCents - totalGastosCents;

  // Estas comprobaciones anticipan problemas para mejorar la UX. No autorizan
  // el cierre: el trigger vuelve a evaluarlas atómicamente al cambiar el estado.
  const programasCompatiblesParaCierre = selected
    ? !programasLoadError &&
      programasIncluidos.length === programasRelacionCount &&
      programasIncluidos.every((programa) =>
        programa.tipo_programa === selected.tipo_programa &&
        programa.anio !== null &&
        programa.anio >= selected.anio_inicio &&
        programa.anio <= selected.anio_fin
      )
    : false;
  const programasEnSubvencion = selected?.subvencion_id === null
    ? true
    : subvencionProgramaIds !== null &&
      programasIncluidos.every((programa) => subvencionProgramaIds?.includes(programa.id_programa));
  const sinConceptosNoSubvencionables = selected?.subvencion_id === null ||
    partidas.every((partida) => partida.subvencionabilidad !== "no_subvencionable");
  const cierreChecks: CierreCheck[] = selected ? [
    {
      label: `Programas incluidos: ${programasIncluidos.length}`,
      ok: programasIncluidos.length > 0 && programasIncluidos.length === programasRelacionCount,
    },
    { label: `Partidas: ${partidas.length}`, ok: partidas.length > 0 && !partidasLoadError },
    { label: `Total gastos: ${formatCents(totalGastosCents)} €`, ok: totalGastosCents > BigInt(0) },
    { label: `Total ingresos: ${formatCents(totalIngresosCents)} €`, ok: totalIngresosCents > BigInt(0) },
    {
      label: "Presupuesto equilibrado",
      ok: totalGastosCents === totalIngresosCents,
      detail: totalGastosCents === totalIngresosCents
        ? undefined
        : `Diferencia: ${formatCents(diferenciaCents)} €`,
    },
    { label: "Conceptos compatibles", ok: !partidasLoadError && conceptosCompatibles },
    ...(selected.subvencion_id !== null
      ? [{ label: "Conceptos subvencionables", ok: sinConceptosNoSubvencionables }]
      : []),
    { label: "Programas compatibles", ok: programasCompatiblesParaCierre },
    ...(selected.subvencion_id !== null
      ? [{ label: "Programas vinculados a la subvención", ok: programasEnSubvencion }]
      : []),
  ] : [];

  return (
    <div className="presupuestos-page">
      <div className="page-toolbar">
        <div>
          <h1>Presupuestos</h1>
          <p>Cabeceras presupuestarias del club activo.</p>
        </div>
        {canEdit ? (
          <Link href={newHref} className="app-action-link presupuesto-new-button" aria-label="Nuevo presupuesto">
            <Icon name="new" />
            <span>Nuevo presupuesto</span>
          </Link>
        ) : null}
      </div>

      {!canEdit ? <div className="presupuesto-info">Tu rol permite consultar presupuestos, pero no modificarlos.</div> : null}
      {sp.error ? <div className="presupuesto-error"><strong>Error:</strong> {sp.error}</div> : null}
      {sp.success ? <div className="presupuesto-success">{sp.success}</div> : null}
      {error ? <div className="presupuesto-error">Error al cargar presupuestos: {error.message}</div> : null}
      {subvencionesError ? <div className="presupuesto-error">Error al cargar subvenciones: {subvencionesError.message}</div> : null}
      {programasLoadError ? <div className="presupuesto-error">Error al cargar programas: {programasLoadError}</div> : null}
      {partidasLoadError ? <div className="presupuesto-error">Error al cargar partidas: {partidasLoadError}</div> : null}
      {ejecucionLoadError ? <div className="presupuesto-error">Error al cargar ejecución: {ejecucionLoadError}</div> : null}

      <AutoSubmitFilters action="/presupuestos" className="filters-grid presupuestos-filters">
        <label className="filter-field">
          <span>Nombre</span>
          <div className="filter-control-row">
            <input type="search" name="buscar" defaultValue={buscar} placeholder="Buscar presupuesto" />
            {buscar ? <Link href={buildFilterHref("/presupuestos", filterParams, ["buscar"])} className="filter-reset-button" aria-label="Limpiar nombre">X</Link> : null}
          </div>
        </label>
        <label className="filter-field"><span>Año</span><input type="number" name="anio" min={2000} max={2200} defaultValue={anioRaw} placeholder="Todos" /></label>
        <label className="filter-field"><span>Tipo</span><select name="tipo_programa" defaultValue={tipo}><option value="">Todos</option><option value="clubes">Clubes deportivos</option><option value="eventos">Eventos y competiciones</option><option value="eedd_ctd_discapacidad">EEDD / CTD</option></select></label>
        <label className="filter-field"><span>Estado</span><select name="estado" defaultValue={estado}><option value="">Todos</option><option value="borrador">Borrador</option><option value="cerrado">Cerrado</option></select></label>
        <Link href="/presupuestos" className="filter-reset-button" aria-label="Limpiar todos los filtros">X</Link>
      </AutoSubmitFilters>

      <div className="presupuestos-table-wrap">
        <table>
          <thead><tr><th>Nombre</th><th>Tipo</th><th>Subtipo</th><th>Periodo</th><th>Versión</th><th>Estado</th><th>Actualizado</th><th><span className="sr-only">Acciones</span></th></tr></thead>
          <tbody>
            {rows.map((row) => {
              const closed = row.estado === "cerrado";
              return (
                <tr key={row.id_presupuesto} className={closed ? "presupuesto-row-closed" : undefined}>
                  <td><strong>{row.nombre}</strong></td>
                  <td>{TIPO_LABELS[row.tipo_programa as TipoPrograma] ?? row.tipo_programa}</td>
                  <td>{row.subtipo_programa ? SUBTIPO_LABELS[row.subtipo_programa] ?? row.subtipo_programa : "-"}</td>
                  <td>{formatPeriodo(row)}</td>
                  <td>v{row.version}</td>
                  <td><span className={`presupuesto-status presupuesto-status-${row.estado}`}>{row.estado}</span></td>
                  <td>{formatUpdatedAt(row.updated_at)}</td>
                  <td>
                    <Link href={buildFilterHref("/presupuestos", { ...filterParams, edit: row.id_presupuesto })} className="icon-button icon-button-secondary tooltip-button" aria-label={canEdit && !closed ? "Editar cabecera" : "Ver presupuesto"}>
                      <Icon name={canEdit && !closed ? "edit" : "enter"} />
                    </Link>
                  </td>
                </tr>
              );
            })}
            {!rows.length ? <tr><td colSpan={8} className="presupuestos-empty">No hay presupuestos que coincidan con los filtros.</td></tr> : null}
          </tbody>
        </table>
      </div>

      {showDrawer ? (
        <>
          <Link href={listHref} className="drawer-backdrop" aria-label="Cerrar panel" />
          <aside className="side-drawer" aria-label={showNew ? "Nuevo presupuesto" : "Detalle de presupuesto"}>
            <div className="side-drawer-header">
              <div className="side-drawer-title"><span>Presupuestos</span><h2>{showNew ? "Nuevo presupuesto" : selectedCanEdit ? "Editar cabecera" : "Detalle de cabecera"}</h2></div>
              <Link href={listHref} className="icon-button icon-button-secondary tooltip-button" aria-label="Cerrar"><Icon name="logout" /></Link>
            </div>
            {showNew ? (
              <PresupuestoHeaderForm initial={null} subvenciones={subvenciones} returnTo={listHref} />
            ) : selected && selectedCanEdit ? (
              <PresupuestoHeaderForm initial={selected} subvenciones={subvenciones} returnTo={listHref} />
            ) : selected ? (
              <ReadOnlyHeader row={selected} subvencion={selected.subvencion_id ? subvencionNames.get(selected.subvencion_id) ?? null : null} />
            ) : null}
            {selected ? (
              <PresupuestoProgramas
                presupuestoId={selected.id_presupuesto}
                incluidos={programasIncluidos}
                compatibles={programasCompatibles}
                canModify={selectedCanEdit}
                subvencionSinProgramas={subvencionSinProgramas}
                returnTo={detailHref}
              />
            ) : null}
            {selected && isTipoPrograma(selected.tipo_programa) ? (
              <PresupuestoPartidas
                presupuestoId={selected.id_presupuesto}
                tipoPrograma={selected.tipo_programa}
                presupuestoConSubvencion={selected.subvencion_id !== null}
                partidas={partidas}
                conceptosDisponibles={conceptosDisponibles}
                totalGastos={formatCents(totalGastosCents)}
                totalIngresos={formatCents(totalIngresosCents)}
                diferencia={formatCents(diferenciaCents)}
                canModify={selectedCanEdit}
                returnTo={detailHref}
              />
            ) : null}
            {selected && !ejecucionLoadError ? <PresupuestoEjecucion items={ejecucionItems} /> : null}
            {selected ? (
              <PresupuestoCierre
                presupuestoId={selected.id_presupuesto}
                estado={selected.estado as EstadoPresupuesto}
                cerradoAt={selected.cerrado_at ? formatUpdatedAt(selected.cerrado_at) : null}
                checks={cierreChecks}
                canClose={selectedCanEdit}
                returnTo={detailHref}
              />
            ) : null}
          </aside>
        </>
      ) : null}

      <style>{`
        .presupuestos-page { max-width: 1200px; margin: 0 auto; padding: 16px; }
        .presupuestos-page h1 { margin: 0; font-size: 22px; font-weight: 800; }
        .presupuestos-page .page-toolbar p { margin: 4px 0 0; color: var(--muted); font-size: 13px; }
        .presupuesto-new-button { gap: 8px; color: #fff !important; background: var(--primary); }
        .presupuesto-new-button:hover { color: #fff !important; background: var(--primary-hover); }
        .presupuestos-filters { grid-template-columns: minmax(220px, 2fr) 120px minmax(190px, 1fr) 140px 30px; }
        .presupuestos-table-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: 10px; background: #fff; }
        .presupuestos-table-wrap th, .presupuestos-table-wrap td { padding: 10px; border-bottom: 1px solid var(--border); vertical-align: middle; }
        .presupuesto-row-closed { color: var(--muted); background: #f7f8fa; }
        .presupuesto-status { display: inline-flex; padding: 3px 8px; border-radius: 999px; font-size: 12px; font-weight: 750; text-transform: capitalize; }
        .presupuesto-status-borrador { color: #8a5800; background: #fff4d6; }
        .presupuesto-status-cerrado { color: #475467; background: #e9edf2; }
        .presupuesto-info, .presupuesto-error, .presupuesto-success { margin-bottom: 12px; padding: 10px; border-radius: 8px; font-size: 13px; }
        .presupuesto-info { border: 1px solid #bfd4ee; background: #f0f7ff; }
        .presupuesto-error { border: 1px solid #f5c2c2; background: #fff5f5; }
        .presupuesto-success { border: 1px solid #b9dfc1; background: #f1faf3; color: #216b32; }
        .presupuestos-empty { padding: 24px !important; text-align: center; color: var(--muted); }
        .presupuesto-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .side-drawer-body label { display: grid; gap: 6px; font-size: 13px; font-weight: 650; }
        .side-drawer-body input, .side-drawer-body select, .side-drawer-body textarea { width: 100%; }
        .presupuesto-detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 0; }
        .presupuesto-detail-grid div { padding: 10px; border: 1px solid var(--border); border-radius: 8px; }
        .presupuesto-detail-grid dt { color: var(--muted); font-size: 12px; font-weight: 700; }
        .presupuesto-detail-grid dd { margin: 4px 0 0; font-weight: 650; }
        .presupuesto-observaciones { padding: 12px; border: 1px solid var(--border); border-radius: 8px; }
        .presupuesto-observaciones p { margin: 6px 0 0; white-space: pre-wrap; }
        .presupuesto-programas-section { display: grid; gap: 12px; padding-top: 16px; border-top: 1px solid var(--border); }
        .presupuesto-programas-section h3 { margin: 0; font-size: 16px; }
        .presupuesto-programas-section > div > p { margin: 4px 0 0; color: var(--muted); font-size: 13px; }
        .presupuesto-programas-list { display: grid; gap: 8px; }
        .presupuesto-programa-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px; border: 1px solid var(--border); border-radius: 8px; }
        .presupuesto-programa-row > div { display: grid; grid-template-columns: minmax(180px, 1fr) 70px 75px; align-items: center; gap: 10px; width: 100%; }
        .programa-activo, .programa-inactivo { font-size: 12px; font-weight: 750; }
        .programa-activo { color: #28733c; }
        .programa-inactivo { color: #8a5800; }
        .presupuesto-quitar-programa { min-height: 32px; padding: 6px 10px; border: 1px solid #efc7cc; color: #a12f3c; background: #fff7f8; box-shadow: none; }
        .presupuesto-quitar-programa:hover { color: #fff; background: var(--danger); }
        .presupuesto-programa-add-form { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: end; gap: 10px; }
        .presupuesto-programa-add-form label, .presupuesto-programa-add-form select { width: 100%; }
        .presupuesto-programas-empty, .presupuesto-programas-warning { padding: 10px; border-radius: 8px; font-size: 13px; }
        .presupuesto-programas-empty { border: 1px dashed var(--border-strong); background: #fafbfc; }
        .presupuesto-programas-warning { border: 1px solid #f0cf8b; background: #fff9e8; color: #7a5100; }
        .presupuesto-partidas-section { display: grid; gap: 14px; padding-top: 16px; border-top: 1px solid var(--border); }
        .presupuesto-partidas-section h3, .partidas-naturaleza h4 { margin: 0; }
        .presupuesto-partidas-section > div > p { margin: 4px 0 0; color: var(--muted); font-size: 13px; }
        .partidas-naturaleza { display: grid; gap: 8px; padding: 12px; border: 1px solid var(--border); border-radius: 9px; }
        .partidas-naturaleza h4 { font-size: 13px; letter-spacing: .04em; text-transform: uppercase; }
        .partidas-list { display: grid; gap: 8px; }
        .partida-row { position: relative; display: grid; gap: 8px; padding: 10px; border: 1px solid #e5eaf1; border-radius: 8px; background: #fff; }
        .partida-row-header { display: flex; justify-content: space-between; gap: 12px; }
        .partida-concepto-meta { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; color: var(--muted); font-size: 11px; }
        .partida-subsidio { padding: 2px 6px; border-radius: 999px; font-weight: 750; }
        .partida-subsidio-subvencionable { color: #28733c; background: #eaf7ed; }
        .partida-subsidio-condicionada { color: #8a5800; background: #fff4d6; }
        .partida-subsidio-no_subvencionable { color: #a12f3c; background: #fff0f2; }
        .partida-warning-conditioned, .partida-warning-no-subsidio { width: 100%; padding: 6px 8px; border-radius: 6px; }
        .partida-warning-conditioned { color: #7a5100; background: #fff9e8; }
        .partida-warning-no-subsidio { color: #982b38; background: #fff0f2; font-weight: 700; }
        .partida-edit-form { display: grid; grid-template-columns: minmax(0, 1fr) 145px 36px; align-items: end; gap: 8px; }
        .partida-edit-form label, .partida-add-form label { display: grid; gap: 5px; font-size: 12px; font-weight: 650; }
        .partida-remove-form { position: absolute; top: 8px; right: 8px; transform: translateY(34px); }
        .partida-descripcion { margin: 0; color: var(--muted); font-size: 13px; white-space: pre-wrap; }
        .partidas-total, .partidas-diferencia { display: flex; justify-content: space-between; gap: 12px; padding-top: 9px; border-top: 1px solid var(--border); }
        .partidas-total { font-size: 13px; }
        .partidas-diferencia { padding: 12px; border: 1px solid var(--border-strong); border-radius: 8px; font-size: 15px; background: #f8fafc; }
        .partidas-group-empty { margin: 0; color: var(--muted); font-size: 13px; }
        .partida-add-form { display: grid; grid-template-columns: minmax(180px, 1.3fr) minmax(160px, 1fr) 130px auto; align-items: end; gap: 9px; padding: 12px; border: 1px solid var(--border); border-radius: 9px; background: #fafbfc; }
        .partida-add-form .partida-concepto-meta { grid-column: 1 / -1; }
        .presupuesto-cierre { display: grid; gap: 13px; padding: 16px 0 8px; border-top: 1px solid var(--border); }
        .presupuesto-cierre h3 { margin: 0; font-size: 16px; }
        .presupuesto-cierre > div > p { margin: 4px 0 0; color: var(--muted); font-size: 13px; }
        .presupuesto-cierre-checks { display: grid; gap: 7px; margin: 0; padding: 0; list-style: none; }
        .presupuesto-cierre-checks li { display: flex; align-items: flex-start; gap: 9px; padding: 8px 10px; border-radius: 7px; font-size: 13px; }
        .presupuesto-cierre-checks li > span { width: 18px; font-size: 16px; font-weight: 850; }
        .presupuesto-cierre-checks li div { display: grid; gap: 2px; }
        .presupuesto-cierre-checks small { color: inherit; }
        .check-ok { color: #216b32; background: #f1faf3; }
        .check-pending { color: #982b38; background: #fff0f2; }
        .presupuesto-cierre-ready, .presupuesto-cierre-pending { margin: 0; padding: 10px; border-radius: 7px; font-weight: 750; }
        .presupuesto-cierre-ready { color: #216b32; background: #f1faf3; }
        .presupuesto-cierre-pending { color: #982b38; background: #fff0f2; }
        .presupuesto-cierre-fieldset { margin: 0; padding: 0; border: 0; }
        .presupuesto-close-button { width: 100%; min-height: 40px; color: #fff; background: var(--danger); }
        .presupuesto-cierre-fieldset:disabled .presupuesto-close-button { cursor: not-allowed; opacity: .45; }
        .presupuesto-cierre-warning { margin: 0; padding: 11px; border: 1px solid #cfd6df; border-radius: 7px; background: #f4f6f8; font-weight: 700; }
        .presupuesto-ejecucion-section { display: grid; gap: 14px; padding-top: 16px; border-top: 1px solid var(--border); }
        .presupuesto-ejecucion-section h3, .presupuesto-ejecucion-group h4 { margin: 0; }
        .presupuesto-ejecucion-section > div > p { margin: 4px 0 0; color: var(--muted); font-size: 13px; }
        .presupuesto-ejecucion-group { display: grid; gap: 8px; }
        .presupuesto-ejecucion-group h4 { font-size: 13px; letter-spacing: .04em; text-transform: uppercase; }
        .presupuesto-ejecucion-table-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: 9px; }
        .presupuesto-ejecucion-table { width: 100%; min-width: 680px; border-collapse: collapse; font-size: 12px; }
        .presupuesto-ejecucion-table th, .presupuesto-ejecucion-table td { padding: 9px; border-bottom: 1px solid var(--border); text-align: right; }
        .presupuesto-ejecucion-table th:first-child, .presupuesto-ejecucion-table td:first-child { text-align: left; }
        .presupuesto-ejecucion-table thead th { color: var(--muted); background: #f8fafc; }
        .presupuesto-ejecucion-table tfoot th { border-bottom: 0; background: #f8fafc; }
        .presupuesto-ejecucion-table .ejecucion-over td, .presupuesto-ejecucion-table .ejecucion-over th { color: #a12f3c; background: #fff7f8; }
        .ejecucion-empty { color: var(--muted); text-align: center !important; }
        .presupuesto-ejecucion-note { margin: 0; padding: 10px; border: 1px solid #bfd4ee; border-radius: 8px; color: #315b7d; background: #f0f7ff; font-size: 12px; }
        @media (max-width: 800px) { .presupuestos-filters, .presupuesto-form-grid, .presupuesto-detail-grid { grid-template-columns: 1fr; } }
        @media (max-width: 620px) { .presupuesto-programa-row, .presupuesto-programa-row > div { align-items: stretch; grid-template-columns: 1fr; flex-direction: column; } .presupuesto-programa-add-form, .partida-edit-form, .partida-add-form { grid-template-columns: 1fr; } .partida-remove-form { position: static; transform: none; } }
      `}</style>
    </div>
  );
}
