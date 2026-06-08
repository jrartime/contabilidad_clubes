"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getActiveClubId } from "@/lib/club";
import { canEditClubData, getMyClubRole } from "@/lib/clubRole";
import * as XLSX from "xlsx";

const NOMINA_TIPO_ID = 3;

export type CostesRow = {
  personal_id: number;
  fecha: string; // YYYY-MM-DD
  bruto: number;
  coste_empresarial: number;
  ss: number;
  bruto_imputado: number;
  ss_imputado: number;
  importe_total: number;
  importe_imputado: number;
  programa_id?: number | null;
  categoria_id?: number | null;
  concepto_id?: number | null;
  entidad_id?: number | null;
};

type ActionResult =
  | { ok: true; count: number }
  | { ok: false; error: string };

export async function importarNominasCostesAction(rows: CostesRow[]): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const clubId = await getActiveClubId();
  if (!clubId) redirect("/clubs");

  const myRole = await getMyClubRole(clubId);
  if (!canEditClubData(myRole)) redirect("/no-autorizado");

  if (!rows.length) return { ok: false, error: "No hay filas para importar" };

  const payload = rows.map((r) => ({
    club_id: clubId,
    tipo_id: NOMINA_TIPO_ID,
    personal_id: r.personal_id,
    fecha: r.fecha,
    bruto: r.bruto,
    coste_empresarial: r.coste_empresarial,
    ss: r.ss,
    bruto_imputado: r.bruto_imputado,
    ss_imputado: r.ss_imputado,
    importe_total: r.importe_total,
    importe_imputado: r.importe_imputado,
    programa_id: r.programa_id ?? null,
    categoria_id: r.categoria_id ?? null,
    concepto_id: r.concepto_id ?? null,
    entidad_id: r.entidad_id ?? null,
  }));

  const { error } = await supabase.from("contabilidad").insert(payload);

  if (error) {
    console.error("[importarNominasCostes] insert error:", error.code, error.message, error.details);
    return { ok: false, error: `${error.message}${error.details ? ` (${error.details})` : ""}` };
  }

  revalidatePath("/nominas");
  return { ok: true, count: payload.length };
}

// ─────────────────────────────────────────────────────
// Parse Excel server-side (avoids client bundling issues)
// ─────────────────────────────────────────────────────
export type ParsedCostesRow = {
  trabajador: string;
  fecha: string;      // YYYY-MM-DD
  bruto: number;
  coste_empresarial: number;
};

type ParseResult =
  | { ok: true; rows: ParsedCostesRow[] }
  | { ok: false; error: string };

export async function parsearExcelCostesAction(formData: FormData): Promise<ParseResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "No se recibió ningún archivo" };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      defval: null,
      blankrows: false,
    });

    if (!raw.length) return { ok: false, error: "El archivo está vacío" };

    // Detect header row
    let dataStart = 0;
    let colTrabajador = 2;
    let colFecha = 3;
    let colBruto = 4;
    let colCoste = 11;

    for (let i = 0; i < Math.min(raw.length, 5); i++) {
      const row = (raw[i] as unknown[]).map((c) => String(c ?? "").trim().toUpperCase());
      if (row.some((c) => c.includes("TRABAJADOR") || c.includes("BRUTO"))) {
        dataStart = i + 1;
        const tIdx = row.findIndex((c) => c.includes("TRABAJADOR"));
        const fIdx = row.findIndex((c) => c === "FECHA" || c.includes("FECHA"));
        const bIdx = row.findIndex((c) => c === "BRUTO");
        const cIdx = row.findIndex((c) => c.includes("COSTE"));
        if (tIdx >= 0) colTrabajador = tIdx;
        if (fIdx >= 0) colFecha = fIdx;
        if (bIdx >= 0) colBruto = bIdx;
        if (cIdx >= 0) colCoste = cIdx;
        break;
      }
    }

    const rows: ParsedCostesRow[] = [];
    for (let i = dataStart; i < raw.length; i++) {
      const row = raw[i] as unknown[];
      const trabajador = String(row[colTrabajador] ?? "").trim();
      const bruto = typeof row[colBruto] === "number" ? (row[colBruto] as number) : null;
      const coste = typeof row[colCoste] === "number" ? (row[colCoste] as number) : null;

      // Parse date
      let fecha: string | null = null;
      const rawDate = row[colFecha];
      if (rawDate instanceof Date) {
        fecha = rawDate.toISOString().slice(0, 10);
      } else if (typeof rawDate === "number") {
        const d = new Date(Math.round((rawDate - 25569) * 86400 * 1000));
        if (!isNaN(d.getTime())) fecha = d.toISOString().slice(0, 10);
      } else if (rawDate) {
        const s = String(rawDate).trim();
        const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
        if (m) fecha = `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
      }

      if (!trabajador || !fecha || bruto == null || coste == null) continue;

      rows.push({
        trabajador,
        fecha,
        bruto: Math.round(bruto * 100) / 100,
        coste_empresarial: Math.round(coste * 100) / 100,
      });
    }

    if (!rows.length) {
      return { ok: false, error: "No se encontraron filas con datos válidos (TRABAJADOR, Fecha, BRUTO, COSTE TOT)" };
    }

    return { ok: true, rows };
  } catch (e: any) {
    return { ok: false, error: `Error leyendo el archivo: ${e?.message ?? String(e)}` };
  }
}
