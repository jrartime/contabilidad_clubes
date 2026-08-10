"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveClubId } from "@/lib/club";
import { canManageMembers, getMyClubRole } from "@/lib/clubRole";
import { CARGOS } from "./constants";

function toNullableText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function toNullableDate(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

async function requireEditContext() {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const clubId = await getActiveClubId();
  if (!clubId) redirect("/clubs");

  const myRole = await getMyClubRole(clubId);
  if (!canManageMembers(myRole)) redirect("/no-autorizado");

  return { supabase, clubId };
}

export async function createCargoAction(payload: {
  persona_nombre?: string | null;
  persona_dni?: string | null;
  cargo?: string | null;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  observaciones?: string | null;
  activo?: boolean;
}) {
  const { supabase, clubId } = await requireEditContext();

  const persona_nombre = toNullableText(payload?.persona_nombre) ?? "";
  if (!persona_nombre) throw new Error("Nombre obligatorio.");

  const cargo = toNullableText(payload?.cargo) ?? "";
  if (!CARGOS.some((c) => c.value === cargo)) throw new Error("Cargo inválido.");

  const fecha_inicio = toNullableDate(payload?.fecha_inicio);
  if (!fecha_inicio) throw new Error("Fecha de inicio obligatoria.");

  const { data, error } = await supabase
    .from("junta_directiva")
    .insert({
      club_id: clubId,
      persona_nombre,
      persona_dni: toNullableText(payload?.persona_dni),
      cargo,
      fecha_inicio,
      fecha_fin: toNullableDate(payload?.fecha_fin),
      observaciones: toNullableText(payload?.observaciones),
      activo: payload?.activo ?? true,
    })
    .select(
      "id_cargo, persona_nombre, persona_dni, cargo, fecha_inicio, fecha_fin, observaciones, activo"
    )
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("Ya existe un cargo de este tipo activo para el club.");
    }
    throw new Error(error.message);
  }
  return data;
}

export async function updateCargoAction(payload: {
  id_cargo: number;
  persona_nombre?: string | null;
  persona_dni?: string | null;
  cargo?: string | null;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  observaciones?: string | null;
  activo?: boolean | null;
}) {
  const { supabase, clubId } = await requireEditContext();

  const update: {
    persona_nombre?: string;
    persona_dni?: string | null;
    cargo?: string;
    fecha_inicio?: string;
    fecha_fin?: string | null;
    observaciones?: string | null;
    activo?: boolean;
  } = {};

  if ("persona_nombre" in payload) {
    const nombre = toNullableText(payload.persona_nombre);
    if (!nombre) throw new Error("Nombre obligatorio.");
    update.persona_nombre = nombre;
  }
  if ("persona_dni" in payload) update.persona_dni = toNullableText(payload.persona_dni);
  if ("cargo" in payload) {
    const cargo = toNullableText(payload.cargo) ?? "";
    if (!CARGOS.some((c) => c.value === cargo)) throw new Error("Cargo inválido.");
    update.cargo = cargo;
  }
  if ("fecha_inicio" in payload) {
    const fecha = toNullableDate(payload.fecha_inicio);
    if (!fecha) throw new Error("Fecha de inicio obligatoria.");
    update.fecha_inicio = fecha;
  }
  if ("fecha_fin" in payload) update.fecha_fin = toNullableDate(payload.fecha_fin);
  if ("observaciones" in payload) update.observaciones = toNullableText(payload.observaciones);
  if ("activo" in payload) update.activo = payload.activo ?? false;

  const { error } = await supabase
    .from("junta_directiva")
    .update(update)
    .eq("id_cargo", payload.id_cargo)
    .eq("club_id", clubId);

  if (error) {
    if (error.code === "23505") {
      throw new Error("Ya existe un cargo de este tipo activo para el club.");
    }
    throw new Error(error.message);
  }
}

export async function deleteCargoAction(id_cargo: number) {
  const { supabase, clubId } = await requireEditContext();

  const { error } = await supabase
    .from("junta_directiva")
    .delete()
    .eq("id_cargo", id_cargo)
    .eq("club_id", clubId);

  if (error) throw new Error(error.message);
}
