import Link from "next/link";
import { redirect } from "next/navigation";
import * as XLSX from "xlsx";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveClubId } from "@/lib/club";
import { canEditClubData, getMyClubRole } from "@/lib/clubRole";
import { parseDecimalToNumber } from "@/lib/decimal";
import {
  formatDecimal,
  toDateInputValue,
  toDecimalInputValue,
} from "@/lib/format";
import BancosTable from "./BancosTable";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { Icon } from "@/components/Icon";
import { deleteBancoAction } from "./actions";
import { AutoSubmitFilters } from "@/components/AutoSubmitFilters";
import { buildFilterHref } from "@/lib/filters";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

function toNullableText(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

function toNullableBigint(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function toNullableInteger(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function toNullableDecimal(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  return parseDecimalToNumber(s);
}

function toSelectValue(v: any): string {
  if (v === null || v === undefined || v === "") return "";
  return String(v);
}

function safeBancoRedirect(value: FormDataEntryValue | null) {
  const redirectTo = String(value ?? "/bancos").trim();
  return redirectTo.startsWith("/bancos") ? redirectTo : "/bancos";
}

function appendBancoError(redirectTo: string, error: string) {
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
  if (!es) return null;
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
  return row.slice(0, 14).some((cell) => {
    if (cell === null || cell === undefined) return false;
    if (cell instanceof Date) return !Number.isNaN(cell.getTime());
    return String(cell).trim() !== "";
  });
}

async function upsertBanco(formData: FormData) {
  "use server";

  const clubId = Number(formData.get("club_id"));
  const id = String(formData.get("id_banco") ?? "").trim();
  const redirectTo = safeBancoRedirect(formData.get("redirect_to"));

  if (!clubId || !Number.isFinite(clubId)) {
    redirect(appendBancoError(redirectTo, "club_id_invalido"));
  }

  const fecha_operativa = toNullableText(formData.get("fecha_operativa"));
  const fecha_valor = toNullableText(formData.get("fecha_valor"));
  const detalle = toNullableText(formData.get("detalle"));
  const referencia = toNullableText(formData.get("referencia"));
  const referencia_1 = toNullableText(formData.get("referencia_1"));
  const referencia_2 = toNullableText(formData.get("referencia_2"));
  const categoria = toNullableText(formData.get("categoria"));
  const programa_id = toNullableBigint(formData.get("programa_id"));
  const concepto_id = toNullableBigint(formData.get("concepto_id"));
  const orden = toNullableInteger(formData.get("orden"));

  const debe = toNullableDecimal(formData.get("debe"));
  if (String(formData.get("debe") ?? "").trim() && debe === null) {
    redirect(appendBancoError(redirectTo, "debe_invalido"));
  }

  const haber = toNullableDecimal(formData.get("haber"));
  if (String(formData.get("haber") ?? "").trim() && haber === null) {
    redirect(appendBancoError(redirectTo, "haber_invalido"));
  }

  const saldo = toNullableDecimal(formData.get("saldo"));
  if (String(formData.get("saldo") ?? "").trim() && saldo === null) {
    redirect(appendBancoError(redirectTo, "saldo_invalido"));
  }

  const importe = toNullableDecimal(formData.get("importe"));
  if (String(formData.get("importe") ?? "").trim() && importe === null) {
    redirect(appendBancoError(redirectTo, "importe_invalido"));
  }

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const myRole = await getMyClubRole(clubId);
  if (!canEditClubData(myRole)) redirect("/no-autorizado");

  const payload: any = {
    club_id: clubId,
    fecha_operativa,
    detalle,
    debe,
    haber,
    saldo,
    referencia,
    categoria,
    programa_id,
    fecha_valor,
    importe,
    referencia_1,
    referencia_2,
    concepto_id,
    orden,
  };

  const { error } = id
    ? await supabase
        .from("bancos")
        .update(payload)
        .eq("club_id", clubId)
        .eq("id_banco", Number(id))
    : await supabase.from("bancos").insert(payload);

  if (error) {
    redirect(appendBancoError(redirectTo, error.message));
  }

  redirect(redirectTo);
}

async function importBancoExcel(formData: FormData) {
  "use server";

  const clubId = Number(formData.get("club_id"));
  const redirectTo = safeBancoRedirect(formData.get("redirect_to"));
  const file = formData.get("excel_file");

  if (!clubId || !Number.isFinite(clubId)) {
    redirect(appendBancoError(redirectTo, "club_id_invalido"));
  }
  if (!(file instanceof File) || file.size === 0) {
    redirect(appendBancoError(redirectTo, "archivo_excel_obligatorio"));
  }

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const myRole = await getMyClubRole(clubId);
  if (!canEditClubData(myRole)) redirect("/no-autorizado");

  const buffer = Buffer.from(await (file as File).arrayBuffer());
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
    blankrows: false,
  }) as unknown[][];

  const dataRows = rows.filter(hasAnyExcelValue);
  const first = dataRows[0] ?? [];
  // Si la primera celda no se puede parsear como fecha válida → es cabecera, saltarla
  const firstIsHeader = toIsoDateFromExcel(first[0]) === null;
  const rowsWithoutHeader = firstIsHeader ? dataRows.slice(1) : dataRows;

  const payload = rowsWithoutHeader
    .map((row) => ({
      club_id: clubId,
      fecha_operativa: toIsoDateFromExcel(row[0]),
      fecha_valor: toIsoDateFromExcel(row[1]),
      detalle: toNullableTextFromExcel(row[2]),
      referencia: toNullableTextFromExcel(row[3]),
      categoria: toNullableTextFromExcel(row[4]),
      debe: toNullableDecimalFromExcel(row[5]),
      haber: toNullableDecimalFromExcel(row[6]),
      saldo: toNullableDecimalFromExcel(row[7]),
      importe: toNullableDecimalFromExcel(row[8]),
      referencia_1: toNullableTextFromExcel(row[9]),
      referencia_2: toNullableTextFromExcel(row[10]),
      programa_id: toNullableIntegerFromExcel(row[11]),
      concepto_id: toNullableIntegerFromExcel(row[12]),
      orden: toNullableIntegerFromExcel(row[13]),
    }));

  if (payload.length === 0) {
    redirect(appendBancoError(redirectTo, "excel_sin_datos_importables"));
  }

  const { error } = await supabase.from("bancos").insert(payload);
  if (error) redirect(appendBancoError(redirectTo, error.message));

  redirect(redirectTo);
}

export default async function BancosPage({
  searchParams,
}: {
  searchParams?: Promise<{
    error?: string;
    edit?: string;
    panel?: string;
    programa_id?: string;
    concepto_id?: string;
    fecha_operativa_desde?: string;
    fecha_operativa_hasta?: string;
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
  const conceptoFilterId = sp.concepto_id ? Number(sp.concepto_id) : null;
  const hasConceptoFilter = !!conceptoFilterId && Number.isFinite(conceptoFilterId);
  const fechaOperativaDesde = String(sp.fecha_operativa_desde ?? "").trim();
  const fechaOperativaHasta = String(sp.fecha_operativa_hasta ?? "").trim();
  const isProgramaNoneFilter = programaFilter.isNone;
  const programaFilterId = programaFilter.id;
  const hasProgramaFilter =
    isProgramaNoneFilter ||
    (!!programaFilterId && Number.isFinite(programaFilterId));

  const SORT_COLS = ["fecha_operativa", "detalle", "debe", "haber", "saldo", "importe"] as const;
  type BancosSortKey = typeof SORT_COLS[number];
  const sortKey: BancosSortKey = SORT_COLS.includes(sp.sort as BancosSortKey)
    ? (sp.sort as BancosSortKey)
    : "fecha_operativa";
  const sortDir: "asc" | "desc" = sp.dir === "asc" ? "asc" : "desc";

  // Solo programas activos — filtrará movimientos bancarios de programas dados de baja
  const { data: programas } = await supabase
    .from("programas")
    .select("id_programa, programa, anio")
    .eq("club_id", clubId)
    .eq("activo", true)
    .order("programa", { ascending: true });

  const activeProgramIds = (programas ?? []).map((p: any) => Number(p.id_programa));

  const { data: conceptos } = await supabase
    .from("conceptos")
    .select("id_concepto, concepto")
    .order("concepto", { ascending: true });

  let q = supabase
    .from("bancos")
    .select(
      [
        "id_banco",
        "fecha_operativa",
        "detalle",
        "debe",
        "haber",
        "saldo",
        "referencia",
        "categoria",
        "programa_id",
        "created_at",
        "fecha_valor",
        "importe",
        "referencia_1",
        "referencia_2",
        "concepto_id",
        "orden",
      ].join(",")
    )
    .eq("club_id", clubId);

  if (hasProgramaFilter) {
    q = isProgramaNoneFilter ? q.is("programa_id", null) : q.eq("programa_id", programaFilterId);
  } else {
    // Sin filtro: excluir movimientos de programas dados de baja
    if (activeProgramIds.length > 0) {
      q = q.or(`programa_id.is.null,programa_id.in.(${activeProgramIds.join(",")})`);
    } else {
      q = q.is("programa_id", null);
    }
  }
  if (hasConceptoFilter) q = q.eq("concepto_id", conceptoFilterId);
  if (fechaOperativaDesde) q = q.gte("fecha_operativa", fechaOperativaDesde);
  if (fechaOperativaHasta) q = q.lte("fecha_operativa", fechaOperativaHasta);

  const { data: rows, error } = await q
    .order(sortKey, { ascending: sortDir === "asc", nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(2000);

  const rowsAny = (rows ?? []) as any[];

  let editRow: any =
    editId !== null ? rowsAny.find((r) => Number(r.id_banco) === Number(editId)) : null;

  if (editId && !editRow) {
    const { data: one } = await supabase
      .from("bancos")
      .select(
        [
          "id_banco",
          "fecha_operativa",
          "detalle",
          "debe",
          "haber",
          "saldo",
          "referencia",
          "categoria",
          "programa_id",
          "created_at",
          "fecha_valor",
          "importe",
          "referencia_1",
          "referencia_2",
          "concepto_id",
          "orden",
        ].join(",")
      )
      .eq("club_id", clubId)
      .eq("id_banco", editId)
      .maybeSingle();

    editRow = (one as any) ?? null;
  }

  const totales = rowsAny.reduce(
    (acc, r: any) => {
      acc.debe += Number(r.debe ?? 0) || 0;
      acc.haber += Number(r.haber ?? 0) || 0;
      acc.importe += Number(r.importe ?? 0) || 0;
      acc.count += 1;
      return acc;
    },
    { debe: 0, haber: 0, importe: 0, count: 0 }
  );

  const filterValue = hasProgramaFilter
    ? isProgramaNoneFilter
      ? "none"
      : String(programaFilterId)
    : null;
  const isDrawerOpen = canUserEdit && (isNewPanel || !!editRow);
  const bancoFilterParams = {
    programa_id: filterValue,
    concepto_id: hasConceptoFilter ? String(conceptoFilterId) : "",
    fecha_operativa_desde: fechaOperativaDesde,
    fecha_operativa_hasta: fechaOperativaHasta,
    sort: sortKey,
    dir: sortDir,
  };
  const listHref = buildFilterHref("/bancos", bancoFilterParams, []);

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    display: "grid",
    gap: 4,
  };

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

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 16 }}>
      <div className="page-toolbar" style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Banco</h1>
        {canUserEdit ? (
          <Link
            href={`${buildFilterHref("/bancos", { ...bancoFilterParams, panel: "new" }, [])}#form`}
            className="icon-button tooltip-button"
            aria-label="Nuevo movimiento"
            style={{ marginLeft: "auto" }}
          >
            <Icon name="new" />
          </Link>
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
          {editRow ? `Editar movimiento (id ${editRow.id_banco})` : "Nuevo movimiento"}
        </h2>

        {!canUserEdit ? (
          <p style={{ margin: 0, opacity: 0.8 }}>
            No tienes permisos para crear/editar movimientos.
          </p>
        ) : (
          <form action={upsertBanco} style={{ display: "grid", gap: 10 }}>
            <input type="hidden" name="club_id" value={clubId} />
            <input type="hidden" name="id_banco" value={editRow?.id_banco ?? ""} />
            <input type="hidden" name="redirect_to" value={listHref} />

            <div
              style={{
                display: "grid",
                gap: 10,
                gridTemplateColumns: "160px 160px 1.6fr 1fr 1fr",
                alignItems: "end",
              }}
            >
              <label style={labelStyle}>
                Fecha operativa
                <input
                  name="fecha_operativa"
                  type="date"
                  defaultValue={toDateInputValue(editRow?.fecha_operativa)}
                  style={compactFieldStyle}
                />
              </label>

              <label style={labelStyle}>
                Fecha valor
                <input
                  name="fecha_valor"
                  type="date"
                  defaultValue={toDateInputValue(editRow?.fecha_valor)}
                  style={compactFieldStyle}
                />
              </label>

              <label style={labelStyle}>
                Detalle
                <input
                  name="detalle"
                  defaultValue={editRow?.detalle ?? ""}
                  style={compactFieldStyle}
                />
              </label>

              <label style={labelStyle}>
                Referencia
                <input
                  name="referencia"
                  defaultValue={editRow?.referencia ?? ""}
                  style={compactFieldStyle}
                />
              </label>

              <label style={labelStyle}>
                Categoria
                <input
                  name="categoria"
                  defaultValue={editRow?.categoria ?? ""}
                  style={compactFieldStyle}
                />
              </label>
            </div>

            <div
              style={{
                display: "grid",
                gap: 10,
                gridTemplateColumns: "1.2fr 1.2fr 1fr 1fr 1fr 1fr",
                alignItems: "end",
              }}
            >
              <label style={labelStyle}>
                Programa
                <select
                  name="programa_id"
                  defaultValue={toSelectValue(editRow?.programa_id)}
                  style={compactFieldStyle}
                >
                  <option value="">(sin programa)</option>
                  {(programas ?? []).map((p: any) => (
                    <option key={p.id_programa} value={p.id_programa}>
                      {p.anio ? `[${p.anio}] ` : ""}{p.programa}
                    </option>
                  ))}
                </select>
              </label>

              <label style={labelStyle}>
                Concepto
                <select
                  name="concepto_id"
                  defaultValue={toSelectValue(editRow?.concepto_id)}
                  style={compactFieldStyle}
                >
                  <option value="">(sin concepto)</option>
                  {(conceptos ?? []).map((c: any) => (
                    <option key={c.id_concepto} value={c.id_concepto}>
                      {c.concepto}
                    </option>
                  ))}
                </select>
              </label>

              <label style={labelStyle}>
                Orden
                <input
                  name="orden"
                  type="number"
                  defaultValue={editRow?.orden ?? ""}
                  style={compactFieldStyle}
                />
              </label>
            </div>

            <div
              style={{
                display: "grid",
                gap: 10,
                gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr 1fr",
                alignItems: "end",
              }}
            >
              <label style={labelStyle}>
                Debe
                <input
                  name="debe"
                  type="text"
                  inputMode="decimal"
                  defaultValue={toDecimalInputValue(editRow?.debe)}
                  style={compactFieldStyle}
                />
              </label>

              <label style={labelStyle}>
                Haber
                <input
                  name="haber"
                  type="text"
                  inputMode="decimal"
                  defaultValue={toDecimalInputValue(editRow?.haber)}
                  style={compactFieldStyle}
                />
              </label>

              <label style={labelStyle}>
                Saldo
                <input
                  name="saldo"
                  type="text"
                  inputMode="decimal"
                  defaultValue={toDecimalInputValue(editRow?.saldo)}
                  style={compactFieldStyle}
                />
              </label>

              <label style={labelStyle}>
                Importe
                <input
                  name="importe"
                  type="text"
                  inputMode="decimal"
                  defaultValue={toDecimalInputValue(editRow?.importe)}
                  style={compactFieldStyle}
                />
              </label>

              <label style={labelStyle}>
                Ref. 1
                <input
                  name="referencia_1"
                  defaultValue={editRow?.referencia_1 ?? ""}
                  style={compactFieldStyle}
                />
              </label>

              <label style={labelStyle}>
                Ref. 2
                <input
                  name="referencia_2"
                  defaultValue={editRow?.referencia_2 ?? ""}
                  style={compactFieldStyle}
                />
              </label>
            </div>

            <div className="drawer-actions">
              <button
                type="submit"
                className="icon-button tooltip-button"
                aria-label={editRow ? "Guardar cambios" : "Crear movimiento"}
              >
                <Icon name="save" />
              </button>
              <a
                href={listHref}
                className="icon-button icon-button-secondary tooltip-button"
                aria-label="Cancelar"
              >
                <Icon name="logout" />
              </a>
            </div>
          </form>
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
              Fecha operativa, fecha valor, detalle, referencia, categoria, debe,
              haber, saldo, importe, referencia 1, referencia 2, programa_id,
              concepto_id, orden.
              <br />
              La primera fila puede contener cabeceras. Las fechas pueden estar como
              fecha de Excel, AAAA-MM-DD o DD/MM/AAAA. Usa formato .xlsx.
            </div>
            <form action={importBancoExcel} style={{ display: "grid", gap: 10 }}>
              <input type="hidden" name="club_id" value={clubId} />
              <input type="hidden" name="redirect_to" value={listHref} />
              <label style={labelStyle}>
                Archivo Excel
                <input
                  name="excel_file"
                  type="file"
                  accept=".xlsx"
                  required
                  style={compactFieldStyle}
                />
              </label>
              <div className="drawer-actions">
                <button
                  type="submit"
                  className="icon-button tooltip-button"
                  aria-label="Importar movimientos desde Excel"
                >
                  <Icon name="upload" />
                </button>
              </div>
            </form>
          </div>
        ) : null}
        {editRow && (
          <div className="danger-zone">
            <form action={deleteBancoAction}>
              <input type="hidden" name="club_id" value={clubId} />
              <input type="hidden" name="id_banco" value={editRow.id_banco} />
              <input
                type="hidden"
                name="redirect_to"
                value={listHref}
              />
              <ConfirmSubmitButton
                message="Se eliminara el movimiento. Continuar?"
                className="icon-button icon-button-danger tooltip-button"
                ariaLabel="Eliminar movimiento"
              >
                <Icon name="delete" />
              </ConfirmSubmitButton>
            </form>
          </div>
        )}
          </div>
        </>
      ) : null}

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
            <div style={{ fontWeight: 700 }}>Movimientos ({totales.count})</div>
            <div>Debe: <b>{formatDecimal(totales.debe)}</b></div>
            <div>Haber: <b>{formatDecimal(totales.haber)}</b></div>
            <div>Importe: <b>{formatDecimal(totales.importe)}</b></div>
          </div>
        </div>
      </div>

      <AutoSubmitFilters action="/bancos">
        <label className="filter-field">
          <span>Desde</span>
          <div className="filter-control-row">
            <input type="date" name="fecha_operativa_desde" defaultValue={fechaOperativaDesde} />
            <Link href={buildFilterHref("/bancos", bancoFilterParams, ["fecha_operativa_desde"])} className="filter-reset-button" aria-label="Limpiar desde">X</Link>
          </div>
        </label>
        <label className="filter-field">
          <span>Hasta</span>
          <div className="filter-control-row">
            <input type="date" name="fecha_operativa_hasta" defaultValue={fechaOperativaHasta} />
            <Link href={buildFilterHref("/bancos", bancoFilterParams, ["fecha_operativa_hasta"])} className="filter-reset-button" aria-label="Limpiar hasta">X</Link>
          </div>
        </label>
        <label className="filter-field">
          <span>Programa</span>
          <select name="programa_id" defaultValue={filterValue ?? ""}>
            <option value="">Todos</option>
            <option value="none">(sin programa)</option>
            {(programas ?? []).map((p: any) => <option key={p.id_programa} value={p.id_programa}>{p.anio ? `[${p.anio}] ` : ""}{p.programa}</option>)}
          </select>
        </label>
        <label className="filter-field">
          <span>Concepto</span>
          <select name="concepto_id" defaultValue={hasConceptoFilter ? String(conceptoFilterId) : ""}>
            <option value="">Todos</option>
            {(conceptos ?? []).map((c: any) => <option key={c.id_concepto} value={c.id_concepto}>{c.concepto}</option>)}
          </select>
        </label>
      </AutoSubmitFilters>

      <h2 style={{ fontSize: 16, marginTop: 16, marginBottom: 8 }}>
        Movimientos {hasProgramaFilter ? (isProgramaNoneFilter ? "(sin programa)" : `(programa_id: ${programaFilterId})`) : ""} ({rowsAny.length})
      </h2>

      <BancosTable
        rows={rowsAny as any}
        canEdit={canUserEdit}
        programas={programas ?? []}
        conceptos={conceptos ?? []}
        filterParams={bancoFilterParams}
        sortKey={sortKey}
        sortDir={sortDir}
      />

      <style>{`
        @media (max-width: 1000px) {
          .bancos-form-row {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }
      `}</style>
    </div>
  );
}
