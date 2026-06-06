"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getActiveClubId } from "@/lib/club";
import { canEditClubData, getMyClubRole } from "@/lib/clubRole";
import { parseDecimalToNumber } from "@/lib/decimal";

function toNum(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  if (!s) return null;
  return parseDecimalToNumber(s);
}

export async function updateNominaAction(payload: {
  id_contabilidad: number;
  fecha?: string | null;
  fecha_pago?: string | null;
  personal_id?: number | null;
  proveedor_id?: number | null;
  programa_id?: number | null;
  concepto_id?: number | null;
  categoria_id?: number | null;
  bruto?: string | number | null;
  ss?: string | number | null;
  importe_total?: string | number | null;
  importe_imputado?: string | number | null;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const clubId = await getActiveClubId();
  if (!clubId) redirect("/clubs");

  const myRole = await getMyClubRole(clubId);
  if (!canEditClubData(myRole)) redirect("/no-autorizado");

  const update: Record<string, unknown> = {};
  if ("fecha" in payload)          update.fecha           = payload.fecha || null;
  if ("fecha_pago" in payload)     update.fecha_pago      = payload.fecha_pago || null;
  if ("personal_id" in payload)    update.personal_id     = payload.personal_id ?? null;
  if ("proveedor_id" in payload)   update.proveedor_id    = payload.proveedor_id ?? null;
  if ("programa_id" in payload)    update.programa_id     = payload.programa_id ?? null;
  if ("concepto_id" in payload)    update.concepto_id     = payload.concepto_id ?? null;
  if ("categoria_id" in payload)   update.categoria_id    = payload.categoria_id ?? null;
  if ("bruto" in payload)          update.bruto           = toNum(payload.bruto ?? null);
  if ("ss" in payload)             update.ss              = toNum(payload.ss ?? null);
  if ("importe_total" in payload)  update.importe_total   = toNum(payload.importe_total ?? null);
  if ("importe_imputado" in payload) update.importe_imputado = toNum(payload.importe_imputado ?? null);

  const { error } = await supabase
    .from("contabilidad")
    .update(update)
    .eq("club_id", clubId)
    .eq("id_contabilidad", payload.id_contabilidad);

  if (error) throw new Error(error.message);
}
