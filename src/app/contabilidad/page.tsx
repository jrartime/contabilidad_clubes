import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getActiveClubId } from "@/lib/club";
import { canEditClubData, getMyClubRole } from "@/lib/clubRole";
import ContabilidadTable from "./ContabilidadTable";
import { ProgramaConceptoFields } from "./ProgramaConceptoFields";
import { conceptoPermitido, isTipoPrograma } from "@/lib/conceptRules";
import { matchesGlobalSearch } from "@/lib/search";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { Icon } from "@/components/Icon";
import { AutoSubmitFilters } from "@/components/AutoSubmitFilters";
import { FileDropUpload } from "@/components/FileDropUpload";
import { buildFilterHref } from "@/lib/filters";
import { normalizeDecimalString } from "@/lib/decimal";
import {
  formatBytes,
  formatDecimal,
  toDateInputValue,
  toDecimalInputValue,
} from "@/lib/format";
import {
  deleteContabilidadWithDocsAction,
  deleteDocumentoAction,
  downloadDocumentoAction,
  uploadDocumentosAction,
} from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function toNullableBigint(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseProgramaFilterValue(v: FormDataEntryValue | null): {
  isNone: boolean;
  id: number | null;
} {
  const raw = String(v ?? "").trim();
  if (!raw) return { isNone: false, id: null };
  if (raw === "none") return { isNone: true, id: null };
  const id = Number(raw);
  return Number.isFinite(id) ? { isNone: false, id } : { isNone: false, id: null };
}

function toSelectValue(v: any): string {
  if (v === null || v === undefined || v === "") return "";
  return String(v);
}

function toNumberFromFormValue(v: FormDataEntryValue | null): number {
  const s = String(v ?? "").trim();
  const normalized = normalizeDecimalString(s);
  return Number(normalized);
}

async function upsertAsiento(formData: FormData) {
  "use server";

  const clubId = Number(formData.get("club_id"));
  const id = String(formData.get("id_contabilidad") ?? "").trim();
  const programaFilter = parseProgramaFilterValue(formData.get("programa_id_filter"));
  const proveedorFilterId = toNullableBigint(formData.get("proveedor_id_filter"));
  const tipo_id = toNullableBigint(formData.get("tipo_id"));
  const proveedor_id = toNullableBigint(formData.get("proveedor_id"));
  const concepto_id = toNullableBigint(formData.get("concepto_id"));
  const entidad_id = toNullableBigint(formData.get("entidad_id"));
  const programa_id = toNullableBigint(formData.get("programa_id"));
  const categoria_id = toNullableBigint(formData.get("categoria_id"));

  const numero_factura =
    String(formData.get("numero_factura") ?? "").trim() || null;
  const fecha = String(formData.get("fecha") ?? "").trim() || null; // YYYY-MM-DD
  const fecha_pago = String(formData.get("fecha_pago") ?? "").trim() || null;

  const importe_total = toNumberFromFormValue(formData.get("importe_total"));
  const importe_imputado = toNumberFromFormValue(formData.get("importe_imputado"));
  const detalle = String(formData.get("detalle") ?? "").trim() || null;
  const observaciones = String(formData.get("observaciones") ?? "").trim() || null;

  if (!clubId || !Number.isFinite(clubId))
    redirect("/contabilidad?error=club_id%20inv%C3%A1lido");
  if (!Number.isFinite(importe_total))
    redirect("/contabilidad?error=importe_total%20inv%C3%A1lido");
  if (!Number.isFinite(importe_imputado))
    redirect("/contabilidad?error=importe_imputado%20inv%C3%A1lido");

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const myRole = await getMyClubRole(clubId);
  if (!canEditClubData(myRole)) redirect("/no-autorizado");

  if (concepto_id) {
    const { data: concepto } = await supabase.from("conceptos").select("concepto, valido_clubes, valido_eventos, valido_eedd_ctd_discapacidad, requisito_entidad_origen, requisito_descripcion, subvencionabilidad").eq("club_id", clubId).eq("id_concepto", concepto_id).maybeSingle();
    if (!concepto) redirect("/contabilidad?error=" + encodeURIComponent("Concepto no válido."));
    if (programa_id) {
      const { data: programa } = await supabase.from("programas").select("tipo_programa").eq("club_id", clubId).eq("id_programa", programa_id).maybeSingle();
      if (!programa || !isTipoPrograma(programa.tipo_programa) || !conceptoPermitido(programa.tipo_programa, concepto)) {
      redirect("/contabilidad?error=" + encodeURIComponent("El concepto seleccionado no es válido para el tipo de programa."));
      }
    }
    if (concepto.requisito_entidad_origen === "obligatoria" && !entidad_id) {
      redirect("/contabilidad?error=" + encodeURIComponent("Este concepto requiere indicar la entidad de origen."));
    }
    if (concepto.requisito_descripcion === "obligatoria" && !observaciones) {
      redirect("/contabilidad?error=" + encodeURIComponent("Este concepto requiere una descripción adicional en observaciones."));
    }
    if (concepto.subvencionabilidad === "no_subvencionable" && importe_imputado !== 0) {
      redirect("/contabilidad?error=" + encodeURIComponent("Los gastos no subvencionables deben tener un importe imputado de 0,00 €."));
    }
  }

  const payload: any = {
    club_id: clubId,
    tipo_id,
    proveedor_id,
    concepto_id,
    entidad_id,
    programa_id,
    categoria_id,
    numero_factura,
    fecha: fecha || null,
    fecha_pago: fecha_pago || null,
    importe_total,
    importe_imputado,
    detalle,
    observaciones,
  };

  const { error } = id
    ? await supabase
        .from("contabilidad")
        .update(payload)
        .eq("club_id", clubId)
        .eq("id_contabilidad", Number(id))
    : await supabase.from("contabilidad").insert(payload);

  const redirectTo = String(formData.get("redirect_to") ?? "").trim();

  if (error) {
    if (redirectTo) {
      const sep = redirectTo.includes("?") ? "&" : "?";
      redirect(`${redirectTo}${sep}error=${encodeURIComponent(error.message)}`);
    }
    const redirectParams = new URLSearchParams();
    if (programaFilter.isNone) redirectParams.set("programa_id", "none");
    if (programaFilter.id) redirectParams.set("programa_id", String(programaFilter.id));
    if (proveedorFilterId) redirectParams.set("proveedor_id", String(proveedorFilterId));
    redirect(`/contabilidad?${redirectParams.toString()}&error=${encodeURIComponent(error.message)}`);
  }

  if (redirectTo) redirect(redirectTo);

  const redirectParams = new URLSearchParams();
  if (programaFilter.isNone) redirectParams.set("programa_id", "none");
  if (programaFilter.id) redirectParams.set("programa_id", String(programaFilter.id));
  if (proveedorFilterId) redirectParams.set("proveedor_id", String(proveedorFilterId));
  redirect(
    redirectParams.toString()
      ? `/contabilidad?${redirectParams.toString()}`
      : "/contabilidad"
  );
}


async function duplicateAsiento(formData: FormData) {
  "use server";

  const clubId = Number(formData.get("club_id"));
  const id = Number(formData.get("id_contabilidad"));
  const programaFilter = parseProgramaFilterValue(formData.get("programa_id_filter"));
  const proveedorFilterId = toNullableBigint(formData.get("proveedor_id_filter"));
  const redirectTo = String(formData.get("redirect_to") ?? "").trim();

  if (!clubId || !Number.isFinite(clubId))
    redirect("/contabilidad?error=club_id%20inv%C3%A1lido");
  if (!id || !Number.isFinite(id))
    redirect("/contabilidad?error=id_contabilidad%20inv%C3%A1lido");

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const myRole = await getMyClubRole(clubId);
  if (!canEditClubData(myRole)) redirect("/no-autorizado");

  // Build base redirect params (from redirect_to or fallback filter inputs)
  const redirectParams = redirectTo
    ? new URLSearchParams(redirectTo.includes("?") ? redirectTo.split("?")[1] : "")
    : (() => {
        const p = new URLSearchParams();
        if (programaFilter.isNone) p.set("programa_id", "none");
        if (programaFilter.id) p.set("programa_id", String(programaFilter.id));
        if (proveedorFilterId) p.set("proveedor_id", String(proveedorFilterId));
        return p;
      })();

  // Leer el asiento original
  const { data: original, error: readErr } = await supabase
    .from("contabilidad")
    .select(
      [
        "tipo_id",
        "proveedor_id",
        "personal_id",
        "concepto_id",
        "entidad_id",
        "programa_id",
        "categoria_id",
        "numero_factura",
        "fecha",
        "fecha_pago",
        "importe_total",
        "importe_imputado",
        "detalle",
        "observaciones",
      ].join(",")
    )
    .eq("club_id", clubId)
    .eq("id_contabilidad", id)
    .maybeSingle();

  if (readErr || !original) {
    redirect(
      `/contabilidad?${redirectParams.toString()}&error=` +
        encodeURIComponent(readErr?.message ?? "No se encontro el asiento a duplicar")
    );
  }

  // Insertar nuevo (copia) con limpieza
  const originalPayload = original as unknown as Record<string, unknown>;
  const payload = {
    club_id: clubId,
    ...originalPayload,
    numero_factura: null,
    fecha_pago: null,
  };

  const { data: inserted, error: insErr } = await supabase
    .from("contabilidad")
    .insert(payload)
    .select("id_contabilidad")
    .single();

  if (insErr || !inserted) {
    redirect(
      `/contabilidad?${redirectParams.toString()}&error=` +
        encodeURIComponent(insErr?.message ?? "Error duplicando asiento")
    );
  }

  // Editar el nuevo
  const editParams = new URLSearchParams(redirectParams);
  editParams.set("edit", String(inserted.id_contabilidad));
  redirect(`/contabilidad?${editParams.toString()}#form`);
}



export default async function ContabilidadPage({
  searchParams,
}: {
  searchParams?: Promise<{
    error?: string;
    edit?: string;
    panel?: string;
    programa_id?: string;
    proveedor_id?: string;
    personal_id?: string;
    tipo_id?: string;
    categoria_id?: string;
    concepto_id?: string;
    fecha_desde?: string;
    fecha_hasta?: string;
    page?: string;
    buscar?: string;
  }>;
}) {
  const sp = (await searchParams) ?? {};

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) redirect("/login");

  const clubId = await getActiveClubId();
  if (!clubId) redirect("/clubs");

  const myRole = await getMyClubRole(clubId);
  const canUserEdit = canEditClubData(myRole);

  const errorMsg = sp.error ? decodeURIComponent(sp.error) : null;
  const editId = sp.edit ? Number(sp.edit) : null;
  const isNewPanel = sp.panel === "new";
  const programaFilterRaw = String(sp.programa_id ?? "").trim();
  const isProgramaNoneFilter = programaFilterRaw === "none";
  const programaFilterId = programaFilterRaw ? Number(programaFilterRaw) : null;
  const hasProgramaFilter =
    isProgramaNoneFilter ||
    (!!programaFilterId && Number.isFinite(programaFilterId));
  const proveedorFilterId = sp.proveedor_id ? Number(sp.proveedor_id) : null;
  const hasProveedorFilter =
    !!proveedorFilterId && Number.isFinite(proveedorFilterId);
  const personalFilterId = sp.personal_id ? Number(sp.personal_id) : null;
  const hasPersonalFilter =
    !!personalFilterId && Number.isFinite(personalFilterId);
  const tipoFilterId = sp.tipo_id ? Number(sp.tipo_id) : null;
  const hasTipoFilter = !!tipoFilterId && Number.isFinite(tipoFilterId);
  const categoriaFilterId = sp.categoria_id ? Number(sp.categoria_id) : null;
  const hasCategoriaFilter = !!categoriaFilterId && Number.isFinite(categoriaFilterId);
  const conceptoFilterId = sp.concepto_id ? Number(sp.concepto_id) : null;
  const hasConceptoFilter = !!conceptoFilterId && Number.isFinite(conceptoFilterId);
  const fechaDesde = String(sp.fecha_desde ?? "").trim();
  const fechaHasta = String(sp.fecha_hasta ?? "").trim();
  const buscar = String(sp.buscar ?? "").trim();
  const PAGE_SIZE = 50;
  const pageRaw = Number(sp.page ?? 1);
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.trunc(pageRaw) : 1;
  const offset = (page - 1) * PAGE_SIZE;
  const programaFilterValue = hasProgramaFilter
    ? isProgramaNoneFilter
      ? "none"
      : String(programaFilterId)
    : null;
  const proveedorFilterValue = hasProveedorFilter ? String(proveedorFilterId) : null;

  const exportParams = new URLSearchParams();
  if (hasProgramaFilter) {
    exportParams.set(
      "programa_id",
      isProgramaNoneFilter ? "none" : String(programaFilterId)
    );
  }
  if (hasProveedorFilter) exportParams.set("proveedor_id", String(proveedorFilterId));
  if (hasPersonalFilter) exportParams.set("personal_id", String(personalFilterId));
  if (hasTipoFilter) exportParams.set("tipo_id", String(tipoFilterId));
  if (hasCategoriaFilter) exportParams.set("categoria_id", String(categoriaFilterId));
  if (hasConceptoFilter) exportParams.set("concepto_id", String(conceptoFilterId));
  if (fechaDesde) exportParams.set("fecha_desde", fechaDesde);
  if (fechaHasta) exportParams.set("fecha_hasta", fechaHasta);
  if (buscar) exportParams.set("buscar", buscar);
  const exportHref = exportParams.toString()
    ? `/contabilidad/export?${exportParams.toString()}`
    : `/contabilidad/export`;
  const justificantesHref = exportParams.toString()
    ? `/contabilidad/relacion-justificantes/export?${exportParams.toString()}`
    : `/contabilidad/relacion-justificantes/export`;


  // Programas primero (solo activos) para poder filtrar la query principal
  const { data: programas } = await supabase
    .from("programas")
    .select("id_programa, programa, subvencion, fecha_limite, anio, tipo_programa")
    .eq("club_id", clubId)
    .eq("activo", true)
    .order("programa", { ascending: true });

  const activeProgramIds = (programas ?? []).map((p: any) => Number(p.id_programa));

  // Query de totales: mismos filtros que la principal, sin limit, solo campos necesarios
  let totalsQ = supabase
    .from("contabilidad")
    .select("importe_total, importe_imputado, categoria_id, programa_id, concepto_id")
    .eq("club_id", clubId);
  if (hasProgramaFilter) {
    totalsQ = isProgramaNoneFilter
      ? totalsQ.is("programa_id", null)
      : totalsQ.eq("programa_id", programaFilterId);
  } else {
    if (activeProgramIds.length > 0) {
      totalsQ = totalsQ.or(`programa_id.is.null,programa_id.in.(${activeProgramIds.join(",")})`);
    } else {
      totalsQ = totalsQ.is("programa_id", null);
    }
  }
  if (hasProveedorFilter) totalsQ = totalsQ.eq("proveedor_id", proveedorFilterId);
  if (hasPersonalFilter) totalsQ = totalsQ.eq("personal_id", personalFilterId);
  if (hasTipoFilter) totalsQ = totalsQ.eq("tipo_id", tipoFilterId);
  if (hasCategoriaFilter) totalsQ = totalsQ.eq("categoria_id", categoriaFilterId);
  if (hasConceptoFilter) totalsQ = totalsQ.eq("concepto_id", conceptoFilterId);
  if (fechaDesde) totalsQ = totalsQ.gte("fecha", fechaDesde);
  if (fechaHasta) totalsQ = totalsQ.lte("fecha", fechaHasta);
  const totalsPromise = totalsQ;

  // Cargas en paralelo para reducir latencia en el dashboard
  const tiposPromise = supabase
    .from("tipos")
    .select("id_tipo, tipo")
    .eq("club_id", clubId)
    .order("id_tipo", { ascending: true });

  const proveedoresPromise = supabase
    .from("proveedores")
    .select("id_proveedor, proveedor")
    .eq("club_id", clubId)
    .eq("activo", true)
    .order("proveedor", { ascending: true });

  const conceptosPromise = supabase
    .from("conceptos")
    .select("id_concepto, concepto, en_listado, valido_clubes, valido_eventos, valido_eedd_ctd_discapacidad, naturaleza, codigo_interno, requisito_entidad_origen, requisito_descripcion, subvencionabilidad")
    .eq("club_id", clubId)
    .order("concepto", { ascending: true });

  const entidadesPromise = supabase
    .from("entidades")
    .select("id_entidad, entidad")
    .eq("club_id", clubId)
    .order("entidad", { ascending: true });

  const personalPromise = supabase
    .from("personal")
    .select("id_personal, nombre")
    .eq("club_id", clubId)
    .eq("activo", true)
    .order("nombre", { ascending: true });

  const categoriasPromise = supabase
    .from("categorias")
    .select("id_categoria, categoria")
    .order("id_categoria", { ascending: true });

  let q = supabase
    .from("contabilidad")
    .select(
      [
        "id_contabilidad",
        "tipo_id",
        "proveedor_id",
        "personal_id",
        "concepto_id",
        "entidad_id",
        "programa_id",
        "categoria_id",
        "numero_factura",
        "fecha",
        "fecha_pago",
        "importe_total",
        "importe_imputado",
        "detalle",
        "observaciones",
        "created_at",
      ].join(",")
    )
    .eq("club_id", clubId);

  if (hasProgramaFilter) {
    // Filtro explícito: mostrar ese programa concreto
    q = isProgramaNoneFilter
      ? q.is("programa_id", null)
      : q.eq("programa_id", programaFilterId);
  } else {
    // Sin filtro: excluir asientos de programas dados de baja
    if (activeProgramIds.length > 0) {
      q = q.or(`programa_id.is.null,programa_id.in.(${activeProgramIds.join(",")})`);
    } else {
      q = q.is("programa_id", null);
    }
  }
  if (hasProveedorFilter) {
    q = q.eq("proveedor_id", proveedorFilterId);
  }
  if (hasPersonalFilter) q = q.eq("personal_id", personalFilterId);
  if (hasTipoFilter) q = q.eq("tipo_id", tipoFilterId);
  if (hasCategoriaFilter) q = q.eq("categoria_id", categoriaFilterId);
  if (hasConceptoFilter) q = q.eq("concepto_id", conceptoFilterId);
  if (fechaDesde) q = q.gte("fecha", fechaDesde);
  if (fechaHasta) q = q.lte("fecha", fechaHasta);

  let filterOptionsQ = supabase
    .from("contabilidad")
    .select("tipo_id, proveedor_id, personal_id, programa_id, categoria_id, concepto_id")
    .eq("club_id", clubId);

  if (hasProgramaFilter) {
    filterOptionsQ = isProgramaNoneFilter
      ? filterOptionsQ.is("programa_id", null)
      : filterOptionsQ.eq("programa_id", programaFilterId);
  } else if (activeProgramIds.length > 0) {
    filterOptionsQ = filterOptionsQ.or(`programa_id.is.null,programa_id.in.(${activeProgramIds.join(",")})`);
  } else {
    filterOptionsQ = filterOptionsQ.is("programa_id", null);
  }
  if (hasProveedorFilter) filterOptionsQ = filterOptionsQ.eq("proveedor_id", proveedorFilterId);
  if (hasPersonalFilter) filterOptionsQ = filterOptionsQ.eq("personal_id", personalFilterId);
  if (hasTipoFilter) filterOptionsQ = filterOptionsQ.eq("tipo_id", tipoFilterId);
  if (hasCategoriaFilter) filterOptionsQ = filterOptionsQ.eq("categoria_id", categoriaFilterId);
  if (hasConceptoFilter) filterOptionsQ = filterOptionsQ.eq("concepto_id", conceptoFilterId);
  if (fechaDesde) filterOptionsQ = filterOptionsQ.gte("fecha", fechaDesde);
  if (fechaHasta) filterOptionsQ = filterOptionsQ.lte("fecha", fechaHasta);
  const filterOptionsPromise = filterOptionsQ;

  let contabilidadPromise = q
    .order("fecha", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  contabilidadPromise = buscar
    ? contabilidadPromise.limit(2000)
    : contabilidadPromise.range(offset, offset + PAGE_SIZE - 1);

  // Ingresos de banco para el programa seleccionado (solo cuando hay filtro de programa concreto)
  const bancosIngresosPromise =
    hasProgramaFilter && !isProgramaNoneFilter && programaFilterId
      ? supabase
          .from("bancos")
          .select("haber")
          .eq("club_id", clubId)
          .eq("programa_id", Number(programaFilterId))
      : Promise.resolve({ data: null as null, error: null });

  const [
    { data: tipos },
    { data: proveedores },
    { data: conceptos },
    { data: entidades },
    { data: personal },
    { data: categorias },
    { data: rows, error },
    { data: bancosIngresosData },
    { data: totalsRows },
    { data: filterOptionsRows },
  ] = await Promise.all([
    tiposPromise,
    proveedoresPromise,
    conceptosPromise,
    entidadesPromise,
    personalPromise,
    categoriasPromise,
    contabilidadPromise,
    bancosIngresosPromise,
    totalsPromise,
    filterOptionsPromise,
  ]);

  const filterOptionRowsAny = (filterOptionsRows ?? []) as any[];
  const availableTipoIds = new Set(filterOptionRowsAny.map((r) => Number(r.tipo_id)).filter(Number.isFinite));
  const availableProveedorIds = new Set(filterOptionRowsAny.map((r) => Number(r.proveedor_id)).filter(Number.isFinite));
  const availablePersonalIds = new Set(filterOptionRowsAny.map((r) => Number(r.personal_id)).filter(Number.isFinite));
  const availableProgramaIds = new Set(filterOptionRowsAny.map((r) => Number(r.programa_id)).filter(Number.isFinite));
  const hasAvailableNoPrograma = filterOptionRowsAny.some((r) => r.programa_id == null);
  const availableCategoriaIds = new Set(filterOptionRowsAny.map((r) => Number(r.categoria_id)).filter(Number.isFinite));
  const availableConceptoIds = new Set(filterOptionRowsAny.map((r) => Number(r.concepto_id)).filter(Number.isFinite));
  const filterTipos = (tipos ?? []).filter((t: any) => availableTipoIds.has(Number(t.id_tipo)) || Number(t.id_tipo) === tipoFilterId);
  const filterProveedores = (proveedores ?? []).filter((p: any) => availableProveedorIds.has(Number(p.id_proveedor)) || Number(p.id_proveedor) === proveedorFilterId);
  const filterPersonal = (personal ?? []).filter((p: any) => availablePersonalIds.has(Number(p.id_personal)) || Number(p.id_personal) === personalFilterId);
  const filterProgramas = (programas ?? []).filter((p: any) => availableProgramaIds.has(Number(p.id_programa)) || Number(p.id_programa) === programaFilterId);
  const filterCategorias = (categorias ?? []).filter((c: any) => availableCategoriaIds.has(Number(c.id_categoria)) || Number(c.id_categoria) === categoriaFilterId);
  const filterConceptos = (conceptos ?? []).filter((c: any) => availableConceptoIds.has(Number(c.id_concepto)) || Number(c.id_concepto) === conceptoFilterId);

type Tot = { total: number; imputado: number; count: number };

const categoriasMap = new Map(
  (categorias ?? []).map((c: any) => [Number(c.id_categoria), String(c.categoria ?? "")])
);
const tipoSearchMap = new Map((tipos ?? []).map((x: any) => [Number(x.id_tipo), x.tipo]));
const proveedorSearchMap = new Map((proveedores ?? []).map((x: any) => [Number(x.id_proveedor), x.proveedor]));
const personalSearchMap = new Map((personal ?? []).map((x: any) => [Number(x.id_personal), x.nombre]));
const conceptoSearchMap = new Map((conceptos ?? []).map((x: any) => [Number(x.id_concepto), x.concepto]));
const programaSearchMap = new Map((programas ?? []).map((x: any) => [Number(x.id_programa), `${x.anio ?? ""} ${x.programa}`]));
const searchedRows = ((rows ?? []) as any[]).filter((row) => matchesGlobalSearch(buscar, [
  JSON.stringify(row), tipoSearchMap.get(Number(row.tipo_id)), proveedorSearchMap.get(Number(row.proveedor_id)),
  personalSearchMap.get(Number(row.personal_id)), conceptoSearchMap.get(Number(row.concepto_id)),
  programaSearchMap.get(Number(row.programa_id)),
]));
const totalsSource = buscar ? searchedRows : (totalsRows ?? []);

const totales = totalsSource.reduce(
  (acc, r: any) => {
    const total = Number(r.importe_total ?? 0) || 0;
    const imputado = Number(r.importe_imputado ?? 0) || 0;
    const cat = String(categoriasMap.get(Number(r.categoria_id)) ?? "").toUpperCase();

    // Global
    acc.global.total += total;
    acc.global.imputado += imputado;
    acc.global.count += 1;

    if (cat === "A") {
      acc.A.total += total;
      acc.A.imputado += imputado;
      acc.A.count += 1;
    } else if (cat === "B") {
      acc.B.total += total;
      acc.B.imputado += imputado;
      acc.B.count += 1;
    } else {
      acc.otras.total += total;
      acc.otras.imputado += imputado;
      acc.otras.count += 1;
    }

    return acc;
  },
  {
    global: { total: 0, imputado: 0, count: 0 } as Tot,
    A: { total: 0, imputado: 0, count: 0 } as Tot,
    B: { total: 0, imputado: 0, count: 0 } as Tot,
    otras: { total: 0, imputado: 0, count: 0 } as Tot,
  }
);

const totalCount = buscar ? searchedRows.length : (totalsRows?.length ?? 0);
const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

// ===============================
// Informe por programa y concepto: agrega totalsSource (ya filtrado según
// los filtros activos, buscar incluido) por programa y, dentro, por concepto.
// ===============================
const programaLabelMap = new Map(
  (programas ?? []).map((p: any) => [Number(p.id_programa), `${p.anio ? `[${p.anio}] ` : ""}${p.programa}`])
);
type InformeConceptoRow = { key: string; label: string; count: number; total: number; imputado: number };
type InformeProgramaGroup = InformeConceptoRow & { conceptos: InformeConceptoRow[] };
const informeMap = new Map<
  string,
  { label: string; count: number; total: number; imputado: number; conceptos: Map<string, InformeConceptoRow> }
>();
for (const r of totalsSource as any[]) {
  const total = Number(r.importe_total ?? 0) || 0;
  const imputado = Number(r.importe_imputado ?? 0) || 0;

  const pid = r.programa_id != null ? Number(r.programa_id) : null;
  const pKey = pid != null ? String(pid) : "none";
  let pGrupo = informeMap.get(pKey);
  if (!pGrupo) {
    pGrupo = {
      label: pid != null ? programaLabelMap.get(pid) ?? `Programa #${pid}` : "(sin programa)",
      count: 0,
      total: 0,
      imputado: 0,
      conceptos: new Map(),
    };
    informeMap.set(pKey, pGrupo);
  }
  pGrupo.count += 1;
  pGrupo.total += total;
  pGrupo.imputado += imputado;

  const cid = r.concepto_id != null ? Number(r.concepto_id) : null;
  const cKey = cid != null ? String(cid) : "none";
  let cFila = pGrupo.conceptos.get(cKey);
  if (!cFila) {
    cFila = {
      key: cKey,
      label: cid != null ? conceptoSearchMap.get(cid) ?? `Concepto #${cid}` : "(sin concepto)",
      count: 0,
      total: 0,
      imputado: 0,
    };
    pGrupo.conceptos.set(cKey, cFila);
  }
  cFila.count += 1;
  cFila.total += total;
  cFila.imputado += imputado;
}
const informePorPrograma: InformeProgramaGroup[] = Array.from(informeMap.entries())
  .map(([key, g]) => ({
    key,
    label: g.label,
    count: g.count,
    total: g.total,
    imputado: g.imputado,
    conceptos: Array.from(g.conceptos.values()).sort((a, b) => a.label.localeCompare(b.label, "es")),
  }))
  .sort((a, b) => a.label.localeCompare(b.label, "es"));

// ===============================
// Control de subvención del programa seleccionado
// ===============================
const programaSeleccionado =
  hasProgramaFilter && !isProgramaNoneFilter
    ? (programas ?? []).find((p: any) => Number(p.id_programa) === Number(programaFilterId))
    : null;
const subvencion = Number(programaSeleccionado?.subvencion ?? 0) || 0;
const ejecutado = totales.global.imputado; // lo imputado es lo ejecutado (según tu modelo)
const pendienteSubv = Math.max(0, subvencion - ejecutado);
const pct = subvencion > 0 ? (ejecutado / subvencion) * 100 : 0;
const fechaLimite = programaSeleccionado?.fecha_limite ?? null;
const totalIngresosBanco = (bancosIngresosData ?? []).reduce(
  (sum: number, r: any) => sum + (Number(r.haber) || 0),
  0
);

  // Evitar inferencias raras de TS: trabajamos como any
  const rowsAny = buscar ? searchedRows.slice(offset, offset + PAGE_SIZE) : ((rows ?? []) as any[]);

  let editRow: any =
    editId !== null
      ? rowsAny.find((r) => Number(r.id_contabilidad) === Number(editId))
      : null;

  // Fallback: si el asiento a editar no está en rows, lo cargamos por id
  if (editId && !editRow) {
    const { data: one } = await supabase
      .from("contabilidad")
      .select(
        [
          "id_contabilidad",
          "proveedor_id",
          "personal_id",
          "concepto_id",
          "entidad_id",
          "programa_id",
          "categoria_id",
          "numero_factura",
          "fecha",
          "fecha_pago",
          "importe_total",
          "importe_imputado",
          "detalle",
          "observaciones",
          "created_at",
        ].join(",")
      )
      .eq("club_id", clubId)
      .eq("id_contabilidad", editId)
      .maybeSingle();

    editRow = (one as any) ?? null;
  }

  const documentos =
    editRow?.id_contabilidad
      ? (
          await supabase
            .from("documentos")
            .select("id_documento:id, filename, mime:content_type, size:size_bytes, created_at")
            .or(
              `contabilidad_id.eq.${editRow.id_contabilidad},nomina_id.eq.${editRow.id_contabilidad}`
            )
            .order("created_at", { ascending: false })
        ).data ?? []
      : [];

  const listHref = exportParams.toString()
    ? `/contabilidad?${exportParams.toString()}`
    : "/contabilidad";
  const editRedirectParams = new URLSearchParams(exportParams);
  if (editRow?.id_contabilidad) {
    editRedirectParams.set("edit", String(editRow.id_contabilidad));
  }
  const editRedirectHref = editRow
    ? `/contabilidad?${editRedirectParams.toString()}#form`
    : listHref;
  const isDrawerOpen = canUserEdit && (isNewPanel || !!editRow);

  // Estilo compacto: mismo alto para inputs y selects
  const compactFieldStyle: React.CSSProperties = {
    height: 32,
    minHeight: 32,
    lineHeight: "32px",
    padding: "0 8px",
    fontSize: 13,
    boxSizing: "border-box",
    display: "block",
    width: "100%",
  };
  
  const compactSelectStyle: React.CSSProperties = {
    ...compactFieldStyle,
    lineHeight: "normal", // en algunos navegadores mejora el select
    padding: "0 8px",
  };
  
  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    display: "grid",
    gap: 4,
  };



  return (
    <div className="conta-page" style={{ maxWidth: 1200, margin: "0 auto", padding: 16 }}>
      <div className="page-toolbar conta-header" style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Contabilidad</h1>
        {canUserEdit ? (
          <Link
            href="/contabilidad?panel=new#form"
            className="icon-button tooltip-button"
            aria-label="Nuevo asiento"
            style={{ marginLeft: "auto" }}
          >
            <Icon name="new" />
          </Link>
        ) : null}
        <div className="page-toolbar-actions">
          <a href={exportHref} className="app-action-link">Exportar Excel</a>
          <a href={justificantesHref} className="app-action-link">Relacion de justificantes</a>
        </div>
</div>
{errorMsg && (
        <div
          style={{
            border: "1px solid #f5c2c2",
            background: "#fff5f5",
            padding: 10,
            borderRadius: 8,
          }}
        >
          <b>Error:</b> {errorMsg}
        </div>
      )}

      {error && <p>Error: {error.message}</p>}

      {/* Formulario */}
      {isDrawerOpen ? (
        <>
          <Link href={listHref} className="drawer-backdrop" aria-label="Cerrar panel" />
          <div
        id="form"
        className="side-drawer"
        style={{
          border: "1px solid #ddd",
          borderRadius: 10,
          padding: 12,
          marginTop: 12,
        }}
      >
        <h2 style={{ margin: 0, marginBottom: 10, fontSize: 16 }}>
          {editRow
            ? `Editar asiento (id ${editRow.id_contabilidad})`
            : "Nuevo asiento"}
        </h2>

        {!canUserEdit ? (
          <p style={{ margin: 0, opacity: 0.8 }}>
            No tienes permisos para crear/editar asientos.
          </p>
        ) : (
          <form 
          key={editRow ? `edit-${editRow.id_contabilidad}` : "new"}
            action={upsertAsiento} 
            style={{ display: "grid", gap: 10 }}>
            <input type="hidden" name="club_id" value={clubId} />
            <input type="hidden" name="redirect_to" value={listHref} />
            <input
              type="hidden"
              name="id_contabilidad"
              value={editRow?.id_contabilidad ?? ""}
            />
            {programaFilterValue ? (
              <input
                type="hidden"
                name="programa_id_filter"
                value={programaFilterValue}
              />
            ) : null}
            {proveedorFilterValue ? (
              <input
                type="hidden"
                name="proveedor_id_filter"
                value={proveedorFilterValue}
              />
            ) : null}
            <div
              className="conta-form-row-one"
              style={{
                display: "grid",
                gap: 10,
                alignItems: "end",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              }}
            >
              {/* Tipo */}
              <label style={labelStyle}>
                Tipo
                <select
                  name="tipo_id"
                  defaultValue={toSelectValue(editRow?.tipo_id)}
                  style={compactSelectStyle}
                >
                  <option value="">(sin tipo)</option>
                  {(tipos ?? []).map((t: any) => (
                    <option key={t.id_tipo} value={t.id_tipo}>
                      {t.tipo}
                    </option>
                  ))}
                </select>
              </label>

              {/* Proveedor */}
              <label style={labelStyle}>
                Proveedor
                <select
                  name="proveedor_id"
                  defaultValue={toSelectValue(editRow?.proveedor_id)}
                  style={compactSelectStyle}
                >
                  <option value="">(sin proveedor)</option>
                  {(proveedores ?? []).map((p: any) => (
                    <option key={p.id_proveedor} value={p.id_proveedor}>
                      {p.proveedor}
                    </option>
                  ))}
                </select>
              </label>

              {/* Personal */}
              <label style={labelStyle}>
                Personal
                <select
                  name="personal_id"
                  defaultValue={toSelectValue(editRow?.personal_id)}
                  style={compactSelectStyle}
                >
                  <option value="">(sin personal)</option>
                  {(personal ?? []).map((p: any) => (
                    <option key={p.id_personal} value={p.id_personal}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </label>

              {/* Nº factura */}
              <label style={labelStyle}>
                Nº factura
                <input
                  name="numero_factura"
                  defaultValue={editRow?.numero_factura ?? ""}
                  style={{ ...compactFieldStyle, width: "100%" }}
                />
              </label>

              {/* Fecha devengo */}
              <label style={labelStyle}>
                Fecha (devengo)
                <input
                  name="fecha"
                  type="date"
                  defaultValue={toDateInputValue(editRow?.fecha)}
                  style={{ ...compactFieldStyle, width: "100%" }}
                />
              </label>

              {/* Fecha pago */}
              <label style={labelStyle}>
                Fecha pago
                <input
                  name="fecha_pago"
                  type="date"
                  key={editRow ? `edit-${editRow.id_contabilidad}-fecha_pago` : "new-fecha_pago"}
                  defaultValue={toDateInputValue(editRow?.fecha_pago)}
                  style={{ ...compactFieldStyle, width: "100%" }}
                />
              </label>
            </div>

            
            <div
              className="conta-form-row-two"
              style={{
                display: "grid",
                gap: 10,
                alignItems: "end",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              }}
            >
              <ProgramaConceptoFields
                programas={(programas ?? []) as any}
                conceptos={(conceptos ?? []) as any}
                programaInicial={editRow?.programa_id}
                conceptoInicial={editRow?.concepto_id}
              />

              {/* Entidad */}
              <label style={labelStyle}>
                Entidad
                <select
                  name="entidad_id"
                  defaultValue={toSelectValue(editRow?.entidad_id)}
                  style={compactSelectStyle}
                >
                  <option value="">(sin entidad)</option>
                  {(entidades ?? []).map((e: any) => (
                    <option key={e.id_entidad} value={e.id_entidad}>
                      {e.entidad}
                    </option>
                  ))}
                </select>
              </label>

              {/* Categoría (medio ancho) */}
              <label style={labelStyle}>
                Categoría
                <select
                  name="categoria_id"
                  defaultValue={toSelectValue(editRow?.categoria_id)}
                  style={compactSelectStyle}
                >
                  <option value="">(sin categoría)</option>
                  {(categorias ?? []).map((c: any) => (
                    <option key={c.id_categoria} value={c.id_categoria}>
                      {c.categoria}
                    </option>
                  ))}
                </select>
              </label>

              {/* Importe total */}
              <label style={labelStyle}>
                Importe total
                <input
                  name="importe_total"
                  type="text"
                  inputMode="decimal"
                  required
                  defaultValue={toDecimalInputValue(editRow?.importe_total ?? 0)}
                  style={{ ...compactFieldStyle, width: "100%" }}
                />
              </label>

              {/* Importe imputado */}
              <label style={labelStyle}>
                Importe imputado
                <input
                  name="importe_imputado"
                  type="text"
                  inputMode="decimal"
                  required
                  defaultValue={toDecimalInputValue(editRow?.importe_imputado ?? 0)}
                  style={{ ...compactFieldStyle, width: "100%" }}
                />
              </label>
            </div>


            <label>
              Detalle
              <input
                name="detalle"
                defaultValue={editRow?.detalle ?? ""}
                style={{ ...compactFieldStyle, width: "100%" }}
              />
            </label>

            <label>
              Observaciones
              <textarea
                name="observaciones"
                defaultValue={editRow?.observaciones ?? ""}
                placeholder="Indica a qué corresponde exactamente el concepto seleccionado"
                rows={3}
                style={{ ...compactFieldStyle, height: "auto", minHeight: 72, lineHeight: 1.4, padding: 8, resize: "vertical" }}
              />
            </label>

            <div className="drawer-actions">
              <button
                type="submit"
                className="icon-button tooltip-button"
                aria-label={editRow ? "Guardar cambios" : "Crear asiento"}
              >
                <Icon name="save" />
              </button>
              {editRow ? (
                <button
                  type="submit"
                  formAction={duplicateAsiento}
                  formNoValidate
                  className="icon-button icon-button-secondary tooltip-button"
                  aria-label="Duplicar asiento"
                  title="Crear una copia y abrirla para editar"
                >
                  <Icon name="duplicate" />
                </button>
              ) : null}
              {editRow && (
                <a
                  href={listHref}
                  className="icon-button icon-button-secondary tooltip-button"
                  aria-label="Cancelar edición"
                >
                  <Icon name="logout" />
                </a>
              )}
            </div>
          </form>
        )}

      {editRow && canUserEdit && (
        <div
          style={{
            border: "1px dashed #ddd",
            borderRadius: 10,
            padding: 12,
            marginTop: 10,
            display: "grid",
            gap: 10,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 800 }}>Documentos</div>

          <FileDropUpload
            action={uploadDocumentosAction}
            clubId={clubId}
            contabilidadId={editRow.id_contabilidad}
            redirectTo={editRedirectHref}
          />

          {documentos.length > 0 ? (
            <div style={{ display: "grid", gap: 6 }}>
              {documentos.map((doc: any) => (
                <div
                  key={doc.id_documento}
                  style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}
                >
                  <span style={{ fontSize: 13 }}>
                    {doc.filename} ({formatBytes(doc.size)})
                  </span>
                  <form action={downloadDocumentoAction}>
                    <input type="hidden" name="club_id" value={clubId} />
                    <input type="hidden" name="documento_id" value={doc.id_documento} />
                    <input type="hidden" name="redirect_to" value={editRedirectHref} />
                    <button type="submit" style={{ padding: "4px 8px", cursor: "pointer" }}>
                      Descargar
                    </button>
                  </form>
                  <form action={deleteDocumentoAction}>
                    <input type="hidden" name="club_id" value={clubId} />
                    <input type="hidden" name="documento_id" value={doc.id_documento} />
                    <input type="hidden" name="redirect_to" value={editRedirectHref} />
                    <button type="submit" style={{ padding: "4px 8px", cursor: "pointer" }}>
                      Eliminar
                    </button>
                  </form>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 12, opacity: 0.7 }}>No hay documentos.</div>
          )}
        </div>
      )}

      {editRow && canUserEdit ? (
        <div className="danger-zone">
          <form action={deleteContabilidadWithDocsAction}>
            <input type="hidden" name="club_id" value={clubId} />
            <input type="hidden" name="id_contabilidad" value={editRow.id_contabilidad} />
            <input type="hidden" name="redirect_to" value={listHref} />
            <ConfirmSubmitButton
              message="Se eliminara el asiento y todos sus documentos. Continuar?"
              className="icon-button icon-button-danger tooltip-button"
              ariaLabel="Eliminar asiento"
            >
              <Icon name="delete" />
            </ConfirmSubmitButton>
          </form>
        </div>
      ) : null}

          </div>
        </>
      ) : null}

      <AutoSubmitFilters action="/contabilidad" className="filters-grid contabilidad-filters">

        <label className="filter-field"><span>Búsqueda</span><div className="filter-control-row"><input type="search" name="buscar" defaultValue={buscar} placeholder="Buscar en todos los campos" />{buscar ? <Link href={buildFilterHref("/contabilidad", exportParams, ["buscar", "page"])} className="filter-reset-button" aria-label="Limpiar búsqueda">X</Link> : null}</div></label>

        <label className="filter-field filter-field-date">
          <span>Desde</span>
          <div className="filter-control-row">
            <input type="date" name="fecha_desde" defaultValue={fechaDesde} />
            <Link href={buildFilterHref("/contabilidad", exportParams, ["fecha_desde"])} className="filter-reset-button" aria-label="Limpiar desde">X</Link>
          </div>
        </label>
        <label className="filter-field filter-field-date">
          <span>Hasta</span>
          <div className="filter-control-row">
            <input type="date" name="fecha_hasta" defaultValue={fechaHasta} />
            <Link href={buildFilterHref("/contabilidad", exportParams, ["fecha_hasta"])} className="filter-reset-button" aria-label="Limpiar hasta">X</Link>
          </div>
        </label>
        <label className="filter-field">
          <span>Tipo</span>
          <select name="tipo_id" defaultValue={hasTipoFilter ? String(tipoFilterId) : ""}>
            <option value="">Todos</option>
            {filterTipos.map((t: any) => <option key={t.id_tipo} value={t.id_tipo}>{t.tipo}</option>)}
          </select>
        </label>
        <label className="filter-field">
          <span>Proveedor</span>
          <select name="proveedor_id" defaultValue={hasProveedorFilter ? String(proveedorFilterId) : ""}>
            <option value="">Todos</option>
            {filterProveedores.map((p: any) => <option key={p.id_proveedor} value={p.id_proveedor}>{p.proveedor}</option>)}
          </select>
        </label>
        <label className="filter-field">
          <span>Personal</span>
          <select name="personal_id" defaultValue={hasPersonalFilter ? String(personalFilterId) : ""}>
            <option value="">Todos</option>
            {filterPersonal.map((p: any) => <option key={p.id_personal} value={p.id_personal}>{p.nombre}</option>)}
          </select>
        </label>
        <label className="filter-field">
          <span>Programa</span>
          <select name="programa_id" defaultValue={programaFilterValue ?? ""}>
            <option value="">Todos</option>
            {(hasAvailableNoPrograma || isProgramaNoneFilter) ? <option value="none">(sin programa)</option> : null}
            {filterProgramas.map((p: any) => <option key={p.id_programa} value={p.id_programa}>{p.anio ? `[${p.anio}] ` : ""}{p.programa}</option>)}
          </select>
        </label>
        <label className="filter-field">
          <span>Categoría</span>
          <select name="categoria_id" defaultValue={hasCategoriaFilter ? String(categoriaFilterId) : ""}>
            <option value="">Todas</option>
            {filterCategorias.map((c: any) => <option key={c.id_categoria} value={c.id_categoria}>{c.categoria}</option>)}
          </select>
        </label>
        <label className="filter-field">
          <span>Concepto</span>
          <select name="concepto_id" defaultValue={hasConceptoFilter ? String(conceptoFilterId) : ""}>
            <option value="">Todos</option>
            {filterConceptos.map((c: any) => <option key={c.id_concepto} value={c.id_concepto}>{c.concepto}</option>)}
          </select>
        </label>
      </AutoSubmitFilters>

      <div className="conta-filter" style={{ display: "none" }}>
        <form
          method="get"
          action="/contabilidad"
          className="conta-filter-form"
          style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap" }}
        >
          {/* mantenemos edit si existiera, aunque normalmente no filtras mientras editas */}
          {editId ? <input type="hidden" name="edit" value={String(editId)} /> : null}
  

          <label className="conta-filter-label">
            Filtrar por programa
            <select
              name="programa_id"
              defaultValue={
                isProgramaNoneFilter
                  ? "none"
                  : hasProgramaFilter
                  ? String(programaFilterId)
                  : ""
              }
              className="conta-filter-select"
              style={{ display: "block", padding: 8, minWidth: 260 }}
            >
              <option value="">(todos)</option>
              <option value="none">(sin programa)</option>
              {(programas ?? []).map((p: any) => (
                <option key={p.id_programa} value={p.id_programa}>
                  {p.anio ? `[${p.anio}] ` : ""}{p.programa}
                </option>
              ))}
            </select>
          </label>

          <label className="conta-filter-label">
            Filtrar por proveedor
            <select
              name="proveedor_id"
              defaultValue={hasProveedorFilter ? String(proveedorFilterId) : ""}
              className="conta-filter-select"
              style={{ display: "block", padding: 8, minWidth: 260 }}
            >
              <option value="">(todos)</option>
              {(proveedores ?? []).map((p: any) => (
                <option key={p.id_proveedor} value={p.id_proveedor}>
                  {p.proveedor}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" style={{ padding: "10px 12px", cursor: "pointer" }}>
            Aplicar filtro
          </button>

          <Link href="/contabilidad" style={{ padding: "10px 12px", opacity: 0.8 }}>
            Quitar filtro
          </Link>
          
          <a
            href={exportHref}
            style={{
              padding: "10px 12px",
              border: "1px solid #ddd",
              borderRadius: 8,
              textDecoration: "none",
              display: "inline-block",
            }}
          >
            Exportar Excel
          </a>

          <a
            href={justificantesHref}
            style={{
              padding: "10px 12px",
              border: "1px solid #ddd",
              borderRadius: 8,
              textDecoration: "none",
              display: "inline-block",
            }}
          >
            Relación de justificantes
          </a>

        </form>
      </div>




      {hasProgramaFilter && programaSeleccionado && (
        <div
          style={{
            border: "1px solid #ddd",
            borderRadius: 10,
            padding: 12,
            marginTop: 10,
            display: "grid",
            gap: 10,
          }}
        >
          {/* TÍTULO DEL BLOQUE */}
          <div style={{ fontSize: 15, fontWeight: 800 }}>
            Resumen de ejecución de la subvención
          </div>

          {/* SUBTÍTULO / PROGRAMA */}
          <div style={{ fontWeight: 700 }}>
            {programaSeleccionado.anio ? `[${programaSeleccionado.anio}] ` : ""}
            {programaSeleccionado.programa}
          </div>

          {/* TARJETAS */}
          <div className="conta-totals-subv-grid" style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>
            <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 4 }}>Subvención</div>
              <div style={{ fontWeight: 800, fontSize: 15 }}>{subvencion.toFixed(2).replace(".", ",")} €</div>
            </div>

            <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 4 }}>Ingresos banco</div>
              <div style={{ fontWeight: 800, fontSize: 15, color: totalIngresosBanco > 0 ? "#1a6b2e" : undefined }}>
                {totalIngresosBanco.toFixed(2).replace(".", ",")} €
              </div>
            </div>

            <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 4 }}>Ejecutado</div>
              <div style={{ fontWeight: 800, fontSize: 15 }}>{ejecutado.toFixed(2).replace(".", ",")} €</div>
            </div>

            <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 4 }}>Pendiente</div>
              <div style={{ fontWeight: 800, fontSize: 15, color: pendienteSubv > 0 ? "#92580a" : "#1a6b2e" }}>
                {pendienteSubv.toFixed(2).replace(".", ",")} €
              </div>
            </div>

            <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 4 }}>% ejecución</div>
              <div style={{ fontWeight: 800, fontSize: 15, color: pct > 100 ? "#b93a48" : pct >= 80 ? "#92580a" : undefined }}>
                {pct.toFixed(1).replace(".", ",")}%
              </div>
            </div>

            <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 4 }}>Fecha límite</div>
              <div style={{ fontWeight: 800, fontSize: 15 }}>{fechaLimite ?? "-"}</div>
            </div>
          </div>
        </div>
      )}




      {/* Listado */}
      <h2 style={{ fontSize: 16, marginTop: 16, marginBottom: 8 }}>
        Registros de contabilidad{" "}
        {hasProgramaFilter
          ? isProgramaNoneFilter
            ? "(sin programa)"
            : `(programa_id: ${programaFilterId})`
          : ""}
        {hasProveedorFilter ? ` (proveedor_id: ${proveedorFilterId})` : ""} (
        {(rows ?? []).length})
      </h2>

        <div
    style={{
      border: "1px solid #ddd",
      borderRadius: 10,
      padding: 12,
      marginTop: 10,
      display: "grid",
      gap: 10,
    }}
  >
    <div style={{ fontWeight: 800 }}>
      Totales {hasProgramaFilter ? `del programa seleccionado` : "(todos los programas)"}
    </div>

    <div className="conta-totals-grid" style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(4, 1fr)" }}>
      {/* GLOBAL */}
      <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 10 }}>
        <div style={{ fontWeight: 700 }}>Global ({totales.global.count})</div>
        <div>Total: <b>{formatDecimal(totales.global.total)}</b></div>
        <div>Imputado: <b>{formatDecimal(totales.global.imputado)}</b></div>
      </div>

      {/* A */}
      <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 10 }}>
        <div style={{ fontWeight: 700 }}>Categoría A ({totales.A.count})</div>
        <div>Total: <b>{formatDecimal(totales.A.total)}</b></div>
        <div>Imputado: <b>{formatDecimal(totales.A.imputado)}</b></div>
      </div>

      {/* B */}
      <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 10 }}>
        <div style={{ fontWeight: 700 }}>Categoría B ({totales.B.count})</div>
        <div>Total: <b>{formatDecimal(totales.B.total)}</b></div>
        <div>Imputado: <b>{formatDecimal(totales.B.imputado)}</b></div>
      </div>

      {/* OTRAS */}
      <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 10 }}>
        <div style={{ fontWeight: 700 }}>Sin categoría / otras ({totales.otras.count})</div>
        <div>Total: <b>{formatDecimal(totales.otras.total)}</b></div>
        <div>Imputado: <b>{formatDecimal(totales.otras.imputado)}</b></div>
      </div>
    </div>
  </div>

      <details className="conta-informe">
        <summary>Informe por programa y concepto</summary>
        <div className="conta-informe-body">
          {informePorPrograma.length ? (
            informePorPrograma.map((grupo) => (
              <div key={grupo.key} className="conta-informe-programa">
                <div className="conta-informe-programa-header">
                  <strong>{grupo.label}</strong>
                  <span>{grupo.count} · Total {formatDecimal(grupo.total)} € · Imputado {formatDecimal(grupo.imputado)} €</span>
                </div>
                <table className="conta-informe-table">
                  <thead>
                    <tr><th>Concepto</th><th>Nº</th><th>Total</th><th>Imputado</th></tr>
                  </thead>
                  <tbody>
                    {grupo.conceptos.map((c) => (
                      <tr key={c.key}>
                        <td>{c.label}</td>
                        <td>{c.count}</td>
                        <td>{formatDecimal(c.total)} €</td>
                        <td>{formatDecimal(c.imputado)} €</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          ) : (
            <p className="conta-informe-empty">No hay movimientos para los filtros aplicados.</p>
          )}
          {informePorPrograma.length ? (
            <div className="conta-informe-total">
              <span>Total general ({totales.global.count})</span>
              <strong>{formatDecimal(totales.global.total)} € · Imputado {formatDecimal(totales.global.imputado)} €</strong>
            </div>
          ) : null}
        </div>
      </details>

      <ContabilidadTable
        initialRows={rowsAny as any}
        canEdit={canUserEdit}
        tipos={tipos ?? []}
        proveedores={proveedores ?? []}
        personal={personal ?? []}
        categorias={categorias ?? []}
        conceptos={conceptos ?? []}
        programas={programas ?? []}
        page={page}
        totalPages={totalPages}
        exportParamsStr={exportParams.toString()}
      />

      {/* Paginación */}
      {totalCount > 0 && (() => {
        const mkHref = (p: number) => {
          const ps = new URLSearchParams(exportParams);
          if (p > 1) ps.set("page", String(p));
          else ps.delete("page");
          return ps.toString() ? `/contabilidad?${ps.toString()}` : "/contabilidad";
        };
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "center", padding: "16px 0", flexWrap: "wrap" }}>
            {page > 1 ? (
              <Link
                href={mkHref(page - 1)}
                style={{ padding: "8px 16px", border: "1px solid #ddd", borderRadius: 6, textDecoration: "none" }}
              >
                ← Anterior
              </Link>
            ) : (
              <span style={{ padding: "8px 16px", opacity: 0.4, userSelect: "none" }}>← Anterior</span>
            )}
            <span style={{ fontSize: 13, opacity: 0.8 }}>
              Página {page} de {totalPages} · {totalCount} {totalCount === 1 ? "registro" : "registros"}
            </span>
            {page < totalPages ? (
              <Link
                href={mkHref(page + 1)}
                style={{ padding: "8px 16px", border: "1px solid #ddd", borderRadius: 6, textDecoration: "none" }}
              >
                Siguiente →
              </Link>
            ) : (
              <span style={{ padding: "8px 16px", opacity: 0.4, userSelect: "none" }}>Siguiente →</span>
            )}
          </div>
        );
      })()}

      <style>{`
        .conta-informe {
          margin-top: 14px;
          border: 1px solid #ddd;
          border-radius: 10px;
          padding: 0 12px 12px;
        }

        .conta-informe > summary {
          cursor: pointer;
          padding: 10px 0;
          font-weight: 700;
          list-style: none;
        }

        .conta-informe > summary::-webkit-details-marker {
          display: none;
        }

        .conta-informe > summary::before {
          content: "▸";
          display: inline-block;
          margin-right: 6px;
          transition: transform .12s ease;
        }

        .conta-informe[open] > summary::before {
          transform: rotate(90deg);
        }

        .conta-informe-body {
          display: grid;
          gap: 14px;
          padding-top: 4px;
        }

        .conta-informe-programa {
          border: 1px solid #eee;
          border-radius: 8px;
          padding: 10px;
        }

        .conta-informe-programa-header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 8px;
          font-size: 13px;
        }

        .conta-informe-programa-header span {
          color: var(--muted);
          font-weight: 600;
        }

        .conta-informe-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }

        .conta-informe-table th,
        .conta-informe-table td {
          padding: 6px 8px;
          border-bottom: 1px solid #eee;
          text-align: left;
        }

        .conta-informe-table th:not(:first-child),
        .conta-informe-table td:not(:first-child) {
          text-align: right;
        }

        .conta-informe-total {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 12px;
          border: 1px solid #ddd;
          border-radius: 8px;
          background: #f8fafc;
          font-size: 13px;
        }

        .conta-informe-empty {
          margin: 0;
          color: var(--muted);
          font-size: 13px;
        }

        @media (max-width: 1000px) {
          .conta-form-row-one,
          .conta-form-row-two {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .conta-totals-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .conta-totals-subv-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 700px) {
          .conta-header {
            flex-direction: column;
            align-items: flex-start;
          }

          .conta-back {
            margin-left: 0 !important;
          }

          .conta-form-row-one,
          .conta-form-row-two {
            grid-template-columns: 1fr !important;
          }

          .conta-filter-form {
            flex-direction: column;
            align-items: stretch;
          }

          .conta-filter-select {
            min-width: 0 !important;
            width: 100% !important;
          }

          .conta-totals-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
