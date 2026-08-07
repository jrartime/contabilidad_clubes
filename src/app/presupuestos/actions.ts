"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getActiveClubContext } from "@/lib/club";
import { canEditClubData, getMyClubRole } from "@/lib/clubRole";
import {
  conceptoPermitido,
  isTipoPrograma,
  type ConceptoConfigurable,
} from "@/lib/conceptRules";
import { normalizeDecimalString, parseDecimalToNumber } from "@/lib/decimal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

/** Valores cerrados que comparten formulario, TypeScript y constraints SQL. */
type TipoPrograma = "clubes" | "eventos" | "eedd_ctd_discapacidad";
type SubtipoPrograma = "eedd" | "ctd" | "eedd_discapacidad";
type PeriodoTipo = "ejercicio" | "temporada" | "evento";

/** Payload de cabecera permitido; excluye campos técnicos y de seguridad. */
type PresupuestoInsert = Database["public"]["Tables"]["presupuestos"]["Insert"];
type HeaderPayload = Pick<
  PresupuestoInsert,
  | "nombre"
  | "tipo_programa"
  | "subtipo_programa"
  | "periodo_tipo"
  | "anio_inicio"
  | "anio_fin"
  | "fecha_inicio"
  | "fecha_fin"
  | "subvencion_id"
  | "observaciones"
>;

const TIPOS_PROGRAMA = new Set<TipoPrograma>([
  "clubes",
  "eventos",
  "eedd_ctd_discapacidad",
]);
const SUBTIPOS_PROGRAMA = new Set<SubtipoPrograma>([
  "eedd",
  "ctd",
  "eedd_discapacidad",
]);
const PERIODOS = new Set<PeriodoTipo>(["ejercicio", "temporada", "evento"]);

/** Conserva solo retornos internos de Presupuestos para evitar redirects abiertos. */
function safeReturnPath(value: FormDataEntryValue | null) {
  const path = String(value ?? "");
  return path === "/presupuestos" || path.startsWith("/presupuestos?")
    ? path
    : "/presupuestos";
}

/** Añade un mensaje a la URL sin perder los filtros del listado. */
function withMessage(
  path: string,
  key: "error" | "success",
  message: string,
  keepSelection = false
) {
  const url = new URL(path, "http://local");
  url.searchParams.delete("panel");
  if (!keepSelection) url.searchParams.delete("edit");
  url.searchParams.delete(key === "error" ? "success" : "error");
  url.searchParams.set(key, message);
  return `${url.pathname}?${url.searchParams.toString()}`;
}

/** Traduce constraints conocidas y conserva el mensaje remoto como fallback. */
function readableDatabaseError(message: string) {
  if (message.includes("presupuesto_partidas_presupuesto_concepto_key")) {
    return "Este concepto ya tiene una partida en el presupuesto.";
  }
  if (message.includes("presupuesto_programas_presupuesto_programa_key")) {
    return "Este programa ya está incluido en el presupuesto.";
  }
  if (message.includes("presupuestos_subtipo_programa_check")) {
    return "El subtipo es obligatorio para EEDD / CTD y no se admite en otros tipos.";
  }
  if (message.includes("presupuestos_fechas_anios_check")) {
    return "Las fechas deben coincidir con los años inicial y final indicados.";
  }
  if (message.includes("presupuestos_fechas_check")) {
    return "La fecha final no puede ser anterior a la fecha inicial.";
  }
  if (message.includes("presupuestos_anios_check")) {
    return "El año final no puede ser anterior al año inicial.";
  }
  if (message.includes("presupuestos_subvencion_club_fkey")) {
    return "La subvención seleccionada no pertenece al club activo.";
  }
  return message;
}

/** Convierte un entero obligatorio y rechaza valores parciales o no numéricos. */
function parseInteger(value: FormDataEntryValue | null, label: string) {
  const raw = String(value ?? "").trim();
  const parsed = Number(raw);
  if (!raw || !Number.isInteger(parsed)) throw new Error(`${label} no es válido.`);
  return parsed;
}

