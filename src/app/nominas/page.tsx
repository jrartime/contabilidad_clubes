import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { readSheet } from "read-excel-file/browser";
import { getActiveClubId } from "@/lib/club";
import { canEditClubData, getMyClubRole } from "@/lib/clubRole";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { Icon } from "@/components/Icon";
import { AutoSubmitFilters } from "@/components/AutoSubmitFilters";
import { buildFilterHref } from "@/lib/filters";
import NominaForm from "./NominaForm";
import NominasTable from "./NominasTable";
import { normalizeDecimalString, parseDecimalToNumber } from "@/lib/decimal";
import { formatDateEs, formatDecimal } from "@/lib/format";
import {
  deleteContabilidadWithDocsAction,
  deleteDocumentoAction,
  downloadDocumentoAction,
  uploadDocumentosAction,
} from "@/app/contabilidad/actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NOMINA_TIPO_ID = 3;
type NominasSortKey =
  | "fecha"
  | "personal"
  | "proveedor"
  | "programa"
  | "categoria"
  | "concepto"
  | "bruto"
  | "ss"
  | "importe_total"
  | "importe_imputado"
  | "fecha_pago";
type SortDirection = "asc" | "desc";

function toNullableBigint(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function toNullableText(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

function toNullableNumber(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  return parseDecimalToNumber(s);
}

function toNumberFromFormValue(v: FormDataEntryValue | null): number {
  const s = String(v ?? "").trim();
  const normalized = normalizeDecimalString(s);
  return Number(normalized);
}

function safeNominaRedirect(value: FormDataEntryValue | null) {
  const redirectTo = String(value ?? "/nominas").trim();
  return redirectTo.startsWith("/nominas") ? redirectTo : "/nominas";
}

function appendNominaError(redirectTo: string, error: string) {
  const separator = redirectTo.includes("?") ? "&" : "?";
  return `${redirectTo}${separator}error=${encodeURIComponent(error)}`;
}

function toIsoDateFromExcel(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(Math.round((value - 25569) * 86400 * 1000));
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  }

  const raw = String(value).trim();
  if (!raw) return null;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(raw);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;

  const es = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/.exec(raw);
  if (!es) return raw;
  const year = es[3].length === 2 ? `20${es[3]}` : es[3];
  return `${year}-${es[2].padStart(2, "0")}-${es[1].padStart(2, "0")}`;
}

function toNullableTextFromExcel(value: unknown) {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function toNullableIntegerFromExcel(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function toNullableDecimalFromExcel(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  return parseDecimalToNumber(value);
}

function hasAnyExcelValue(row: unknown[]) {
  return row.slice(0, 16).some((cell) => {
    if (cell === null || cell === undefined) return false;
    if (cell instanceof Date) return !Number.isNaN(cell.getTime());
    return String(cell).trim() !== "";
  });
}

function parseProgramaFilterValue(v: string | undefined | null): {
  isNone: boolean;
  id: number | null;
} {
  const raw = String(v ?? "").trim();
  if (!raw) return { isNone: false, id: null };
  if (raw === "none") return { isNone: true, id: null };
  const id = Number(raw);
  return Number.isFinite(id) ? { isNone: false, id } : { isNone: false, id: null };
}

async function upsertNomina(formData: FormData) {
  "use server";

  const clubId = Number(formData.get("club_id"));
  const id = String(formData.get("id_contabilidad") ?? "").trim();

  if (!clubId || !Number.isFinite(clubId)) {
    redirect("/nominas?error=club_id%20inv%C3%A1lido");
  }

  const proveedor_id = toNullableBigint(formData.get("proveedor_id"));
  const personal_id = toNullableBigint(formData.get("personal_id"));
  const concepto_id = toNullableBigint(formData.get("concepto_id"));
  const entidad_id = toNullableBigint(formData.get("entidad_id"));
  const programa_id = toNullableBigint(formData.get("programa_id"));
  const categoria_id = toNullableBigint(formData.get("categoria_id"));

  const fecha = toNullableText(formData.get("fecha")); // YYYY-MM-DD
  const fecha_pago = toNullableText(formData.get("fecha_pago")); // YYYY-MM-DD

  // Campos nómina (numéricos)
  const bruto = toNullableNumber(formData.get("bruto"));
  const bruto_imputado = toNullableNumber(formData.get("bruto_imputado"));
  const coste_empresarial = toNullableNumber(formData.get("coste_empresarial"));
  const ss = toNullableNumber(formData.get("ss"));
  const ss_imputado = toNullableNumber(formData.get("ss_imputado"));

  // Totales (obligatorios en tu tabla; default 0 en DB, pero aquí validamos)
  const importe_total = toNumberFromFormValue(formData.get("importe_total"));
  const importe_imputado = toNumberFromFormValue(formData.get("importe_imputado"));

  const detalle = toNullableText(formData.get("detalle"));

  if (!Number.isFinite(importe_total)) {
    redirect("/nominas?error=importe_total%20inv%C3%A1lido");
  }
  if (!Number.isFinite(importe_imputado)) {
    redirect("/nominas?error=importe_imputado%20inv%C3%A1lido");
  }
  if (!personal_id) {
    redirect("/nominas?error=personal_id%20obligatorio");
  }

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const myRole = await getMyClubRole(clubId);
  if (!canEditClubData(myRole)) redirect("/no-autorizado");

  // OJO: forzamos tipo_id = 3 siempre
  const payload: any = {
    club_id: clubId,
    tipo_id: NOMINA_TIPO_ID,

    proveedor_id,
    personal_id,
    concepto_id,
    entidad_id,
    programa_id,
    categoria_id,

    fecha,
    fecha_pago,

    bruto,
    bruto_imputado,
    coste_empresarial,
    ss,
    ss_imputado,

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
        .eq("tipo_id", NOMINA_TIPO_ID)
    : await supabase.from("contabilidad").insert(payload);

  if (error) redirect("/nominas?error=" + encodeURIComponent(error.message));
  redirect("/nominas");
}

async function importNominasExcel(formData: FormData) {
  "use server";

  const clubId = Number(formData.get("club_id"));
  const redirectTo = safeNominaRedirect(formData.get("redirect_to"));
  const file = formData.get("excel_file");

  if (!clubId || !Number.isFinite(clubId)) {
    redirect(appendNominaError(redirectTo, "club_id_invalido"));
  }
  if (!(file instanceof File) || file.size === 0) {
    redirect(appendNominaError(redirectTo, "archivo_excel_obligatorio"));
  }

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const myRole = await getMyClubRole(clubId);
  if (!canEditClubData(myRole)) redirect("/no-autorizado");

  const rows = (await readSheet(file)) as unknown[][];
  const dataRows = rows.filter(hasAnyExcelValue);
  const first = dataRows[0] ?? [];
  const firstCell = String(first[0] ?? "").trim().toLowerCase();
  const rowsWithoutHeader =
    firstCell.includes("personal") || firstCell.includes("empleado")
      ? dataRows.slice(1)
      : dataRows;

  const payload = rowsWithoutHeader.map((row) => {
    const bruto = toNullableDecimalFromExcel(row[3]);
    const coste_empresarial = toNullableDecimalFromExcel(row[4]);
    const ss = toNullableDecimalFromExcel(row[5]);
    const bruto_imputado = toNullableDecimalFromExcel(row[6]);
    const ss_imputado = toNullableDecimalFromExcel(row[7]);
    const importeTotal = toNullableDecimalFromExcel(row[14]);
    const importeImputado = toNullableDecimalFromExcel(row[15]);

    return {
      club_id: clubId,
      tipo_id: NOMINA_TIPO_ID,
      personal_id: toNullableIntegerFromExcel(row[0]),
      fecha: toIsoDateFromExcel(row[1]),
      fecha_pago: toIsoDateFromExcel(row[2]),
      bruto,
      coste_empresarial,
      ss,
      bruto_imputado,
      ss_imputado,
      proveedor_id: toNullableIntegerFromExcel(row[8]),
      categoria_id: toNullableIntegerFromExcel(row[9]),
      programa_id: toNullableIntegerFromExcel(row[10]),
      concepto_id: toNullableIntegerFromExcel(row[11]),
      entidad_id: toNullableIntegerFromExcel(row[12]),
      detalle: toNullableTextFromExcel(row[13]),
      importe_total: importeTotal ?? Number(bruto ?? 0) + Number(ss ?? 0),
      importe_imputado:
        importeImputado ?? Number(bruto_imputado ?? 0) + Number(ss_imputado ?? 0),
    };
  });

  if (payload.length === 0) {
    redirect(appendNominaError(redirectTo, "excel_sin_datos_importables"));
  }

  const { error } = await supabase.from("contabilidad").insert(payload);
  if (error) redirect(appendNominaError(redirectTo, error.message));

  redirect(redirectTo);
}

export default async function NominasPage({
  searchParams,
}: {
  searchParams?: Promise<{
    error?: string;
    edit?: string;
    panel?: string;
    programa_id?: string;
    personal_id?: string;
    categoria_id?: string;
    fecha_desde?: string;
    fecha_hasta?: string;
    sort?: string;
    dir?: string;
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

  const programaFilter = parseProgramaFilterValue(sp.programa_id);
  const personalFilterId = sp.personal_id ? Number(sp.personal_id) : null;
  const hasPersonalFilter = !!personalFilterId && Number.isFinite(personalFilterId);
  const categoriaFilterId = sp.categoria_id ? Number(sp.categoria_id) : null;
  const hasCategoriaFilter = !!categoriaFilterId && Number.isFinite(categoriaFilterId);
  const fechaDesde = String(sp.fecha_desde ?? "").trim();
  const fechaHasta = String(sp.fecha_hasta ?? "").trim();
  const sortKey = ([
    "fecha",
    "personal",
    "proveedor",
    "programa",
    "categoria",
    "concepto",
    "bruto",
    "ss",
    "importe_total",
    "importe_imputado",
    "fecha_pago",
  ].includes(String(sp.sort))
    ? sp.sort
    : "fecha") as NominasSortKey;
  const sortDirection: SortDirection = sp.dir === "asc" ? "asc" : "desc";
  const isProgramaNoneFilter = programaFilter.isNone;
  const programaFilterId = programaFilter.id;
  const hasProgramaFilter =
    isProgramaNoneFilter ||
    (!!programaFilterId && Number.isFinite(programaFilterId));
  const exportParams = new URLSearchParams();
  if (hasProgramaFilter) {
    exportParams.set(
      "programa_id",
      isProgramaNoneFilter ? "none" : String(programaFilterId)
    );
  }
  const exportHref = `/nominas/export${exportParams.toString() ? `?${exportParams.toString()}` : ""}`;

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

  // Programas primero (solo activos) para filtrar la query principal
  const { data: programas } = await supabase
    .from("programas")
    .select("id_programa, programa")
    .eq("club_id", clubId)
    .eq("activo", true)
    .order("programa", { ascending: true });

  const activeProgramIds = (programas ?? []).map((p: any) => Number(p.id_programa));

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

  // Nóminas (contabilidad tipo_id=3) + joins
  let q = supabase
    .from("contabilidad")
    .select(
      [
        "id_contabilidad",
        "tipo_id",
        "bruto",
        "bruto_imputado",
        "coste_empresarial",
        "ss",
        "ss_imputado",
        "personal_id",
        "proveedor_id",
        "fecha",
        "fecha_pago",
        "importe_total",
        "importe_imputado",
        "concepto_id",
        "entidad_id",
        "programa_id",
        "categoria_id",
        "detalle",
        "created_at",
        // joins
        "proveedor:proveedores!contabilidad_proveedor_fk (id_proveedor, proveedor)",
        "programa_ref:programas!contabilidad_programa_id_fkey (id_programa, programa)",
        "categoria_ref:categorias!contabilidad_categoria_id_fkey (id_categoria, categoria)",
        "concepto_ref:conceptos!contabilidad_concepto_id_fkey (id_concepto, concepto)",
        "entidad_ref:entidades!contabilidad_entidad_id_fkey (id_entidad, entidad)",
      ].join(",")
    )
    .eq("club_id", clubId)
    .eq("tipo_id", NOMINA_TIPO_ID);

  if (hasProgramaFilter) {
    q = isProgramaNoneFilter ? q.is("programa_id", null) : q.eq("programa_id", programaFilterId);
  } else {
    // Sin filtro: excluir nóminas de programas dados de baja
    if (activeProgramIds.length > 0) {
      q = q.or(`programa_id.is.null,programa_id.in.(${activeProgramIds.join(",")})`);
    } else {
      q = q.is("programa_id", null);
    }
  }
  if (hasPersonalFilter) q = q.eq("personal_id", personalFilterId);
  if (hasCategoriaFilter) q = q.eq("categoria_id", categoriaFilterId);
  if (fechaDesde) q = q.gte("fecha", fechaDesde);
  if (fechaHasta) q = q.lte("fecha", fechaHasta);

  const nominasPromise = q
    .order("fecha", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(500);

  const [
    { data: proveedores },
    { data: conceptos },
    { data: entidades },
    { data: personal },
    { data: categorias },
    { data: rows, error },
  ] = await Promise.all([
    proveedoresPromise,
    conceptosPromise,
    entidadesPromise,
    personalPromise,
    categoriasPromise,
    nominasPromise,
  ]);

  const rowsAny = (rows ?? []) as any[];

  // Totales por categoría (A/B/otras) como contabilidad
  type Tot = {
    total: number;
    imputado: number;
    bruto: number;
    coste: number;
    count: number;
  };
  const totales = rowsAny.reduce(
    (acc, r: any) => {
      const total = Number(r.importe_total ?? 0) || 0;
      const imputado = Number(r.importe_imputado ?? 0) || 0;
      const bruto = Number(r.bruto ?? 0) || 0;
      const coste = Number(r.coste_empresarial ?? 0) || 0;
      const cat = String(r.categoria_ref?.categoria ?? "").toUpperCase();

      acc.global.total += total;
      acc.global.imputado += imputado;
      acc.global.bruto += bruto;
      acc.global.coste += coste;
      acc.global.count += 1;

      if (cat === "A") {
        acc.A.total += total;
        acc.A.imputado += imputado;
        acc.A.bruto += bruto;
        acc.A.coste += coste;
        acc.A.count += 1;
      } else if (cat === "B") {
        acc.B.total += total;
        acc.B.imputado += imputado;
        acc.B.bruto += bruto;
        acc.B.coste += coste;
        acc.B.count += 1;
      } else {
        acc.otras.total += total;
        acc.otras.imputado += imputado;
        acc.otras.bruto += bruto;
        acc.otras.coste += coste;
        acc.otras.count += 1;
      }
      return acc;
    },
    {
      global: { total: 0, imputado: 0, bruto: 0, coste: 0, count: 0 } as Tot,
      A: { total: 0, imputado: 0, bruto: 0, coste: 0, count: 0 } as Tot,
      B: { total: 0, imputado: 0, bruto: 0, coste: 0, count: 0 } as Tot,
      otras: { total: 0, imputado: 0, bruto: 0, coste: 0, count: 0 } as Tot,
    }
  );

  // Edit row
  let editRow: any =
    editId !== null ? rowsAny.find((r) => Number(r.id_contabilidad) === Number(editId)) : null;

  // Fallback: si no está (por ejemplo si limitaste) lo cargamos por id
  if (editId && !editRow) {
    const { data: one } = await supabase
      .from("contabilidad")
      .select(
        [
          "id_contabilidad",
          "tipo_id",
          "bruto",
          "bruto_imputado",
          "coste_empresarial",
        "ss",
        "ss_imputado",
        "personal_id",
        "proveedor_id",
        "fecha",
        "fecha_pago",
          "importe_total",
          "importe_imputado",
          "concepto_id",
          "entidad_id",
          "programa_id",
          "categoria_id",
          "detalle",
          "created_at",
        ].join(",")
      )
      .eq("club_id", clubId)
      .eq("tipo_id", NOMINA_TIPO_ID)
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

  const nominaFilterParams = {
    fecha_desde: fechaDesde,
    fecha_hasta: fechaHasta,
    personal_id: hasPersonalFilter ? String(personalFilterId) : "",
    programa_id: hasProgramaFilter ? (isProgramaNoneFilter ? "none" : String(programaFilterId)) : "",
    categoria_id: hasCategoriaFilter ? String(categoriaFilterId) : "",
  };
  const listHref = buildFilterHref("/nominas", nominaFilterParams, []);
  const editRedirectParams = new URLSearchParams(
    listHref.split("?")[1] ?? ""
  );
  if (editRow?.id_contabilidad) {
    editRedirectParams.set("edit", String(editRow.id_contabilidad));
  }
  const editRedirectHref = editRow
    ? `/nominas?${editRedirectParams.toString()}#form`
    : listHref;
  const isDrawerOpen = canUserEdit && (isNewPanel || !!editRow);

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    display: "grid",
    gap: 4,
  };

  const personalMap = new Map<number, string>();
  (personal ?? []).forEach((p: any) => {
    if (p?.id_personal) personalMap.set(Number(p.id_personal), p.nombre ?? "");
  });
  const sortedRowsAny = [...rowsAny].sort((a: any, b: any) => {
    function value(row: any) {
      switch (sortKey) {
        case "personal":
          return personalMap.get(Number(row.personal_id)) ?? "";
        case "proveedor":
          return row.proveedor?.proveedor ?? "";
        case "programa":
          return row.programa_ref?.programa ?? "";
        case "categoria":
          return row.categoria_ref?.categoria ?? "";
        case "concepto":
          return row.concepto_ref?.concepto ?? "";
        default:
          return row[sortKey];
      }
    }

    const av = value(a);
    const bv = value(b);
    let result = 0;

    if (["bruto", "ss", "importe_total", "importe_imputado"].includes(sortKey)) {
      result = Number(av ?? 0) - Number(bv ?? 0);
    } else {
      result = String(av ?? "").localeCompare(String(bv ?? ""), "es", {
        sensitivity: "base",
      });
    }

    return sortDirection === "asc" ? result : -result;
  });

  function sortHref(nextSort: NominasSortKey) {
    return buildFilterHref(
      "/nominas",
      {
        ...nominaFilterParams,
        sort: nextSort,
        dir: sortKey === nextSort && sortDirection === "asc" ? "desc" : "asc",
      },
      []
    );
  }

  function sortHeader(nextSort: NominasSortKey, label: string) {
    const active = sortKey === nextSort;
    return (
      <th
        style={{
          textAlign: "left",
          borderBottom: "1px solid #ddd",
          padding: 8,
          whiteSpace: "nowrap",
        }}
      >
        <Link
          href={sortHref(nextSort)}
          className="table-sort-button"
          aria-label={`Ordenar por ${label}`}
        >
          <span>{label}</span>
          <span aria-hidden="true">{active ? (sortDirection === "asc" ? "↑" : "↓") : "↕"}</span>
        </Link>
      </th>
    );
  }


  const compactSelectStyle: React.CSSProperties = {
    height: 32,
    minHeight: 32,
    lineHeight: "normal",
    padding: "0 8px",
    fontSize: 13,
    boxSizing: "border-box",
    display: "block",
    width: "100%",
  };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 16 }}>
      <div className="page-toolbar" style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Nóminas</h1>
        {canUserEdit ? (
          <>
            <Link
              href="/nominas/importar-costes"
              className="icon-button icon-button-secondary tooltip-button"
              aria-label="Importar costes laborales desde Excel"
              title="Importar costes laborales desde Excel"
              style={{ marginLeft: "auto" }}
            >
              <Icon name="upload" />
            </Link>
            <Link
              href={`${buildFilterHref("/nominas", { ...nominaFilterParams, panel: "new" }, [])}#form`}
              className="icon-button tooltip-button"
              aria-label="Nueva nomina"
            >
              <Icon name="new" />
            </Link>
          </>
        ) : null}
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
          {editRow ? `Editar nómina (id ${editRow.id_contabilidad})` : "Nueva nómina"}
        </h2>

        {!canUserEdit ? (
          <p style={{ margin: 0, opacity: 0.8 }}>No tienes permisos para crear/editar nóminas.</p>
        ) : (
          <NominaForm
            action={upsertNomina}
            clubId={clubId}
            editRow={editRow}
            personal={personal ?? []}
            proveedores={proveedores ?? []}
            conceptos={conceptos ?? []}
            entidades={entidades ?? []}
            programas={programas ?? []}
            categorias={categorias ?? []}
            documentos={documentos}
            uploadDocumentosAction={uploadDocumentosAction}
            deleteDocumentoAction={deleteDocumentoAction}
            downloadDocumentoAction={downloadDocumentoAction}
            redirectTo={editRedirectHref}
            cancelHref={listHref}
          />
        )}
        {!editRow && canUserEdit ? (
          <div
            style={{
              borderTop: "1px solid #e5e7eb",
              marginTop: 14,
              paddingTop: 14,
              display: "grid",
              gap: 10,
            }}
          >
            <h3 style={{ margin: 0, fontSize: 14 }}>Importar desde Excel</h3>
            <div
              style={{
                border: "1px solid #dbeafe",
                background: "#eff6ff",
                borderRadius: 8,
                padding: 10,
                fontSize: 13,
                lineHeight: 1.45,
              }}
            >
              El archivo debe tener la primera hoja con estas columnas en este orden:
              <br />
              personal_id, fecha, fecha_pago, bruto, coste_empresarial, ss,
              bruto_imputado, ss_imputado, proveedor_id, categoria_id, programa_id,
              concepto_id, entidad_id, detalle, importe_total, importe_imputado.
              <br />
              La primera fila puede contener cabeceras. Las fechas pueden estar como
              fecha de Excel, AAAA-MM-DD o DD/MM/AAAA. Usa formato .xlsx.
            </div>
            <form action={importNominasExcel} style={{ display: "grid", gap: 10 }}>
              <input type="hidden" name="club_id" value={clubId} />
              <input type="hidden" name="redirect_to" value={listHref} />
              <label style={labelStyle}>
                Archivo Excel
                <input
                  name="excel_file"
                  type="file"
                  accept=".xlsx"
                  required
                  style={compactSelectStyle}
                />
              </label>
              <div className="drawer-actions">
                <button
                  type="submit"
                  className="icon-button tooltip-button"
                  aria-label="Importar nominas desde Excel"
                >
                  <Icon name="upload" />
                </button>
              </div>
            </form>
          </div>
        ) : null}
        {editRow && (
          <div className="danger-zone">
            <form action={deleteContabilidadWithDocsAction}>
              <input type="hidden" name="club_id" value={clubId} />
              <input type="hidden" name="id_contabilidad" value={editRow.id_contabilidad} />
              <input type="hidden" name="expected_tipo_id" value={NOMINA_TIPO_ID} />
              <input
                type="hidden"
                name="redirect_to"
                value={
                  hasProgramaFilter
                    ? `/nominas?programa_id=${isProgramaNoneFilter ? "none" : programaFilterId}`
                    : "/nominas"
                }
              />
              <ConfirmSubmitButton
                message="Se eliminara la nomina y todos sus documentos. Continuar?"
                className="icon-button icon-button-danger tooltip-button"
                ariaLabel="Eliminar nomina"
              >
                <Icon name="delete" />
              </ConfirmSubmitButton>
            </form>
          </div>
        )}
          </div>
        </>
      ) : null}

      {/* Filtro por programa */}
      <AutoSubmitFilters action="/nominas">
        <label className="filter-field">
          <span>Desde</span>
          <div className="filter-control-row">
            <input type="date" name="fecha_desde" defaultValue={fechaDesde} />
            <Link href={buildFilterHref("/nominas", nominaFilterParams, ["fecha_desde"])} className="filter-reset-button" aria-label="Limpiar desde">X</Link>
          </div>
        </label>
        <label className="filter-field">
          <span>Hasta</span>
          <div className="filter-control-row">
            <input type="date" name="fecha_hasta" defaultValue={fechaHasta} />
            <Link href={buildFilterHref("/nominas", nominaFilterParams, ["fecha_hasta"])} className="filter-reset-button" aria-label="Limpiar hasta">X</Link>
          </div>
        </label>
        <label className="filter-field">
          <span>Personal</span>
          <select name="personal_id" defaultValue={hasPersonalFilter ? String(personalFilterId) : ""}>
            <option value="">Todos</option>
            {(personal ?? []).map((p: any) => <option key={p.id_personal} value={p.id_personal}>{p.nombre}</option>)}
          </select>
        </label>
        <label className="filter-field">
          <span>Programa</span>
          <select name="programa_id" defaultValue={hasProgramaFilter ? (isProgramaNoneFilter ? "none" : String(programaFilterId)) : ""}>
            <option value="">Todos</option>
            <option value="none">(sin programa)</option>
            {(programas ?? []).map((p: any) => <option key={p.id_programa} value={p.id_programa}>{p.programa}</option>)}
          </select>
        </label>
        <label className="filter-field">
          <span>Categoría</span>
          <select name="categoria_id" defaultValue={hasCategoriaFilter ? String(categoriaFilterId) : ""}>
            <option value="">Todas</option>
            {(categorias ?? []).map((c: any) => <option key={c.id_categoria} value={c.id_categoria}>{c.categoria}</option>)}
          </select>
        </label>
      </AutoSubmitFilters>

      <div style={{ display: "none" }}>
        <form method="get" action="/nominas" style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap" }}>
          {editId ? <input type="hidden" name="edit" value={String(editId)} /> : null}

          <label style={labelStyle}>
            Filtrar por programa
            <select
              name="programa_id"
              defaultValue={
                hasProgramaFilter
                  ? isProgramaNoneFilter
                    ? "none"
                    : String(programaFilterId)
                  : ""
              }
              style={{ ...compactSelectStyle, minWidth: 260 }}
            >
              <option value="">(todos)</option>
              <option value="none">(sin programa)</option>
              {(programas ?? []).map((p: any) => (
                <option key={p.id_programa} value={p.id_programa}>
                  {p.programa}
                </option>
              ))}
            </select>
          </label>

          <button type="submit" style={{ padding: "10px 12px", cursor: "pointer" }}>
            Aplicar filtro
          </button>

          <Link href="/nominas" style={{ padding: "10px 12px", opacity: 0.8 }}>
            Quitar filtro
          </Link>

          <a
            href={exportHref}
            style={{
              padding: "10px 12px",
              background: "#111",
              color: "#fff",
              borderRadius: 8,
              textDecoration: "none",
            }}
          >
            Exportar nóminas
          </a>
        </form>
      </div>

      {/* Totales */}
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
          Totales {hasProgramaFilter ? "del programa seleccionado" : "(todos los programas)"}
        </div>

        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(4, 1fr)" }}>
          <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 10 }}>
            <div style={{ fontWeight: 700 }}>Global ({totales.global.count})</div>
            <div>Bruto: <b>{formatDecimal(totales.global.bruto)}</b></div>
            <div>Coste empresarial: <b>{formatDecimal(totales.global.coste)}</b></div>
            <div>Total: <b>{formatDecimal(totales.global.total)}</b></div>
            <div>Imputado: <b>{formatDecimal(totales.global.imputado)}</b></div>
          </div>

          <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 10 }}>
            <div style={{ fontWeight: 700 }}>Categoría A ({totales.A.count})</div>
            <div>Bruto: <b>{formatDecimal(totales.A.bruto)}</b></div>
            <div>Coste empresarial: <b>{formatDecimal(totales.A.coste)}</b></div>
            <div>Total: <b>{formatDecimal(totales.A.total)}</b></div>
            <div>Imputado: <b>{formatDecimal(totales.A.imputado)}</b></div>
          </div>

          <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 10 }}>
            <div style={{ fontWeight: 700 }}>Categoría B ({totales.B.count})</div>
            <div>Bruto: <b>{formatDecimal(totales.B.bruto)}</b></div>
            <div>Coste empresarial: <b>{formatDecimal(totales.B.coste)}</b></div>
            <div>Total: <b>{formatDecimal(totales.B.total)}</b></div>
            <div>Imputado: <b>{formatDecimal(totales.B.imputado)}</b></div>
          </div>

          <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 10 }}>
            <div style={{ fontWeight: 700 }}>Sin categoría / otras ({totales.otras.count})</div>
            <div>Bruto: <b>{formatDecimal(totales.otras.bruto)}</b></div>
            <div>Coste empresarial: <b>{formatDecimal(totales.otras.coste)}</b></div>
            <div>Total: <b>{formatDecimal(totales.otras.total)}</b></div>
            <div>Imputado: <b>{formatDecimal(totales.otras.imputado)}</b></div>
          </div>
        </div>
      </div>

      {/* Listado */}
      <h2 style={{ fontSize: 16, marginTop: 16, marginBottom: 8 }}>
        Registros de nóminas {
          hasProgramaFilter
            ? isProgramaNoneFilter
              ? "(sin programa)"
              : `(programa_id: ${programaFilterId})`
            : ""
        } ({rowsAny.length})
      </h2>

      <NominasTable
        rows={sortedRowsAny}
        canEdit={canUserEdit}
        personal={personal ?? []}
        proveedores={proveedores ?? []}
        programas={programas ?? []}
        conceptos={conceptos ?? []}
        categorias={categorias ?? []}
        entidades={entidades ?? []}
        filterParams={nominaFilterParams}
        sortKey={sortKey}
        sortDir={sortDirection}
      />
    </div>
  );
}
