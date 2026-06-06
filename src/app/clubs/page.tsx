import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getActiveClubId } from "@/lib/club";
import type { ClubMembershipWithClub } from "@/lib/appTypes";
import { Icon } from "@/components/Icon";

function getClub(membership: ClubMembershipWithClub) {
  if (Array.isArray(membership.clubes)) return membership.clubes[0] ?? null;
  return membership.clubes;
}

export default async function ClubsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) redirect("/login");

  const activeClubId = await getActiveClubId();

  const { data, error } = await supabase
    .from("club_miembros")
    .select("club_id, rol, clubes(id_club, nombre, nif, email)")
    .eq("user_id", user.id)
    .order("club_id", { ascending: true });

  const memberships = (data ?? []) as ClubMembershipWithClub[];

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>
        Seleccionar club
      </h1>

      {error && <p>Error: {error.message}</p>}

      <div style={{ display: "grid", gap: 12 }}>
        {memberships.map((membership) => {
          const isActive = activeClubId === membership.club_id;
          const club = getClub(membership);
          return (
            <div
              key={membership.club_id}
              style={{
                border: "1px solid #ddd",
                padding: 12,
                borderRadius: 8,
              }}
            >
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800 }}>
                    {club?.nombre ?? `Club ${membership.club_id}`}{" "}
                    {isActive && (
                      <span style={{ fontWeight: 600, opacity: 0.7 }}>
                        (activo)
                      </span>
                    )}
                  </div>
                  <div style={{ opacity: 0.8 }}>
                    id_club: {membership.club_id} · rol: {membership.rol}
                  </div>
                  <div style={{ opacity: 0.8 }}>
                    nif: {club?.nif ?? "-"} · email: {club?.email ?? "-"}
                  </div>
                </div>

                {!isActive && (
                  <form action="/api/club/seleccionar" method="post">
                    <input type="hidden" name="club_id" value={membership.club_id} />
                    <button
                      type="submit"
                      className="icon-button"
                      aria-label="Activar este club"
                      title="Activar este club"
                    >
                      <Icon name="enter" />
                    </button>
                  </form>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Link href="/clubs/new" style={{ display: "inline-block", marginTop: 12 }}>
        + Nuevo club
      </Link>

      <p style={{ marginTop: 14, opacity: 0.8 }}>
        Nota: el club activo se guarda en una cookie para que funcione tambien en
        paginas server (SSR).
      </p>
    </div>
  );
}
