import { redirect } from "next/navigation";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveClubId } from "@/lib/club";
import { canEditClubData, getMyClubRole } from "@/lib/clubRole";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function toNullableText(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function toBoolean(value: FormDataEntryValue | null): boolean {
  return String(value ?? "") === "on";
}

async function updatePersonal(formData: FormData) {
  "use server";

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const clubId = await getActiveClubId();
  if (!clubId) redirect("/clubs");

  const role = await getMyClubRole(clubId);
  if (!canEditClubData(role)) redirect("/personal?error=sin_permiso");

  const id = Number(formData.get("id_personal"));
  if (!Number.isFinite(id)) redirect("/personal?error=id");

  const nombre = String(formData.get("nombre") ?? "").trim();
  const nif = toNullableText(formData.get("nif"));
  const tipo = toNullableText(formData.get("tipo"));
  const observaciones = toNullableText(formData.get("observaciones"));
  const activo = toBoolean(formData.get("activo"));

  if (!nombre) redirect(`/personal/${id}?error=nombre`);

  const { error } = await supabase
    .from("personal")
    .update({ nombre, nif, tipo, observaciones, activo })
    .eq("id_personal", id)
    .eq("club_id", clubId);

  if (error) {
    redirect(`/personal/${id}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/personal");
  redirect("/personal");
}

export default async function PersonalEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string }>;
}) {
  const { id: idParam } = await params;
  const sp = (await searchParams) ?? {};
  const supabase = await createSupabaseServerClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const clubId = await getActiveClubId();
  if (!clubId) redirect("/clubs");

  const role = await getMyClubRole(clubId);
  if (!canEditClubData(role)) redirect("/personal?error=sin_permiso");

  const id = Number(idParam);
  if (!Number.isFinite(id)) redirect("/personal?error=id");

  const { data: person, error } = await supabase
    .from("personal")
    .select("id_personal,nombre,nif,tipo,observaciones,activo")
    .eq("id_personal", id)
    .eq("club_id", clubId)
    .single();

  if (error || !person) redirect("/personal?error=no_encontrado");

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 16 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Editar personal</h1>
      </div>

      {sp.error ? (
        <div
          style={{
            border: "1px solid #f5c2c2",
            background: "#fff5f5",
            padding: 10,
            borderRadius: 8,
            marginTop: 10,
          }}
        >
          <b>Error:</b> {sp.error}
        </div>
      ) : null}

      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: 10,
          padding: 12,
          marginTop: 12,
        }}
      >
        <form action={updatePersonal} style={{ display: "grid", gap: 10 }}>
          <input type="hidden" name="id_personal" value={person.id_personal} />

          <label>
            Nombre *
            <input
              name="nombre"
              required
              defaultValue={person.nombre}
              style={{ width: "100%", padding: 8 }}
            />
          </label>

          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
            <label>
              NIF
              <input
                name="nif"
                defaultValue={person.nif ?? ""}
                style={{ width: "100%", padding: 8 }}
              />
            </label>

            <label>
              Tipo
              <input
                name="tipo"
                defaultValue={person.tipo ?? ""}
                style={{ width: "100%", padding: 8 }}
              />
            </label>
          </div>

          <label>
            Observaciones
            <input
              name="observaciones"
              defaultValue={person.observaciones ?? ""}
              style={{ width: "100%", padding: 8 }}
            />
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input name="activo" type="checkbox" defaultChecked={!!person.activo} />
            Activo
          </label>

          <div style={{ display: "flex", gap: 10 }}>
            <button type="submit" style={{ padding: "10px 12px", cursor: "pointer" }}>
              Guardar cambios
            </button>

            <Link href="/personal" style={{ padding: "10px 12px" }}>
              Cancelar
            </Link>
          </div>
        </form>
      </section>
    </div>
  );
}
