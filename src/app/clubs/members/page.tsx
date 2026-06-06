import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getActiveClubId } from "@/lib/club";
import { getMyClubRole, canManageMembers, type ClubRole } from "@/lib/clubRole";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { Icon } from "@/components/Icon";
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
  searchParams?: Promise<{ error?: string; edit?: string }>;
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
  const editUserId = sp.edit ?? null;

  const { data, error } = await supabase
    .from("club_miembros")
    .select("user_id, rol, perfiles:user_id (email)")
    .eq("club_id", clubId)
    .order("rol", { ascending: true });

  const members = (data ?? []) as ClubMemberWithProfile[];
  const editMember = editUserId ? members.find((m) => m.user_id === editUserId) ?? null : null;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>
        Miembros del club
      </h1>
      <p style={{ marginTop: 0, marginBottom: 16, opacity: 0.75 }}>
        Tu rol: <b>{myRole}</b>
      </p>

      {errorMsg && (
        <div
          style={{
            border: "1px solid #f5c2c2",
            background: "#fff5f5",
            padding: 10,
            borderRadius: 8,
            marginBottom: 12,
          }}
        >
          <b>Error:</b> {errorMsg}
        </div>
      )}

      {error && <p>Error: {error.message}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20, alignItems: "start" }}>

        {/* Listado */}
        <div style={{ display: "grid", gap: 8 }}>
          {members.length === 0 && (
            <p style={{ opacity: 0.7 }}>No hay miembros en este club.</p>
          )}
          {members.map((member) => {
            const email = getProfileEmail(member) ?? member.user_id;
            const isEditing = editUserId === member.user_id;
            return (
              <div
                key={member.user_id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 12px",
                  border: isEditing ? "1px solid var(--primary)" : "1px solid #eee",
                  borderRadius: 8,
                  background: isEditing ? "var(--primary-bg, #f0f4ff)" : undefined,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {email}
                  </div>
                  <div style={{ opacity: 0.75, fontSize: 13 }}>
                    rol: <b>{member.rol}</b>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <Link
                    href={isEditing ? "/clubs/members" : `/clubs/members?edit=${member.user_id}`}
                    className="icon-button"
                    aria-label="Editar miembro"
                    title="Editar miembro"
                  >
                    <Icon name="edit" />
                  </Link>
                  <form action={removeMember}>
                    <input type="hidden" name="club_id" value={clubId} />
                    <input type="hidden" name="user_id" value={member.user_id} />
                    <ConfirmSubmitButton
                      className="icon-button"
                      ariaLabel="Eliminar miembro"
                      message="¿Eliminar este miembro del club?"
                    >
                      <Icon name="delete" />
                    </ConfirmSubmitButton>
                  </form>
                </div>
              </div>
            );
          })}
        </div>

        {/* Panel lateral */}
        <div
          style={{
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: 16,
            position: "sticky",
            top: 16,
          }}
        >
          {editMember ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Editar miembro</h2>
                <Link href="/clubs/members" style={{ fontSize: 13, opacity: 0.6 }}>
                  Cancelar
                </Link>
              </div>
              <p style={{ margin: "0 0 12px", fontSize: 13, opacity: 0.8, wordBreak: "break-all" }}>
                {getProfileEmail(editMember) ?? editMember.user_id}
              </p>
              <form action={updateRole} style={{ display: "grid", gap: 10 }}>
                <input type="hidden" name="club_id" value={clubId} />
                <input type="hidden" name="user_id" value={editMember.user_id} />
                <label style={{ display: "grid", gap: 4, fontSize: 14 }}>
                  Rol
                  <select name="rol" defaultValue={editMember.rol} style={{ padding: 8 }}>
                    {CLUB_ROLES.map((role) => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </label>
                <button type="submit" className="btn-primary" style={{ padding: "10px 12px", cursor: "pointer" }}>
                  Guardar cambios
                </button>
              </form>
            </>
          ) : (
            <>
              <h2 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700 }}>Añadir miembro</h2>
              <form action={addMember} style={{ display: "grid", gap: 10 }}>
                <input type="hidden" name="club_id" value={clubId} />
                <label style={{ display: "grid", gap: 4, fontSize: 14 }}>
                  Email del usuario
                  <input name="email" type="email" required style={{ padding: 8 }} />
                </label>
                <label style={{ display: "grid", gap: 4, fontSize: 14 }}>
                  Rol
                  <select name="rol" defaultValue="viewer" style={{ padding: 8 }}>
                    {CLUB_ROLES.map((role) => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </label>
                <button type="submit" className="btn-primary" style={{ padding: "10px 12px", cursor: "pointer" }}>
                  Añadir miembro
                </button>
              </form>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
