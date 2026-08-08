import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveClubId } from "@/lib/club";
import { canManageMembers, getMyClubRole } from "@/lib/clubRole";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function toText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

async function updateClubAction(formData: FormData) {
  "use server";

  const clubId = Number(formData.get("club_id"));
  if (!clubId || !Number.isFinite(clubId)) {
    redirect("/configuracion/club?error=club_id%20inv%C3%A1lido");
  }

  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!nombre) redirect("/configuracion/club?error=El%20nombre%20es%20obligatorio");

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const myRole = await getMyClubRole(clubId);
  if (!canManageMembers(myRole)) redirect("/no-autorizado");

  const payload = {
    nombre,
    nif: toText(formData.get("nif")),
    direccion: toText(formData.get("direccion")),
    email: toText(formData.get("email")),
    telefono: toText(formData.get("telefono")),
    iban: toText(formData.get("iban")),
    presidente_nombre: toText(formData.get("presidente_nombre")),
    presidente_dni: toText(formData.get("presidente_dni")),
    representante_nombre: toText(formData.get("representante_nombre")),
    representante_dni: toText(formData.get("representante_dni")),
  };

  const { error } = await supabase
    .from("clubes")
    .update(payload)
    .eq("id_club", clubId);

  if (error) {
    redirect(`/configuracion/club?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/configuracion/club?ok=1");
}

export default async function ClubDataPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; ok?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const errorMsg = sp.error ? decodeURIComponent(sp.error) : null;
  const showOk = sp.ok === "1";

  const clubId = await getActiveClubId();
  if (!clubId) redirect("/clubs");

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const myRole = await getMyClubRole(clubId);
  const canUserEdit = canManageMembers(myRole);
  if (!canUserEdit) redirect("/no-autorizado");

  const { data: club, error } = await supabase
    .from("clubes")
    .select(
      "id_club, nombre, nif, direccion, email, telefono, iban, presidente_nombre, presidente_dni, representante_nombre, representante_dni"
    )
    .eq("id_club", clubId)
    .maybeSingle();

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 16 }}>
      <div className="page-toolbar">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>Datos del club</h1>
        </div>
      </div>

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

      {showOk && (
        <div
          style={{
            border: "1px solid #a7d9b0",
            background: "#f0faf2",
            color: "#1a6b2e",
            padding: 10,
            borderRadius: 8,
            marginBottom: 12,
          }}
        >
          Datos del club actualizados correctamente.
        </div>
      )}

      {error && <p>Error: {error.message}</p>}

      <form
        action={updateClubAction}
        style={{
          display: "grid",
          gap: 12,
          border: "1px solid #ddd",
          borderRadius: 10,
          padding: 16,
        }}
      >
        <input type="hidden" name="club_id" value={clubId} />

        <label>
          Nombre *
          <input name="nombre" required defaultValue={club?.nombre ?? ""} style={{ width: "100%" }} />
        </label>

        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
          <label>
            NIF
            <input name="nif" defaultValue={club?.nif ?? ""} style={{ width: "100%" }} />
          </label>
          <label>
            Teléfono
            <input name="telefono" defaultValue={club?.telefono ?? ""} style={{ width: "100%" }} />
          </label>
        </div>

        <label>
          Dirección
          <input name="direccion" defaultValue={club?.direccion ?? ""} style={{ width: "100%" }} />
        </label>

        <label>
          Email
          <input name="email" type="email" defaultValue={club?.email ?? ""} style={{ width: "100%" }} />
        </label>

        <label>
          IBAN (número de cuenta)
          <input
            name="iban"
            defaultValue={club?.iban ?? ""}
            placeholder="ESXX XXXX XXXX XXXX XXXX XXXX"
            style={{ width: "100%", textTransform: "uppercase" }}
          />
        </label>

        <div style={{ borderTop: "1px solid #eee", paddingTop: 12, marginTop: 4 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Presidente del club</div>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
            <label>
              Nombre
              <input name="presidente_nombre" defaultValue={club?.presidente_nombre ?? ""} style={{ width: "100%" }} />
            </label>
            <label>
              DNI
              <input name="presidente_dni" defaultValue={club?.presidente_dni ?? ""} style={{ width: "100%" }} />
            </label>
          </div>
        </div>

        <div style={{ borderTop: "1px solid #eee", paddingTop: 12, marginTop: 4 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Representante</div>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
            <label>
              Nombre
              <input name="representante_nombre" defaultValue={club?.representante_nombre ?? ""} style={{ width: "100%" }} />
            </label>
            <label>
              DNI
              <input name="representante_dni" defaultValue={club?.representante_dni ?? ""} style={{ width: "100%" }} />
            </label>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 4 }}>
          <button
            type="submit"
            className="icon-button tooltip-button"
            aria-label="Guardar cambios"
            style={{ width: "auto", padding: "0 16px", gap: 8 }}
          >
            <Icon name="save" />
            Guardar cambios
          </button>
        </div>
      </form>
    </div>
  );
}
