 "use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveClubId } from "@/lib/club";
import { canEditClubData, getMyClubRole } from "@/lib/clubRole";
import { parseDecimalToNumber } from "@/lib/decimal";

export async function updateProgramaAction(payload: {
  id_programa: number;
  anio?: number | null;
  programa?: string | null;
  subvencion?: string | number | null;
  fecha_limite?: string | null;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const clubId = await getActiveClubId();
  if (!clubId) redirect("/clubs");

  const myRole = await getMyClubRole(clubId);
  if (!canEditClubData(myRole)) redirect("/no-autorizado");

  const update: {
    anio?: number | null;
    programa?: string | null;
    subvencion?: number | null;
    fecha_limite?: string | null;
  } = {};
  if ("anio" in payload) update.anio = payload.anio ?? null;
  if ("programa" in payload) update.programa = (payload.programa ?? "").trim() || null;
  if ("fecha_limite" in payload) update.fecha_limite = payload.fecha_limite || null;

  if ("subvencion" in payload) {
    const n =
      typeof payload.subvencion === "number"
        ? payload.subvencion
        : parseDecimalToNumber(payload.subvencion);
    update.subvencion = n ?? null;
  }

  const { error } = await supabase
    .from("programas")
    .update(update)
    .eq("id_programa", payload.id_programa);

  if (error) throw new Error(error.message);
}

export async function createProgramaAction(payload?: {
  programa?: string | null;
  anio?: number | null;
  subvencion?: string | number | null;
  fecha_limite?: string | null;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const clubId = await getActiveClubId();
  if (!clubId) redirect("/clubs");

  const myRole = await getMyClubRole(clubId);
  if (!canEditClubData(myRole)) redirect("/no-autorizado");

  const nowYear = new Date().getFullYear();
  const programa =
    payload && "programa" in payload
      ? (payload.programa ?? "").trim() || "Nuevo programa"
      : "Nuevo programa";
  const anio =
    payload && "anio" in payload ? payload.anio ?? nowYear : nowYear;
  let subvencion: number | null = null;
  if (payload && "subvencion" in payload) {
    const n =
      typeof payload.subvencion === "number"
        ? payload.subvencion
        : parseDecimalToNumber(payload.subvencion);
    subvencion = n ?? null;
  }
  const fecha_limite =
    payload && "fecha_limite" in payload ? payload.fecha_limite ?? null : null;

  const { data, error } = await supabase
    .from("programas")
    .insert({
      club_id: clubId,
      programa,
      anio,
      subvencion,
      fecha_limite,
    })
    .select("id_programa, programa, anio, subvencion, fecha_limite")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function deleteProgramaAction(id_programa: number) {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const clubId = await getActiveClubId();
  if (!clubId) redirect("/clubs");

  const myRole = await getMyClubRole(clubId);
  if (!canEditClubData(myRole)) redirect("/no-autorizado");

  const { error } = await supabase.from("programas").delete().eq("id_programa", id_programa);
  if (error) throw new Error(error.message);
}
