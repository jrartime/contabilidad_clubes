"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveClubId } from "@/lib/club";
import { canAccessConciliation, getMyClubRole } from "@/lib/clubRole";

export type ConciliarResult =
  | { ok: true }
  | { ok: false; error: string };

export async function conciliarManualAction(
  contabilidadId: number,
  bancoId: number
): Promise<ConciliarResult> {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const clubId = await getActiveClubId();
  if (!clubId) redirect("/clubs");

  const role = await getMyClubRole(clubId);
  if (!canAccessConciliation(role)) redirect("/no-autorizado");

  // Leer los datos reales para armar el pago
  const [{ data: banco, error: eb }, { data: asiento, error: ec }] = await Promise.all([
    supabase
      .from("bancos")
      .select("fecha_operativa, importe")
      .eq("club_id", clubId)
      .eq("id_banco", bancoId)
      .single(),
    supabase
      .from("contabilidad")
      .select("importe_total")
      .eq("club_id", clubId)
      .eq("id_contabilidad", contabilidadId)
      .single(),
  ]);

  if (eb) return { ok: false, error: `Movimiento bancario: ${eb.message}` };
  if (ec) return { ok: false, error: `Asiento contable: ${ec.message}` };

  const { error } = await supabase.from("pagos").upsert(
    [{
      club_id: clubId,
      contabilidad_id: contabilidadId,
      banco_id: bancoId,
      fecha_pago_real: banco!.fecha_operativa,
      importe_pagado: asiento!.importe_total,
      metodo: "transferencia",
      observaciones: "Conciliación manual (panel)",
    }],
    { onConflict: "contabilidad_id,banco_id", ignoreDuplicates: true }
  );

  if (error) return { ok: false, error: error.message };

  revalidatePath("/conciliacion/1a1");
  return { ok: true };
}

export async function desconciliarAction(
  contabilidadId: number,
  bancoId: number
): Promise<ConciliarResult> {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const clubId = await getActiveClubId();
  if (!clubId) redirect("/clubs");

  const role = await getMyClubRole(clubId);
  if (!canAccessConciliation(role)) redirect("/no-autorizado");

  const { error } = await supabase
    .from("pagos")
    .delete()
    .eq("club_id", clubId)
    .eq("contabilidad_id", contabilidadId)
    .eq("banco_id", bancoId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/conciliacion/1a1");
  return { ok: true };
}
