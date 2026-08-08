import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveClubId } from "@/lib/club";
import { canEditClubData, getMyClubRole } from "@/lib/clubRole";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { Icon } from "@/components/Icon";
import { AutoSubmitFilters } from "@/components/AutoSubmitFilters";
import { buildFilterHref } from "@/lib/filters";
import { matchesGlobalSearch } from "@/lib/search";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type EntidadRow = {
  id_entidad: number;
  entidad: string;
  created_at?: string | null;
};

async function upsertEntidad(formData: FormData) {
  "use server";

  const clubId = Number(formData.get("club_id"));
  const id = String(formData.get("id_entidad") ?? "").trim();

  if (!clubId || !Number.isFinite(clubId)) {
    redirect("/configuracion/entidades?error=club_id%20invalido");
  }

  const entidad = String(formData.get("entidad") ?? "").trim();
  if (!entidad) redirect("/configuracion/entidades?error=El%20nombre%20es%20obligatorio");

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const myRole = await getMyClubRole(clubId);
  if (!canEditClubData(myRole)) redirect("/no-autorizado");

  const { error } = id
    ? await supabase.from("entidades").update({ entidad }).eq("club_id", clubId).eq("id_entidad", Number(id))
    : await supabase.from("entidades").insert({ club_id: clubId, entidad });

  const redirectTo = String(formData.get("redirect_to") ?? "").trim() || "/configuracion/entidades";
  if (error) redirect("/configuracion/entidades?error=" + encodeURIComponent(error.message));
  redirect(redirectTo);
}

async function deleteEntidad(formData: FormData) {
  "use server";

  const clubId = Number(formData.get("club_id"));
  const id = Number(formData.get("id_entidad"));

  if (!clubId || !Number.isFinite(clubId)) redirect("/configuracion/entidades?error=club_id%20invalido");
  if (!id || !Number.isFinite(id)) redirect("/configuracion/entidades?error=id_entidad%20invalido");

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const myRole = await getMyClubRole(clubId);
  if (!canEditClubData(myRole)) redirect("/no-autorizado");

  const { error } = await supabase.from("entidades").delete().eq("club_id", clubId).eq("id_entidad", id);

  const redirectToDelete = String(formData.get("redirect_to") ?? "").trim() || "/configuracion/entidades";
  if (error) {
    const message =
      error.code === "23503"
        ? "No se puede eliminar: hay registros de contabilidad que usan esta entidad."
        : error.message;
    redirect("/configuracion/entidades?error=" + encodeURIComponent(message));
  }
  redirect(redirectToDelete);
}

