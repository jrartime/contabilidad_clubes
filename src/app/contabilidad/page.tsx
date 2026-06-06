import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getActiveClubId } from "@/lib/club";
import { canEditClubData, getMyClubRole } from "@/lib/clubRole";
import ContabilidadTable from "./ContabilidadTable";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { Icon } from "@/components/Icon";
import { AutoSubmitFilters } from "@/components/AutoSubmitFilters";
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
  const limitValue = String(formData.get("limit") ?? "").trim();

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
  };

  const { error } = id
    ? await supabase
        .from("contabilidad")
        .update(payload)
        .eq("club_id", clubId)
        .eq("id_contabilidad", Number(id))
    : await supabase.from("contabilidad").insert(payload);

  const redirectParams = new URLSearchParams();
  if (programaFilter.isNone) redirectParams.set("programa_id", "none");
  if (programaFilter.id) redirectParams.set("programa_id", String(programaFilter.id));
  if (proveedorFilterId) redirectParams.set("proveedor_id", String(proveedorFilterId));
  if (limitValue) redirectParams.set("limit", limitValue);

  if (error) {
    redirect(
      `/contabilidad?${redirectParams.toString()}&error=` +
        encodeURIComponent(error.message)
    );
  }

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
  const limitValue = String(formData.get("limit") ?? "").trim();

  if (!clubId || !Number.isFinite(clubId))
    redirect("/contabilidad?error=club_id%20inv%C3%A1lido");
  if (!id || !Number.isFinite(id))
    redirect("/contabilidad?error=id_contabilidad%20inv%C3%A1lido");

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const myRole = await getMyClubRole(clubId);
  if (!canEditClubData(myRole)) redirect("/no-autorizado");

  const redirectParams = new URLSearchParams();
  if (programaFilter.isNone) redirectParams.set("programa_id", "none");
  if (programaFilter.id) redirectParams.set("programa_id", String(programaFilter.id));
  if (proveedorFilterId) redirectParams.set("proveedor_id", String(proveedorFilterId));
  if (limitValue) redirectParams.set("limit", limitValue);

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
    fecha_desde?: string;
    fecha_hasta?: string;
    limit?: string;
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
  const fechaDesde = String(sp.fecha_desde ?? "").trim();
  const fechaHasta = String(sp.fecha_hasta ?? "").trim();
  const limitRaw = String(sp.limit ?? "").trim();
  const limitParsed = Number(limitRaw);
  const limit = Number.isFinite(limitParsed)
    ? Math.max(50, Math.min(2000, Math.trunc(limitParsed)))
    : 500;
  const limitValue = limitRaw ? String(limit) : null;
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
  if (fechaDesde) exportParams.set("fecha_desde", fechaDesde);
  if (fechaHasta) exportParams.set("fecha_hasta", fechaHasta);
  const exportHref = exportParams.toString()
    ? `/contabilidad/export?${exportParams.toString()}`
    : `/contabilidad/export`;
  const justificantesHref = exportParams.toString()
    ? `/contabilidad/relacion-justificantes/export?${exportParams.toString()}`
    : `/contabilidad/relacion-justificantes/export`;


  // Programas primero (solo activos) para poder filtrar la query principal
  const { data: programas } = await supabase
    .from("programas")
    .select("id_programa, programa, subvencion, fecha_limite, anio")
    .eq("club_id", clubId)
    .eq("activo", true)
    .order("programa", { ascending: true });

  const activeProgramIds = (programas ?? []).map((p: any) => Number(p.id_programa));

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
    .select("id_concepto, concepto")
    .order("concepto", { ascending: true });

  const entidadesPromise = supabase
    .from("entidades")
    .select("id_entidad, entidad")
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
  if (fechaDesde) q = q.gte("fecha", fechaDesde);
  if (fechaHasta) q = q.lte("fecha", fechaHasta);

  const contabilidadPromise = q
    .order("fecha", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);

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
  ] = await Promise.all([
    tiposPromise,
    proveedoresPromise,
    conceptosPromise,
    entidadesPromise,
    personalPromise,
    categoriasPromise,
    contabilidadPromise,
    bancosIngresosPromise,
  ]);

type Tot = { total: number; imputado: number; count: number };

const categoriasMap = new Map(
  (categorias ?? []).map((c: any) => [Number(c.id_categoria), String(c.categoria ?? "")])
);

