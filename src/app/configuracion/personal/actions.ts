"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveClubId } from "@/lib/club";
import { canEditClubData, getMyClubRole } from "@/lib/clubRole";

function toNullableText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

export async function createPersonalAction(payload?: {
  nombre?: string | null;
  nif?: string | null;
  tipo?: string | null;
  observaciones?: string | null;
  activo?: boolean;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const clubId = await getActiveClubId();
  if (!clubId) redirect("/clubs");

  const myRole = await getMyClubRole(clubId);
  if (!canEditClubData(myRole)) redirect("/no-autorizado");

  const nombre = toNullableText(payload?.nombre) ?? "";
  if (!nombre) throw new Error("Nombre obligatorio.");

  const { data, error } = await supabase
    .from("personal")
    .insert({
      club_id: clubId,
      nombre,
      nif: toNullableText(payload?.nif),
      tipo: toNullableText(payload?.tipo),
      observaciones: toNullableText(payload?.observaciones),
      activo: payload?.activo ?? true,
    })
    .select("id_personal, nombre, nif, tipo, observaciones, activo")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function deletePersonalAction(id_personal: number) {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const clubId = await getActiveClubId();
  if (!clubId) redirect("/clubs");

  const myRole = await getMyClubRole(clubId);
  if (!canEditClubData(myRole)) redirect("/no-autorizado");

  const { error } = await supabase
    .from("personal")
    .delete()
    .eq("id_personal", id_personal)
    .eq("club_id", clubId);

  if (error) throw new Error(error.message);
}

export async function updatePersonalAction(payload: {
  id_personal: number;
  nombre?: string | null;
  nif?: string | null;
  tipo?: string | null;
  observaciones?: string | null;
  activo?: boolean | null;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const clubId = await getActiveClubId();
  if (!clubId) redirect("/clubs");

  const myRole = await getMyClubRole(clubId);
  if (!canEditClubData(myRole)) redirect("/no-autorizado");

  const update: {
    nombre?: string | null;
    nif?: string | null;
    tipo?: string | null;
    observaciones?: string | null;
    activo?: boolean;
  } = {};

  if ("nombre" in payload) update.nombre = toNullableText(payload.nombre);
  if ("nif" in payload) update.nif = toNullableText(payload.nif);
  if ("tipo" in payload) update.tipo = toNullableText(payload.tipo);
  if ("observaciones" in payload) {
    update.observaciones = toNullableText(payload.observaciones);
  }
  if ("activo" in payload) update.activo = payload.activo ?? false;

  if ("nombre" in payload && !update.nombre) {
    throw new Error("Nombre obligatorio.");
  }

  const { error } = await supabase
    .from("personal")
    .update(update)
    .eq("id_personal", payload.id_personal)
    .eq("club_id", clubId);

  if (error) throw new Error(error.message);
}