export default async function EntidadesPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; edit?: string; panel?: string; buscar?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const errorMsg = sp.error ? decodeURIComponent(sp.error) : null;
  const editId = sp.edit ? Number(sp.edit) : null;
  const isNewPanel = sp.panel === "new";
  const buscar = String(sp.buscar ?? "").trim();
  const listHref = buildFilterHref("/configuracion/entidades", { buscar }, []);

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const clubId = await getActiveClubId();
  if (!clubId) redirect("/clubs");

  const myRole = await getMyClubRole(clubId);
  const canUserEdit = canEditClubData(myRole);

  const { data, error } = await supabase
    .from("entidades")
    .select("id_entidad, entidad, created_at")
    .eq("club_id", clubId)
    .order("entidad", { ascending: true })
    .limit(1000);

  const rows = ((data ?? []) as EntidadRow[]).filter((row) => matchesGlobalSearch(buscar, Object.values(row)));

  let editRow: EntidadRow | null =
    editId !== null ? rows.find((row) => Number(row.id_entidad) === editId) ?? null : null;

  if (editId && !editRow) {
    const { data: one } = await supabase
      .from("entidades")
      .select("id_entidad, entidad, created_at")
      .eq("club_id", clubId)
      .eq("id_entidad", editId)
      .maybeSingle();
    editRow = (one as EntidadRow | null) ?? null;
  }

  const isDrawerOpen = canUserEdit && (isNewPanel || !!editRow);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 16 }}>
      <div className="page-toolbar">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>Entidades</h1>
          <p style={{ margin: "4px 0 0", opacity: 0.7, fontSize: 13 }}>
            Entidades de origen que se pueden asociar a un movimiento de contabilidad (p. ej. Federación, Ayuntamiento).
          </p>
        </div>

        <div className="page-toolbar-actions">
          {canUserEdit ? (
            <Link href="/configuracion/entidades?panel=new#form" className="icon-button tooltip-button" aria-label="Nueva entidad">
              <Icon name="new" />
            </Link>
          ) : null}
        </div>
      </div>

      {errorMsg && (
        <div style={{ border: "1px solid #f5c2c2", background: "#fff5f5", padding: 10, borderRadius: 8, marginBottom: 12 }}>
          <b>Error:</b> {errorMsg}
        </div>
      )}

      {error && <p>Error: {error.message}</p>}

      <AutoSubmitFilters action="/configuracion/entidades" className="filters-grid">
        <label className="filter-field">
          <span>Búsqueda</span>
          <div className="filter-control-row">
            <input type="search" name="buscar" defaultValue={buscar} placeholder="Buscar entidad" />
            {buscar ? (
              <Link href="/configuracion/entidades" className="filter-reset-button" aria-label="Limpiar búsqueda">X</Link>
            ) : null}
          </div>
        </label>
      </AutoSubmitFilters>

      {isDrawerOpen ? (
        <>
          <Link href={listHref} className="drawer-backdrop" aria-label="Cerrar panel" />
          <div id="form" className="side-drawer">
            <div className="side-drawer-header">
              <div className="side-drawer-title">
                <span>Entidades</span>
                <h2>{editRow ? "Editar entidad" : "Nueva entidad"}</h2>
              </div>
              <Link href={listHref} className="icon-button icon-button-secondary tooltip-button" aria-label="Cerrar">
                <Icon name="logout" />
              </Link>
            </div>

            {!canUserEdit ? (
              <p style={{ margin: 0, opacity: 0.8 }}>No tienes permisos para crear/editar entidades.</p>
            ) : (
              <form
                id="entidad-form"
                key={editRow ? `edit-${editRow.id_entidad}` : "new"}
                action={upsertEntidad}
                className="side-drawer-body"
              >
                <input type="hidden" name="club_id" value={clubId} />
                <input type="hidden" name="id_entidad" value={editRow?.id_entidad ?? ""} />
                <input type="hidden" name="redirect_to" value={listHref} />

                <label>
                  Nombre *
                  <input name="entidad" required defaultValue={editRow?.entidad ?? ""} style={{ width: "100%" }} />
                </label>
              </form>
            )}

            {canUserEdit && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 14, borderTop: "1px solid var(--border)", flexWrap: "wrap" }}>
                <button
                  type="submit"
                  form="entidad-form"
                  className="icon-button tooltip-button"
                  aria-label={editRow ? "Guardar cambios" : "Crear entidad"}
                >
                  <Icon name="save" />
                </button>

                <div style={{ flex: 1 }} />

                {editRow && (
                  <form action={deleteEntidad}>
                    <input type="hidden" name="club_id" value={clubId} />
                    <input type="hidden" name="id_entidad" value={editRow.id_entidad} />
                    <input type="hidden" name="redirect_to" value={listHref} />
                    <ConfirmSubmitButton
                      message="¿Eliminar definitivamente esta entidad? Si está usada en contabilidad, dará error."
                      className="icon-button icon-button-danger tooltip-button"
                      ariaLabel="Eliminar entidad definitivamente"
                    >
                      <Icon name="delete" />
                    </ConfirmSubmitButton>
                  </form>
                )}
              </div>
            )}
          </div>
        </>
      ) : null}

      <h2 style={{ fontSize: 16, marginTop: 16, marginBottom: 8 }}>Listado ({rows.length})</h2>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Entidad</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id_entidad}>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  <div style={{ fontWeight: 700 }}>{row.entidad}</div>
                  <div style={{ opacity: 0.55, fontSize: 12 }}>id: {row.id_entidad}</div>
                </td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  {canUserEdit ? (
                    <div className="row-actions">
                      <Link
                        href={`/configuracion/entidades?edit=${row.id_entidad}#form`}
                        className="app-action-link"
                        style={{ gap: 6 }}
                        aria-label="Editar entidad"
                      >
                        <Icon name="edit" />
                        Editar
                      </Link>
                    </div>
                  ) : (
                    <span style={{ opacity: 0.6 }}>-</span>
                  )}
                </td>
              </tr>
            ))}

            {rows.length === 0 && !error && (
              <tr>
                <td colSpan={2} style={{ padding: 12, opacity: 0.8 }}>No hay entidades.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
