import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/server";
import { getActiveClubId } from "@/lib/club";
import { canEditClubData, getMyClubRole } from "@/lib/clubRole";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { Icon } from "@/components/Icon";
import { AutoSubmitFilters } from "@/components/AutoSubmitFilters";
import { buildFilterHref } from "@/lib/filters";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ConceptoRow = {
  id_concepto: number;
  concepto: string;
};

async function upsertConcepto(formData: FormData) {
  "use server";

  const id = String(formData.get("id_concepto") ?? "").trim();
  const concepto = String(formData.get("concepto") ?? "").trim();
  if (!concepto) redirect("/configuracion/conceptos?error=Concepto%20obligatorio");

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  // Get active club to verify canEdit permission
  const clubId = await getActiveClubId();
  if (!clubId) redirect("/clubs");
  const myRole = await getMyClubRole(clubId);
  if (!canEditClubData(myRole)) redirect("/no-autorizado");

  const { error } = id
    ? await supabase
        .from("conceptos")
        .update({ concepto })
        .eq("id_concepto", Number(id))
    : await supabase.from("conceptos").insert({ concepto });

  if (error) redirect("/configuracion/conceptos?error=" + encodeURIComponent(error.message));
  redirect("/configuracion/conceptos");
}

async function deleteConcepto(formData: FormData) {
  "use server";

  const id = Number(formData.get("id_concepto"));
  if (!id || !Number.isFinite(id)) {
    redirect("/configuracion/conceptos?error=id_concepto%20invalido");
  }

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const clubId = await getActiveClubId();
  if (!clubId) redirect("/clubs");
  const myRole = await getMyClubRole(clubId);
  if (!canEditClubData(myRole)) redirect("/no-autorizado");

  const { error } = await supabase
    .from("conceptos")
    .delete()
    .eq("id_concepto", id);

  if (error) redirect("/configuracion/conceptos?error=" + encodeURIComponent(error.message));
  redirect("/configuracion/conceptos");
}