/** Valida una fecha ISO porque es el formato enviado por input[type=date]. */
function parseDate(value: FormDataEntryValue | null, label: string) {
  const raw = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new Error(`${label} no es válida.`);
  return raw;
}

/**
 * Construye exclusivamente los campos editables. Las reglas se repiten en
 * servidor para no depender del JavaScript del formulario.
 */
function parseHeader(formData: FormData): HeaderPayload {
  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!nombre) throw new Error("El nombre del presupuesto es obligatorio.");

  const tipo = String(formData.get("tipo_programa") ?? "") as TipoPrograma;
  if (!TIPOS_PROGRAMA.has(tipo)) throw new Error("El tipo de programa no es válido.");

  const subtipoRaw = String(formData.get("subtipo_programa") ?? "").trim();
  const subtipo = subtipoRaw as SubtipoPrograma;
  if (tipo === "eedd_ctd_discapacidad" && !SUBTIPOS_PROGRAMA.has(subtipo)) {
    throw new Error("Selecciona EEDD, CTD o EEDD discapacidad.");
  }

  const periodo = String(formData.get("periodo_tipo") ?? "") as PeriodoTipo;
  if (!PERIODOS.has(periodo)) throw new Error("El tipo de periodo no es válido.");

  const anioInicio = parseInteger(formData.get("anio_inicio"), "El año inicial");
  const anioFin = parseInteger(formData.get("anio_fin"), "El año final");
  const fechaInicio = parseDate(formData.get("fecha_inicio"), "La fecha inicial");
  const fechaFin = parseDate(formData.get("fecha_fin"), "La fecha final");
  if (anioFin < anioInicio) throw new Error("El año final no puede ser anterior al inicial.");
  if (fechaFin < fechaInicio) throw new Error("La fecha final no puede ser anterior a la inicial.");
  if (Number(fechaInicio.slice(0, 4)) !== anioInicio || Number(fechaFin.slice(0, 4)) !== anioFin) {
    throw new Error("Las fechas deben coincidir con los años inicial y final.");
  }

  const subvencionRaw = String(formData.get("subvencion_id") ?? "").trim();
  const subvencionId = subvencionRaw ? Number(subvencionRaw) : null;
  if (subvencionRaw && (!Number.isInteger(subvencionId) || Number(subvencionId) <= 0)) {
    throw new Error("La subvención seleccionada no es válida.");
  }

  return {
    nombre,
    tipo_programa: tipo,
    subtipo_programa: tipo === "eedd_ctd_discapacidad" ? subtipo : null,
    periodo_tipo: periodo,
    anio_inicio: anioInicio,
    anio_fin: anioFin,
    fecha_inicio: fechaInicio,
    fecha_fin: fechaFin,
    subvencion_id: subvencionId,
    observaciones: String(formData.get("observaciones") ?? "").trim() || null,
  };
}

/**
 * Resuelve identidad, club activo, membresía y permiso de escritura en cada
 * acción. Nunca confía en un club_id procedente del navegador.
 */
async function requireEditableContext() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const activeClub = await getActiveClubContext();
  if (!activeClub) redirect("/clubs");

  const role = await getMyClubRole(activeClub.clubId);
  if (!canEditClubData(role)) redirect("/no-autorizado");

  return { supabase, clubId: activeClub.clubId };
}

/** Verifica que la subvención opcional pertenece al club activo. */
async function validateSubvencion(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  clubId: number,
  subvencionId: number | null
) {
  if (subvencionId === null) return;
  const { data, error } = await supabase
    .from("subvenciones")
    .select("id_subvencion")
    .eq("club_id", clubId)
    .eq("id_subvencion", subvencionId)
    .maybeSingle();
  if (error || !data) throw new Error("La subvención seleccionada no pertenece al club activo.");
}