const totales = (rows ?? []).reduce(
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
  const rowsAny = (rows ?? []) as any[];

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

  const editRedirectParams = new URLSearchParams();
  if (programaFilterValue) editRedirectParams.set("programa_id", programaFilterValue);
  if (proveedorFilterValue) editRedirectParams.set("proveedor_id", proveedorFilterValue);
  if (limitValue) editRedirectParams.set("limit", limitValue);
  if (editRow?.id_contabilidad) {
    editRedirectParams.set("edit", String(editRow.id_contabilidad));
  }
  const editRedirectHref = editRow
    ? `/contabilidad?${editRedirectParams.toString()}#form`
    : "/contabilidad";
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
          <Link href="/contabilidad" className="drawer-backdrop" aria-label="Cerrar panel" />
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
            {limitValue ? (
              <input type="hidden" name="limit" value={limitValue} />
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
              {/* Concepto */}
              <label style={labelStyle}>
                Concepto
                <select
                  name="concepto_id"
                  defaultValue={toSelectValue(editRow?.concepto_id)}
                  style={compactSelectStyle}
                >
                  <option value="">(sin concepto)</option>
                  {(conceptos ?? []).map((c: any) => (
                    <option key={c.id_concepto} value={c.id_concepto}>
                      {c.concepto}
                    </option>
                  ))}
                </select>
              </label>

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

              {/* Programa */}
              <label style={labelStyle}>
                Programa
                <select
                  name="programa_id"
                  defaultValue={toSelectValue(editRow?.programa_id)}
                  style={compactSelectStyle}
                >
                  <option value="">(sin programa)</option>
                  {(programas ?? []).map((p: any) => (
                    <option key={p.id_programa} value={p.id_programa}>
                      {p.anio ? `[${p.anio}] ` : ""}{p.programa}
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

            <div className="drawer-actions">
              <button
                type="submit"
                className="icon-button tooltip-button"
                aria-label={editRow ? "Guardar cambios" : "Crear asiento"}
              >
                <Icon name={editRow ? "edit" : "new"} />
              </button>
              {editRow && (
                <a
                  href={
                    exportParams.toString()
                      ? `/contabilidad?${exportParams.toString()}`
                      : "/contabilidad"
                  }
                  style={{ opacity: 0.8 }}
                >
                  Cancelar edición
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

          <form
            action={uploadDocumentosAction}
            style={{ display: "grid", gap: 6, alignItems: "start" }}
          >
            <input type="hidden" name="club_id" value={clubId} />
            <input
              type="hidden"
              name="contabilidad_id"
              value={editRow.id_contabilidad}
            />
            <input type="hidden" name="redirect_to" value={editRedirectHref} />
            <input
              type="file"
              name="documentos"
              multiple
              accept="application/pdf,image/jpeg,image/png"
            />
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              Max 1MB. Tipos permitidos: PDF/JPG/PNG.
            </div>
            <button type="submit" style={{ padding: "8px 10px", cursor: "pointer" }}>
              Subir documentos
            </button>
          </form>

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
            <input type="hidden" name="redirect_to" value="/contabilidad" />
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
        {limitValue ? <input type="hidden" name="limit" value={limitValue} /> : null}
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
          <div className="filter-control-row">
            <select name="tipo_id" defaultValue={hasTipoFilter ? String(tipoFilterId) : ""}>
              <option value="">Todos</option>
              {(tipos ?? []).map((t: any) => <option key={t.id_tipo} value={t.id_tipo}>{t.tipo}</option>)}
            </select>
            <Link href={buildFilterHref("/contabilidad", exportParams, ["tipo_id"])} className="filter-reset-button" aria-label="Limpiar tipo">X</Link>
          </div>
        </label>
        <label className="filter-field">
          <span>Proveedor</span>
          <div className="filter-control-row">
            <select name="proveedor_id" defaultValue={hasProveedorFilter ? String(proveedorFilterId) : ""}>
              <option value="">Todos</option>
              {(proveedores ?? []).map((p: any) => <option key={p.id_proveedor} value={p.id_proveedor}>{p.proveedor}</option>)}
            </select>
            <Link href={buildFilterHref("/contabilidad", exportParams, ["proveedor_id"])} className="filter-reset-button" aria-label="Limpiar proveedor">X</Link>
          </div>
        </label>
        <label className="filter-field">
          <span>Personal</span>
          <div className="filter-control-row">
            <select name="personal_id" defaultValue={hasPersonalFilter ? String(personalFilterId) : ""}>
              <option value="">Todos</option>
              {(personal ?? []).map((p: any) => <option key={p.id_personal} value={p.id_personal}>{p.nombre}</option>)}
            </select>
            <Link href={buildFilterHref("/contabilidad", exportParams, ["personal_id"])} className="filter-reset-button" aria-label="Limpiar personal">X</Link>
          </div>
        </label>
        <label className="filter-field">
          <span>Programa</span>
          <div className="filter-control-row">
            <select name="programa_id" defaultValue={programaFilterValue ?? ""}>
              <option value="">Todos</option>
              <option value="none">(sin programa)</option>
              {(programas ?? []).map((p: any) => <option key={p.id_programa} value={p.id_programa}>{p.anio ? `[${p.anio}] ` : ""}{p.programa}</option>)}
            </select>
            <Link href={buildFilterHref("/contabilidad", exportParams, ["programa_id"])} className="filter-reset-button" aria-label="Limpiar programa">X</Link>
          </div>
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
          {limitValue ? <input type="hidden" name="limit" value={limitValue} /> : null}

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
          <label className="conta-filter-label">
            Limite
            <select
              name="limit"
              defaultValue={limitValue ?? String(limit)}
              className="conta-filter-select"
              style={{ display: "block", padding: 8, minWidth: 140 }}
            >
              {[200, 500, 1000, 2000].map((v) => (
                <option key={v} value={v}>
                  {v}
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

      <ContabilidadTable
        initialRows={rowsAny as any}
        canEdit={canUserEdit}
        tipos={tipos ?? []}
        proveedores={proveedores ?? []}
        personal={personal ?? []}
        categorias={categorias ?? []}
        conceptos={conceptos ?? []}
        programas={programas ?? []}
        clubId={clubId}
        programaFilterValue={programaFilterValue}
        proveedorFilterValue={proveedorFilterValue}
        limitValue={limitValue}
        duplicateAsientoAction={duplicateAsiento}
      />

      <style>{`
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