export default async function ConceptosPage({
  searchParams,
}: {
  searchParams?: Promise<{
    error?: string;
    edit?: string;
    panel?: string;
    concepto?: string;
  }>;
}) {
  const sp = (await searchParams) ?? {};
  const errorMsg = sp.error ? decodeURIComponent(sp.error) : null;
  const editId = sp.edit ? Number(sp.edit) : null;
  const isNewPanel = sp.panel === "new";
  const conceptoFilter = String(sp.concepto ?? "").trim();

  const supabase = await createSupabaseServerClient();
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Verify user has a club (for canEdit check)
  const clubId = await getActiveClubId();
  if (!clubId) redirect("/clubs");
  const myRole = await getMyClubRole(clubId);
  const canUserEdit = canEditClubData(myRole);

  let conceptosQuery = supabase
    .from("conceptos")
    .select("id_concepto, concepto")
    .order("concepto", { ascending: true });

  if (conceptoFilter) {
    conceptosQuery = conceptosQuery.ilike("concepto", `%${conceptoFilter}%`);
  }

  const { data, error } = await conceptosQuery.limit(1000);
  const rows = (data ?? []) as ConceptoRow[];

  let editRow: ConceptoRow | null =
    editId !== null
      ? rows.find((row) => Number(row.id_concepto) === editId) ?? null
      : null;

  if (editId && !editRow) {
    const { data: one } = await supabase
      .from("conceptos")
      .select("id_concepto, concepto")
      .eq("id_concepto", editId)
      .maybeSingle();
    editRow = (one as ConceptoRow | null) ?? null;
  }

  const isDrawerOpen = canUserEdit && (isNewPanel || !!editRow);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 16 }}>
      <div className="page-toolbar">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>Conceptos</h1>
        </div>

        <div className="page-toolbar-actions">
          {canUserEdit ? (
            <Link
              href="/configuracion/conceptos?panel=new#form"
              className="icon-button tooltip-button"
              aria-label="Nuevo concepto"
            >
              <Icon name="new" />
            </Link>
          ) : null}
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

      {error && <p>Error: {error.message}</p>}

      {/* Filtros */}
      <AutoSubmitFilters action="/configuracion/conceptos">
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap", margin: "12px 0 16px" }}>
          <label className="filter-field" style={{ flex: "1 1 200px" }}>
            <span>Concepto</span>
            <div className="filter-control-row">
              <input
                type="search"
                name="concepto"
                placeholder="Buscar concepto"
                defaultValue={conceptoFilter}
              />
              <Link
                href={buildFilterHref("/configuracion/conceptos", {}, ["concepto"])}
                className="filter-reset-button"
                aria-label="Limpiar concepto"
              >
                X
              </Link>
            </div>
          </label>
        </div>
      </AutoSubmitFilters>

      {/* Panel lateral edición */}
      {isDrawerOpen ? (
        <>
          <Link href="/configuracion/conceptos" className="drawer-backdrop" aria-label="Cerrar panel" />
          <div id="form" className="side-drawer">
            <div className="side-drawer-header">
              <div className="side-drawer-title">
                <span>Conceptos</span>
                <h2>{editRow ? "Editar concepto" : "Nuevo concepto"}</h2>
              </div>
              <Link
                href="/configuracion/conceptos"
                className="icon-button icon-button-secondary tooltip-button"
                aria-label="Cerrar"
              >
                ×
              </Link>
            </div>

            {!canUserEdit ? (
              <p style={{ margin: 0, opacity: 0.8 }}>
                No tienes permisos para crear/editar conceptos.
              </p>
            ) : (
              <form
                id="concepto-form"
                key={editRow ? `edit-${editRow.id_concepto}` : "new"}
                action={upsertConcepto}
                className="side-drawer-body"
              >
                <input type="hidden" name="id_concepto" value={editRow?.id_concepto ?? ""} />

                <label>
                  Concepto
                  <input
                    name="concepto"
                    required
                    defaultValue={editRow?.concepto ?? ""}
                    style={{ width: "100%" }}
                    autoFocus
                  />
                </label>
              </form>
            )}

            {/* Barra de acciones */}
            {canUserEdit && (
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                paddingTop: 14,
                borderTop: "1px solid var(--border)",
                flexWrap: "wrap",
              }}>
                <button
                  type="submit"
                  form="concepto-form"
                  className="icon-button tooltip-button"
                  aria-label={editRow ? "Guardar cambios" : "Crear concepto"}
                >
                  <Icon name="save" />
                </button>

                <div style={{ flex: 1 }} />

                {/* Eliminar */}
                {editRow && (
                  <form action={deleteConcepto}>
                    <input type="hidden" name="id_concepto" value={editRow.id_concepto} />
                    <ConfirmSubmitButton
                      message="¿Eliminar definitivamente este concepto? Si está usado en contabilidad, dará error."
                      className="icon-button icon-button-danger tooltip-button"
                      ariaLabel="Eliminar concepto definitivamente"
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

      {/* Contador */}
      <h2 style={{ fontSize: 16, marginTop: 16, marginBottom: 8 }}>
        Listado ({rows.length})
      </h2>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>
                Concepto
              </th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>
                Acciones
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr key={row.id_concepto}>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  <div style={{ fontWeight: 700 }}>{row.concepto}</div>
                  <span style={{ opacity: 0.55, fontSize: 12 }}>id: {row.id_concepto}</span>
                </td>

                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  {canUserEdit ? (
                    <div className="row-actions">
                      <Link
                        href={`/configuracion/conceptos?edit=${row.id_concepto}#form`}
                        className="app-action-link"
                        style={{ gap: 6 }}
                        aria-label="Editar concepto"
                      >
                        <Icon name="edit" className="button-icon" />
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
                <td colSpan={2} style={{ padding: 12, opacity: 0.8 }}>
                  No hay conceptos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
