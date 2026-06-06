import { cookies } from "next/headers";
import { cache } from "react";
import { createSupabaseServerClient, getCurrentUser } from "@/lib/supabase/server";

type ActiveClubContext = {
  clubId: number;
  clubName: string | null;
  role: string | null;
};

type MembershipWithClub = {
  rol: string | null;
  clubes: { nombre: string | null } | { nombre: string | null }[] | null;
};

function getClubName(membership: MembershipWithClub | null) {
  const club = Array.isArray(membership?.clubes)
    ? membership?.clubes[0] ?? null
    : membership?.clubes ?? null;
  return club?.nombre ?? null;
}

export const getActiveClubContext = cache(async (): Promise<ActiveClubContext | null> => {
  const cookieStore = await cookies();
  const value = cookieStore.get("club_id")?.value;

  if (!value) return null;

  const clubId = Number(value);
  if (!Number.isFinite(clubId) || clubId <= 0) return null;

  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("club_miembros")
    .select("rol, clubes(nombre)")
    .eq("club_id", clubId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) return null;

  const membership = data as MembershipWithClub;
  return {
    clubId,
    clubName: getClubName(membership),
    role: membership.rol ?? null,
  };
});

export async function getActiveClubId(): Promise<number | null> {
  const context = await getActiveClubContext();
  return context?.clubId ?? null;
}
