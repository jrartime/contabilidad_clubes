import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getActiveClubId } from "@/lib/club";
import { getMyClubRole, canManageMembers, type ClubRole } from "@/lib/clubRole";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import type { ClubMemberWithProfile } from "@/lib/appTypes";

const CLUB_ROLES: ClubRole[] = ["owner", "admin", "manager", "viewer"];

function parseRole(value: FormDataEntryValue | null): ClubRole | null {
  const role = String(value ?? "").trim();
  return CLUB_ROLES.includes(role as ClubRole) ? (role as ClubRole) : null;
}

function getProfileEmail(member: ClubMemberWithProfile): string | null {
  if (Array.isArray(member.perfiles)) return member.perfiles[0]?.email ?? null;
  return member.perfiles?.email ?? null;
}

async function addMember(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "").trim();
  const rol = parseRole(formData.get("rol")) ?? "viewer";
  const clubId = Number(formData.get("club_id"));

  if (!clubId || !Number.isFinite(clubId)) {
    redirect("/clubs/members?error=club_id%20invalido");
  }
  if (!email) redirect("/clubs/members?error=Email%20obligatorio");

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const myRole = await getMyClubRole(clubId);
  if (!canManageMembers(myRole)) redirect("/no-autorizado");

  const { error } = await supabase.rpc("anadir_miembro_por_email", {
    p_club_id: clubId,
    p_email: email,
    p_rol: rol,
  });

  if (error) redirect("/clubs/members?error=" + encodeURIComponent(error.message));

  redirect("/clubs/members");
}

async function updateRole(formData: FormData) {
  "use server";

  const clubId = Number(formData.get("club_id"));
  const userId = String(formData.get("user_id") ?? "");
  const newRol = parseRole(formData.get("rol"));

  if (!clubId || !Number.isFinite(clubId)) {
    redirect("/clubs/members?error=club_id%20invalido");
  }
  if (!userId) redirect("/clubs/members?error=user_id%20invalido");
  if (!newRol) redirect("/clubs/members?error=rol%20invalido");

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const myRole = await getMyClubRole(clubId);
  if (!canManageMembers(myRole)) redirect("/no-autorizado");

  const { error } = await supabase.rpc("cambiar_rol_miembro", {
    p_club_id: clubId,
    p_user_id: userId,
    p_new_rol: newRol,
  });

  if (error) redirect("/clubs/members?error=" + encodeURIComponent(error.message));

  redirect("/clubs/members");
}

async function removeMember(formData: FormData) {
  "use server";

  const clubId = Number(formData.get("club_id"));
  const userId = String(formData.get("user_id") ?? "");

  if (!clubId || !Number.isFinite(clubId)) {
    redirect("/clubs/members?error=club_id%20invalido");
  }
  if (!userId) redirect("/clubs/members?error=user_id%20invalido");

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const myRole = await getMyClubRole(clubId);
  if (!canManageMembers(myRole)) redirect("/no-autorizado");

  const { error } = await supabase.rpc("eliminar_miembro", {
    p_club_id: clubId,
    p_user_id: userId,
  });

  if (error) redirect("/clubs/members?error=" + encodeURIComponent(error.message));

  redirect("/clubs/members");
}

export default async function ClubMembersPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) redirect("/login");

  const clubId = await getActiveClubId();
  if (!clubId) redirect("/clubs");

  const myRole = await getMyClubRole(clubId);
  if (!canManageMembers(myRole)) redirect("/no-autorizado");

  const errorMsg = sp.error ? decodeURIComponent(sp.error) : null;

  const { data, error } = await supabase
    .from("club_miembros")
    .select("user_id, rol, perfiles:user_id (email)")
    .eq("club_id", clubId)
    .order("rol", { ascending: true });

  const members = (data ?? []) as ClubMemberWithProfile[];

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 16 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>
        Miembros del club (club_id: {clubId})
      </h1>

      <p style={{ marginTop: 0, opacity: 0.75 }}>
        Tu rol en este club: <b>{myRole}</b>
      </p>

      {errorMsg && (
        <div
          style={{
            border: "1px solid #f5c2c2",
            background: "#fff5f5",
            padding: 10,
            borderRadius: 8,
          }}
        >
          <b>Error:</b> {errorMsg}
        </div>
      )}

      {error && <p>Error: {error.message}</p>}

      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 8,
          padding: 12,
          marginTop: 12,
          marginBottom: 14,
        }}
      >
        <h2 style={{ margin: 0, marginBottom: 10, fontSize: 16 }}>
          Anadir / actualizar miembro
        </h2>

        <form action={addMember} style={{ display: "grid", gap: 10 }}>
          <input type="hidden" name="club_id" value={clubId} />

          <label>
            Email del usuario
            <input name="email" type="email" required style={{ width: "100%", padding: 8 }} />
          </label>

          <label>
            Rol
            <select name="rol" defaultValue="viewer" style={{ width: "100%", padding: 8 }}>
              {CLUB_ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>

          <button type="submit" style={{ padding: "10px 12px", cursor: "pointer" }}>
            Anadir / actualizar rol
          </button>
        </form>
      </div>

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>Listado</h2>

      <div style={{ display: "grid", gap: 10 }}>
        {members.map((member) => (
          <div
            key={member.user_id}
            style={{ border: "1px solid #eee", borderRadius: 8, padding: 10 }}
          >
            <div style={{ fontWeight: 700 }}>{getProfileEmail(member) ?? member.user_id}</div>
            <div style={{ opacity: 0.8, marginTop: 2 }}>
              rol actual: <b>{member.rol}</b>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
              <form
                action={updateRole}
                style={{ display: "flex", gap: 8, alignItems: "center" }}
              >
                <input type="hidden" name="club_id" value={clubId} />
                <input type="hidden" name="user_id" value={member.user_id} />
                <select name="rol" defaultValue={member.rol} style={{ padding: 6 }}>
                  {CLUB_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
                <button type="submit" style={{ padding: "6px 10px", cursor: "pointer" }}>
                  Guardar rol
                </button>
              </form>

              <form action={removeMember}>
                <input type="hidden" name="club_id" value={clubId} />
                <input type="hidden" name="user_id" value={member.user_id} />
                <ConfirmSubmitButton message="Eliminar miembro?">Eliminar</ConfirmSubmitButton>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
