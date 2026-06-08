"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getActiveClubId } from "@/lib/club";
import { canEditClubData, getMyClubRole } from "@/lib/clubRole";

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
