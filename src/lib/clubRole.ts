import { getActiveClubContext } from "@/lib/club";
import { createSupabaseServerClient, getCurrentUser } from "@/lib/supabase/server";

export type ClubRole = "owner" | "admin" | "manager" | "viewer";

export async function getMyClubRole(clubId: number): Promise<ClubRole | null> {
  const activeContext = await getActiveClubContext();
  if (activeContext?.clubId === clubId && activeContext.role) {
    return activeContext.role as ClubRole;
  }

  const supabase = await createSupabaseServerClient();
  const user = await getCurrentUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("club_miembros")
    .select("rol")
    .eq("club_id", clubId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data?.rol) return null;
  return data.rol as ClubRole;
}

export function canAccessConciliation(role: ClubRole | null) {
  return role === "owner" || role === "admin" || role === "manager";
}

export function canManageMembers(role: ClubRole | null) {
  return role === "owner" || role === "admin";
}

export function canEditClubData(role: ClubRole | null) {
  return role === "owner" || role === "admin" || role === "manager";
}