/** Crea siempre una cabecera borrador; versión, serie y fechas técnicas usan defaults SQL. */
export async function createPresupuesto(formData: FormData) {
  const returnPath = safeReturnPath(formData.get("return_to"));
  try {
    const { supabase, clubId } = await requireEditableContext();
    const header = parseHeader(formData);
    await validateSubvencion(supabase, clubId, header.subvencion_id ?? null);

    const payload: PresupuestoInsert = { ...header, club_id: clubId };
    const { data, error } = await supabase
      .from("presupuestos")
      .insert(payload)
      .select("id_presupuesto")
      .single();
    if (error) throw new Error(readableDatabaseError(error.message));

    revalidatePath("/presupuestos");
    redirect(`/presupuestos?edit=${data.id_presupuesto}&success=${encodeURIComponent("Presupuesto creado.")}`);
  } catch (error) {
    // redirect() lanza internamente una excepción que Next.js debe conservar.
    if (error && typeof error === "object" && "digest" in error) throw error;
    const message = error instanceof Error ? error.message : "No se pudo crear el presupuesto.";
    redirect(withMessage(returnPath, "error", message));
  }
}

/** Actualiza solo una cabecera del club activo y vuelve a comprobar que siga en borrador. */
export async function updatePresupuestoHeader(formData: FormData) {
  const returnPath = safeReturnPath(formData.get("return_to"));
  try {
    const { supabase, clubId } = await requireEditableContext();
    const presupuestoId = parseInteger(formData.get("id_presupuesto"), "El presupuesto");

    const { data: current, error: currentError } = await supabase
      .from("presupuestos")
      .select("id_presupuesto, estado")
      .eq("club_id", clubId)
      .eq("id_presupuesto", presupuestoId)
      .maybeSingle();
    if (currentError) throw new Error(currentError.message);
    if (!current) throw new Error("El presupuesto no existe en el club activo.");
    if (current.estado !== "borrador") throw new Error("El presupuesto está cerrado y no puede editarse.");

    const header = parseHeader(formData);
    await validateSubvencion(supabase, clubId, header.subvencion_id ?? null);

    const { data: updated, error } = await supabase
      .from("presupuestos")
      .update(header)
      .eq("club_id", clubId)
      .eq("id_presupuesto", presupuestoId)
      .eq("estado", "borrador")
      .select("id_presupuesto")
      .maybeSingle();
    if (error) throw new Error(readableDatabaseError(error.message));
    if (!updated) throw new Error("El presupuesto dejó de estar disponible como borrador.");

    revalidatePath("/presupuestos");
    redirect(`/presupuestos?edit=${presupuestoId}&success=${encodeURIComponent("Cabecera actualizada.")}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    const message = error instanceof Error ? error.message : "No se pudo actualizar el presupuesto.";
    redirect(withMessage(returnPath, "error", message));
  }
}

/**
 * Carga una cabecera por ID y club activo. Además de mejorar el mensaje para
 * el usuario, evita operar sobre un presupuesto de otro club aunque se altere
 * manualmente el formulario.
 */
async function requireDraftPresupuesto(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  clubId: number,
  presupuestoId: number
) {
  const { data, error } = await supabase
    .from("presupuestos")
    .select("id_presupuesto, tipo_programa, anio_inicio, anio_fin, subvencion_id, estado")
    .eq("club_id", clubId)
    .eq("id_presupuesto", presupuestoId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("El presupuesto no existe en el club activo.");
  if (data.estado !== "borrador") {
    throw new Error("El presupuesto está cerrado y sus programas no pueden modificarse.");
  }
  return data;
}

/**
 * Asocia un programa después de repetir en servidor todas las reglas SQL:
 * club, tipo, intervalo anual, subvención y ausencia de duplicados.
 */
export async function addPresupuestoProgramaAction(formData: FormData) {
  const returnPath = safeReturnPath(formData.get("return_to"));
  try {
    const { supabase, clubId } = await requireEditableContext();
    const presupuestoId = parseInteger(formData.get("presupuesto_id"), "El presupuesto");
    const programaId = parseInteger(formData.get("programa_id"), "El programa");
    const presupuesto = await requireDraftPresupuesto(supabase, clubId, presupuestoId);

    // El filtro compuesto impide aceptar un programa de otro club.
    const { data: programa, error: programaError } = await supabase
      .from("programas")
      .select("id_programa, tipo_programa, anio")
      .eq("club_id", clubId)
      .eq("id_programa", programaId)
      .maybeSingle();
    if (programaError) throw new Error(programaError.message);
    if (!programa) throw new Error("El programa no existe en el club activo.");

    if (programa.tipo_programa !== presupuesto.tipo_programa) {
      throw new Error("El programa no tiene el mismo tipo que el presupuesto.");
    }
    if (
      programa.anio === null ||
      programa.anio < presupuesto.anio_inicio ||
      programa.anio > presupuesto.anio_fin
    ) {
      throw new Error(
        `El año del programa debe estar entre ${presupuesto.anio_inicio} y ${presupuesto.anio_fin}.`
      );
    }

    // Una subvención limita los programas a su relación explícita; nunca se
    // crean relaciones subvencion_programas automáticamente.
    if (presupuesto.subvencion_id !== null) {
      const { data: subvencionPrograma, error: subvencionProgramaError } = await supabase
        .from("subvencion_programas")
        .select("id_subvencion_programa")
        .eq("club_id", clubId)
        .eq("subvencion_id", presupuesto.subvencion_id)
        .eq("programa_id", programaId)
        .maybeSingle();
      if (subvencionProgramaError) throw new Error(subvencionProgramaError.message);
      if (!subvencionPrograma) {
        throw new Error("El programa no está asociado a la subvención del presupuesto.");
      }
    }

    const { data: duplicate, error: duplicateError } = await supabase
      .from("presupuesto_programas")
      .select("id_presupuesto_programa")
      .eq("club_id", clubId)
      .eq("presupuesto_id", presupuestoId)
      .eq("programa_id", programaId)
      .maybeSingle();
    if (duplicateError) throw new Error(duplicateError.message);
    if (duplicate) throw new Error("Este programa ya está incluido en el presupuesto.");

    const { error } = await supabase.from("presupuesto_programas").insert({
      club_id: clubId,
      presupuesto_id: presupuestoId,
      programa_id: programaId,
    });
    if (error) throw new Error(readableDatabaseError(error.message));

    revalidatePath("/presupuestos");
    redirect(withMessage(returnPath, "success", "Programa añadido al presupuesto.", true));
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    const message = error instanceof Error ? error.message : "No se pudo añadir el programa.";
    redirect(withMessage(returnPath, "error", message, true));
  }
}

/**
 * Quita una relación concreta. Primero carga la relación dentro del club
 * activo y después vuelve a comprobar permisos y estado de su presupuesto.
 */
export async function removePresupuestoProgramaAction(formData: FormData) {
  const returnPath = safeReturnPath(formData.get("return_to"));
  try {
    const { supabase, clubId } = await requireEditableContext();
    const relacionId = parseInteger(
      formData.get("id_presupuesto_programa"),
      "La relación presupuesto-programa"
    );

    const { data: relacion, error: relacionError } = await supabase
      .from("presupuesto_programas")
      .select("id_presupuesto_programa, presupuesto_id")
      .eq("club_id", clubId)
      .eq("id_presupuesto_programa", relacionId)
      .maybeSingle();
    if (relacionError) throw new Error(relacionError.message);
    if (!relacion) throw new Error("El programa incluido no existe en el club activo.");

    await requireDraftPresupuesto(supabase, clubId, relacion.presupuesto_id);

    const { data: deleted, error } = await supabase
      .from("presupuesto_programas")
      .delete()
      .eq("club_id", clubId)
      .eq("presupuesto_id", relacion.presupuesto_id)
      .eq("id_presupuesto_programa", relacionId)
      .select("id_presupuesto_programa")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!deleted) throw new Error("La relación ya no está disponible para eliminarla.");

    revalidatePath("/presupuestos");
    redirect(withMessage(returnPath, "success", "Programa retirado del presupuesto.", true));
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    const message = error instanceof Error ? error.message : "No se pudo quitar el programa.";
    redirect(withMessage(returnPath, "error", message, true));
  }
}

/** Valores del concepto necesarios para reglas, agrupación y avisos. */
type ConceptoPresupuesto = {
  id_concepto: number;
  concepto: string;
  naturaleza: string;
  requisito_descripcion: string;
  subvencionabilidad: string;
  valido_clubes: boolean;
  valido_eventos: boolean;
  valido_eedd_ctd_discapacidad: boolean;
};

/**
 * Normaliza importes con el helper común y limita la entrada a dos decimales.
 * El borrador admite cero, pero nunca importes negativos o no monetarios.
 */
function parseImportePresupuestado(value: FormDataEntryValue | null) {
  const normalized = normalizeDecimalString(value);
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    throw new Error("El importe debe ser un número positivo con un máximo de dos decimales.");
  }
  const parsed = parseDecimalToNumber(normalized);
  if (parsed === null || parsed < 0) throw new Error("El importe presupuestado no es válido.");
  return parsed;
}

/** Carga una partida garantizando simultáneamente presupuesto y club activos. */
async function requirePresupuestoPartida(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  clubId: number,
  presupuestoId: number,
  partidaId: number
) {
  const { data, error } = await supabase
    .from("presupuesto_partidas")
    .select("id_partida, concepto_id, presupuesto_id")
    .eq("club_id", clubId)
    .eq("presupuesto_id", presupuestoId)
    .eq("id_partida", partidaId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("La partida no existe en el presupuesto del club activo.");
  return data;
}

/**
 * Resuelve el concepto dentro del club y reutiliza conceptoPermitido para los
 * flags valido_* del mismo catálogo usado por Contabilidad.
 */
async function requireConceptoCompatible(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  clubId: number,
  conceptoId: number,
  tipoPrograma: string,
  descripcion: string | null
) {
  const { data, error } = await supabase
    .from("conceptos")
    .select("id_concepto, concepto, naturaleza, requisito_descripcion, subvencionabilidad, valido_clubes, valido_eventos, valido_eedd_ctd_discapacidad")
    .eq("club_id", clubId)
    .eq("id_concepto", conceptoId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("El concepto no existe en el club activo.");
  if (!isTipoPrograma(tipoPrograma)) throw new Error("El presupuesto tiene un tipo de programa no válido.");

  const concepto = data as ConceptoPresupuesto;
  const configurable: ConceptoConfigurable = {
    concepto: concepto.concepto,
    valido_clubes: concepto.valido_clubes,
    valido_eventos: concepto.valido_eventos,
    valido_eedd_ctd_discapacidad: concepto.valido_eedd_ctd_discapacidad,
    subvencionabilidad:
      concepto.subvencionabilidad === "subvencionable" ||
      concepto.subvencionabilidad === "condicionada" ||
      concepto.subvencionabilidad === "no_subvencionable"
        ? concepto.subvencionabilidad
        : undefined,
  };
  if (!conceptoPermitido(tipoPrograma, configurable)) {
    throw new Error("El concepto no es válido para el tipo de programa del presupuesto.");
  }
  if (concepto.requisito_descripcion === "obligatoria" && !descripcion) {
    throw new Error(`El concepto "${concepto.concepto}" requiere una descripción.`);
  }
  return concepto;
}

/** Añade una partida al final, sin escribir nunca las columnas snapshot. */
export async function addPresupuestoPartidaAction(formData: FormData) {
  const returnPath = safeReturnPath(formData.get("return_to"));
  try {
    const { supabase, clubId } = await requireEditableContext();
    const presupuestoId = parseInteger(formData.get("presupuesto_id"), "El presupuesto");
    const conceptoId = parseInteger(formData.get("concepto_id"), "El concepto");
    const presupuesto = await requireDraftPresupuesto(supabase, clubId, presupuestoId);
    const descripcion = String(formData.get("descripcion") ?? "").trim() || null;
    const importe = parseImportePresupuestado(formData.get("importe_presupuestado"));
    await requireConceptoCompatible(
      supabase,
      clubId,
      conceptoId,
      presupuesto.tipo_programa,
      descripcion
    );

    const { data: duplicate, error: duplicateError } = await supabase
      .from("presupuesto_partidas")
      .select("id_partida")
      .eq("club_id", clubId)
      .eq("presupuesto_id", presupuestoId)
      .eq("concepto_id", conceptoId)
      .maybeSingle();
    if (duplicateError) throw new Error(duplicateError.message);
    if (duplicate) throw new Error("Este concepto ya tiene una partida en el presupuesto.");

    // Los saltos de 10 mantienen un orden estable y dejan espacio para una
    // futura reordenación sin implementar drag & drop en esta fase.
    const { data: last, error: orderError } = await supabase
      .from("presupuesto_partidas")
      .select("orden")
      .eq("club_id", clubId)
      .eq("presupuesto_id", presupuestoId)
      .order("orden", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (orderError) throw new Error(orderError.message);
    const orden = (last?.orden ?? 0) + 10;

    const { error } = await supabase.from("presupuesto_partidas").insert({
      club_id: clubId,
      presupuesto_id: presupuestoId,
      concepto_id: conceptoId,
      descripcion,
      importe_presupuestado: importe,
      orden,
      // Los snapshots se omiten expresamente: solo el trigger de cierre puede generarlos.
    });
    if (error) throw new Error(readableDatabaseError(error.message));

    revalidatePath("/presupuestos");
    redirect(withMessage(returnPath, "success", "Partida añadida al presupuesto.", true));
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    const message = error instanceof Error ? error.message : "No se pudo añadir la partida.";
    redirect(withMessage(returnPath, "error", message, true));
  }
}

/** Actualiza descripción e importe, manteniendo inmutable el concepto asociado. */
export async function updatePresupuestoPartidaAction(formData: FormData) {
  const returnPath = safeReturnPath(formData.get("return_to"));
  try {
    const { supabase, clubId } = await requireEditableContext();
    const presupuestoId = parseInteger(formData.get("presupuesto_id"), "El presupuesto");
    const partidaId = parseInteger(formData.get("id_partida"), "La partida");
    const presupuesto = await requireDraftPresupuesto(supabase, clubId, presupuestoId);
    const partida = await requirePresupuestoPartida(supabase, clubId, presupuestoId, partidaId);
    const descripcion = String(formData.get("descripcion") ?? "").trim() || null;
    const importe = parseImportePresupuestado(formData.get("importe_presupuestado"));
    await requireConceptoCompatible(
      supabase,
      clubId,
      partida.concepto_id,
      presupuesto.tipo_programa,
      descripcion
    );

    const { data: updated, error } = await supabase
      .from("presupuesto_partidas")
      .update({ descripcion, importe_presupuestado: importe })
      .eq("club_id", clubId)
      .eq("presupuesto_id", presupuestoId)
      .eq("id_partida", partidaId)
      .select("id_partida")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!updated) throw new Error("La partida dejó de estar disponible como borrador.");

    revalidatePath("/presupuestos");
    redirect(withMessage(returnPath, "success", "Partida actualizada.", true));
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    const message = error instanceof Error ? error.message : "No se pudo actualizar la partida.";
    redirect(withMessage(returnPath, "error", message, true));
  }
}

/** Elimina una partida solo después de resolver su presupuesto y club reales. */
export async function removePresupuestoPartidaAction(formData: FormData) {
  const returnPath = safeReturnPath(formData.get("return_to"));
  try {
    const { supabase, clubId } = await requireEditableContext();
    const presupuestoId = parseInteger(formData.get("presupuesto_id"), "El presupuesto");
    const partidaId = parseInteger(formData.get("id_partida"), "La partida");
    await requireDraftPresupuesto(supabase, clubId, presupuestoId);
    await requirePresupuestoPartida(supabase, clubId, presupuestoId, partidaId);

    const { data: deleted, error } = await supabase
      .from("presupuesto_partidas")
      .delete()
      .eq("club_id", clubId)
      .eq("presupuesto_id", presupuestoId)
      .eq("id_partida", partidaId)
      .select("id_partida")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!deleted) throw new Error("La partida ya no está disponible para eliminarla.");

    revalidatePath("/presupuestos");
    redirect(withMessage(returnPath, "success", "Partida eliminada.", true));
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    const message = error instanceof Error ? error.message : "No se pudo eliminar la partida.";
    redirect(withMessage(returnPath, "error", message, true));
  }
}
