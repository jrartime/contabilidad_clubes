import Link from "next/link";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getActiveClubId } from "@/lib/club";
import { getMyClubRole, canManageMembers, type ClubRole } from "@/lib/clubRole";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { Icon } from "@/components/Icon";
import type { ClubMemberWithProfile } from "@/lib/appTypes";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

  if (!clubId || !Number.isFinite(clubId)) redirect("/configuracion/miembros?error=club_id%20invalido");
  if (!email) redirect("/configuracion/miembros?error=Email%20obligatorio");

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

  if (error) redirect("/configuracion/miembros?error=" + encodeURIComponent(error.message));
  redirect("/configuracion/miembros");
}

async function inviteAndAddMember(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "").trim();
  const rol = parseRole(formData.get("rol")) ?? "viewer";
  const clubId = Number(formData.get("club_id"));

  if (!clubId || !Number.isFinite(clubId)) redirect("/configuracion/miembros?error=club_id%20invalido");
  if (!email) redirect("/configuracion/miembros?error=Email%20obligatorio");

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const myRole = await getMyClubRole(clubId);
  if (!canManageMembers(myRole)) redirect("/no-autorizado");

  // Invitar al usuario vía Admin API (crea cuenta + envía email con enlace)
  const admin = createSupabaseAdminClient();
  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email);

  if (inviteError && !inviteError.message.includes("already registered")) {
    redirect("/configuracion/miembros?error=" + encodeURIComponent(inviteError.message));
  }

  // Añadir al club (el usuario ya existe en auth.users tras la invitación)
  const { error } = await supabase.rpc("anadir_miembro_por_email", {
    p_club_id: clubId,
    p_email: email,
    p_rol: rol,
  });

  if (error) redirect("/configuracion/miembros?error=" + encodeURIComponent(error.message));
  redirect("/configuracion/miembros?ok=invited");
}

async function updateRole(formData: FormData) {
  "use server";

  const clubId = Number(formData.get("club_id"));
  const userId = String(formData.get("user_id") ?? "");
  const newRol = parseRole(formData.get("rol"));

  if (!clubId || !Number.isFinite(clubId)) redirect("/configuracion/miembros?error=club_id%20invalido");
  if (!userId) redirect("/configuracion/miembros?error=user_id%20invalido");
  if (!newRol) redirect("/configuracion/miembros?error=rol%20invalido");

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

  if (error) redirect("/configuracion/miembros?error=" + encodeURIComponent(error.message));
  redirect("/configuracion/miembros");
}

async function removeMember(formData: FormData) {
  "use server";

  const clubId = Number(formData.get("club_id"));
  const userId = String(formData.get("user_id") ?? "");

  if (!clubId || !Number.isFinite(clubId)) redirect("/configuracion/miembros?error=club_id%20invalido");
  if (!userId) redirect("/configuracion/miembros?error=user_id%20invalido");

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const myRole = await getMyClubRole(clubId);
  if (!canManageMembers(myRole)) redirect("/no-autorizado");

  const { error } = await supabase.rpc("eliminar_miembro", {
    p_club_id: clubId,
    p_user_id: userId,
  });

  if (error) redirect("/configuracion/miembros?error=" + encodeURIComponent(error.message));
  redirect("/configuracion/miembros");
}

export default async function MiembrosPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; panel?: string; edit?: string; ok?: string }>;
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
  const okMsg = sp.ok === "invited" ? "Invitación enviada y miembro añadido al club." : null;
  const showPanel = sp.panel === "add" || !!sp.edit;
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Miembros del club</h1>
          <p style={{ margin: "4px 0 0", opacity: 0.75, fontSize: 13 }}>
            Tu rol: <b>{myRole}</b>
          </p>
        </div>
        <Link
          href="/configuracion/miembros?panel=add"
          className="icon-button"
          aria-label="Añadir miembro"
          title="Añadir miembro"
        >
          <Icon name="new" />
        </Link>
      </div>

      {errorMsg && (
        <div style={{ border: "1px solid #f5c2c2", background: "#fff5f5", padding: 10, borderRadius: 8, marginBottom: 12 }}>
          <b>Error:</b> {errorMsg}
        </div>
      )}
      {okMsg && (
        <div style={{ border: "1px solid #b7e4c7", background: "#f0fff4", padding: 10, borderRadius: 8, marginBottom: 12 }}>
          ✓ {okMsg}
        </div>
      )}
      {error && <p>Error: {error.message}</p>}

      <div style={{ display: "grid", gridTemplateColumns: showPanel ? "1fr 300px" : "1fr", gap: 20, alignItems: "start" }}>

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
                  <div style={{ opacity: 0.7, fontSize: 13 }}>
                    rol: <b>{member.rol}</b>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <Link
                    href={isEditing ? "/configuracion/miembros" : `/configuracion/miembros?edit=${member.user_id}`}
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
        {showPanel && (
          <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, position: "sticky", top: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                {editMember ? "Editar miembro" : "Añadir miembro"}
              </h2>
              <Link href="/configuracion/miembros" className="icon-button icon-button-secondary tooltip-button" aria-label="Cerrar panel">
                <Icon name="logout" />
              </Link>
            </div>

            {editMember ? (
              <>
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
                  <button type="submit" className="icon-button tooltip-button" aria-label="Guardar cambios">
                    <Icon name="save" />
                  </button>
                </form>
              </>
            ) : (
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
                <button type="submit" style={{ padding: "10px 12px", cursor: "pointer" }}>
                  Añadir miembro
                </button>
                <div style={{ borderTop: "1px solid #eee", paddingTop: 10 }}>
                  <p style={{ margin: "0 0 8px", fontSize: 12, opacity: 0.7 }}>
                    ¿El usuario aún no tiene cuenta?
                  </p>
                  <button
                    type="submit"
                    formAction={inviteAndAddMember}
                    style={{ padding: "10px 12px", cursor: "pointer", width: "100%" }}
                  >
                    Invitar por email y añadir
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
