"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveClubId } from "@/lib/club";
import { canEditClubData, getMyClubRole } from "@/lib/clubRole";
import { parseDecimalToNumber } from "@/lib/decimal";

function toNullableNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const raw = String(value).trim();
  if (!raw) return null;
  return parseDecimalToNumber(raw);
}

function toNullableInt(value: string | number | null | undefined) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? Math.trunc(value) : null;
  const raw = String(value).trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export async function updateBancoAction(payload: {
  id_banco: number;
  fecha_operativa?: string | null;
  fecha_valor?: string | null;
  detalle?: string | null;
  referencia?: string | null;
  referencia_1?: string | null;
  referencia_2?: string | null;
  categoria?: string | null;
  programa_id?: number | null;
  concepto_id?: number | null;
  orden?: number | null;
  debe?: string | number | null;
  haber?: string | number | null;
  saldo?: string | number | null;
  importe?: string | number | null;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const clubId = await getActiveClubId();
  if (!clubId) redirect("/clubs");

  const myRole = await getMyClubRole(clubId);
  if (!canEditClubData(myRole)) redirect("/no-autorizado");

  const update: any = {};

  if ("fecha_operativa" in payload) update.fecha_operativa = payload.fecha_operativa || null;
  if ("fecha_valor" in payload) update.fecha_valor = payload.fecha_valor || null;
  if ("detalle" in payload) update.detalle = (payload.detalle ?? "").trim() || null;
  if ("referencia" in payload) update.referencia = (payload.referencia ?? "").trim() || null;
  if ("referencia_1" in payload) update.referencia_1 = (payload.referencia_1 ?? "").trim() || null;
  if ("referencia_2" in payload) update.referencia_2 = (payload.referencia_2 ?? "").trim() || null;
  if ("categoria" in payload) update.categoria = (payload.categoria ?? "").trim() || null;
  if ("programa_id" in payload) update.programa_id = payload.programa_id ?? null;
  if ("concepto_id" in payload) update.concepto_id = payload.concepto_id ?? null;
  if ("orden" in payload) update.orden = toNullableInt(payload.orden ?? null);

  if ("debe" in payload) update.debe = toNullableNumber(payload.debe ?? null);
  if ("haber" in payload) update.haber = toNullableNumber(payload.haber ?? null);
  if ("saldo" in payload) update.saldo = toNullableNumber(payload.saldo ?? null);
  if ("importe" in payload) update.importe = toNullableNumber(payload.importe ?? null);

  const { error } = await supabase
    .from("bancos")
    .update(update)
    .eq("club_id", clubId)
    .eq("id_banco", payload.id_banco);

  if (error) throw new Error(error.message);
}

export async function asignarProgramaMasivoAction(
  ids: number[],
  programaId: number | null
): Promise<{ updated: number; error?: string }> {
  if (!ids.length) return { updated: 0 };

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { updated: 0, error: "No autenticado" };

  const clubId = await getActiveClubId();
  if (!clubId) return { updated: 0, error: "Club no seleccionado" };

  const myRole = await getMyClubRole(clubId);
  if (!canEditClubData(myRole)) return { updated: 0, error: "Sin permisos" };

  const { error, count } = await supabase
    .from("bancos")
    .update({ programa_id: programaId })
    .eq("club_id", clubId)
    .in("id_banco", ids);

  if (error) return { updated: 0, error: error.message };
  return { updated: count ?? ids.length };
}

export async function deleteBancoAction(formData: FormData) {
  const clubId = Number(formData.get("club_id"));
  const id = Number(formData.get("id_banco"));
  const redirectTo = String(formData.get("redirect_to") ?? "/bancos");

  if (!clubId || !Number.isFinite(clubId)) {
    redirect("/bancos?error=club_id_invalido");
  }
  if (!id || !Number.isFinite(id)) {
    redirect("/bancos?error=id_banco_invalido");
  }

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const myRole = await getMyClubRole(clubId);
  if (!canEditClubData(myRole)) redirect("/no-autorizado");

  const { error } = await supabase
    .from("bancos")
    .delete()
    .eq("club_id", clubId)
    .eq("id_banco", id);

  if (error) {
    redirect(`/bancos?error=${encodeURIComponent(error.message)}`);
  }

  redirect(redirectTo);
}
