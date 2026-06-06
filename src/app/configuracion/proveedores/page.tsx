import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveClubId } from "@/lib/club";
import { canEditClubData, getMyClubRole } from "@/lib/clubRole";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { Icon } from "@/components/Icon";
import { AutoSubmitFilters } from "@/components/AutoSubmitFilters";
import { buildFilterHref } from "@/lib/filters";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ProveedorRow = {
  id_proveedor: number;
  proveedor: string;
  cif: string | null;
  domicilio: string | null;
  telefono: string | null;
  email: string | null;
  contacto: string | null;
  activo: boolean;
  created_at?: string | null;
};

type ProveedorPayload = {
  club_id: number;
  proveedor: string;
  cif: string | null;
  domicilio: string | null;
  telefono: string | null;
  email: string | null;
  contacto: string | null;
};
type ProveedoresSortKey = "proveedor" | "cif" | "contacto" | "telefono" | "email";
type SortDirection = "asc" | "desc";

const proveedoresSortColumns: Record<ProveedoresSortKey, string> = {
  proveedor: "proveedor",
  cif: "cif",
  contacto: "contacto",
  telefono: "telefono",
  email: "email",
};

function toText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

async function upsertProveedor(formData: FormData) {
  "use server";

  const clubId = Number(formData.get("club_id"));
  const id = String(formData.get("id_proveedor") ?? "").trim();

  if (!clubId || !Number.isFinite(clubId)) {
    redirect("/configuracion/proveedores?error=club_id%20invalido");
  }

  const proveedor = String(formData.get("proveedor") ?? "").trim();
  if (!proveedor) redirect("/configuracion/proveedores?error=Proveedor%20obligatorio");

  const payload: ProveedorPayload = {
    club_id: clubId,
    proveedor,
    cif: toText(formData.get("cif")),
    domicilio: toText(formData.get("domicilio")),
    telefono: toText(formData.get("telefono")),
    email: toText(formData.get("email")),
    contacto: toText(formData.get("contacto")),
  };

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const myRole = await getMyClubRole(clubId);
  if (!canEditClubData(myRole)) redirect("/no-autorizado");

  const { error } = id
    ? await supabase
        .from("proveedores")
        .update(payload)
        .eq("club_id", clubId)
        .eq("id_proveedor", Number(id))
    : await supabase.from("proveedores").insert(payload);

  if (error) redirect("/configuracion/proveedores?error=" + encodeURIComponent(error.message));
  redirect("/configuracion/proveedores");
}

async function darDeBajaProveedor(formData: FormData) {
  "use server";

  const clubId = Number(formData.get("club_id"));
  const id = Number(formData.get("id_proveedor"));

  if (!clubId || !Number.isFinite(clubId)) redirect("/configuracion/proveedores?error=club_id%20invalido");
  if (!id || !Number.isFinite(id)) redirect("/configuracion/proveedores?error=id_proveedor%20invalido");

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const myRole = await getMyClubRole(clubId);
  if (!canEditClubData(myRole)) redirect("/no-autorizado");

  const { error } = await supabase
    .from("proveedores")
    .update({ activo: false })
    .eq("club_id", clubId)
    .eq("id_proveedor", id);

  if (error) redirect("/configuracion/proveedores?error=" + encodeURIComponent(error.message));
  redirect("/configuracion/proveedores");
}

async function reactivarProveedor(formData: FormData) {
  "use server";

  const clubId = Number(formData.get("club_id"));
  const id = Number(formData.get("id_proveedor"));

  if (!clubId || !Number.isFinite(clubId)) redirect("/configuracion/proveedores?error=club_id%20invalido");
  if (!id || !Number.isFinite(id)) redirect("/configuracion/proveedores?error=id_proveedor%20invalido");

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const myRole = await getMyClubRole(clubId);
  if (!canEditClubData(myRole)) redirect("/no-autorizado");

  const { error } = await supabase
    .from("proveedores")
    .update({ activo: true })
    .eq("club_id", clubId)
    .eq("id_proveedor", id);

  if (error) redirect("/configuracion/proveedores?error=" + encodeURIComponent(error.message));
  redirect("/configuracion/proveedores?incluir_bajas=1");
}

async function deleteProveedor(formData: FormData) {
  "use server";

  const clubId = Number(formData.get("club_id"));
  const id = Number(formData.get("id_proveedor"));

  if (!clubId || !Number.isFinite(clubId)) {
    redirect("/configuracion/proveedores?error=club_id%20invalido");
  }
  if (!id || !Number.isFinite(id)) {
    redirect("/configuracion/proveedores?error=id_proveedor%20invalido");
  }

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const myRole = await getMyClubRole(clubId);
  if (!canEditClubData(myRole)) redirect("/no-autorizado");

  const { error } = await supabase
    .from("proveedores")
    .delete()
    .eq("club_id", clubId)
    .eq("id_proveedor", id);

  if (error) redirect("/configuracion/proveedores?error=" + encodeURIComponent(error.message));
  redirect("/configuracion/proveedores");
}

export default async function ProveedoresPage({
  searchParams,
}: {
  searchParams?: Promise<{
    error?: string;
    edit?: string;
    panel?: string;
    proveedor?: string;
    sort?: string;
    dir?: string;
    incluir_bajas?: string;
  }>;
}) {
  const sp = (await searchParams) ?? {};
  const errorMsg = sp.error ? decodeURIComponent(sp.error) : null;
  const editId = sp.edit ? Number(sp.edit) : null;
  const isNewPanel = sp.panel === "new";
  const proveedorFilter = String(sp.proveedor ?? "").trim();
  const incluirBajas = sp.incluir_bajas === "1";
  const sortKey = (["proveedor", "cif", "contacto", "telefono", "email"].includes(
    String(sp.sort)
  )
    ? sp.sort
    : "proveedor") as ProveedoresSortKey;
  const sortDirection: SortDirection = sp.dir === "desc" ? "desc" : "asc";

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const clubId = await getActiveClubId();
  if (!clubId) redirect("/clubs");

  const myRole = await getMyClubRole(clubId);
  const canUserEdit = canEditClubData(myRole);

  let proveedoresQuery = supabase
    .from("proveedores")
    .select("id_proveedor, proveedor, cif, domicilio, telefono, email, contacto, activo, created_at")
    .eq("club_id", clubId)
    .order(proveedoresSortColumns[sortKey], {
      ascending: sortDirection === "asc",
      nullsFirst: false,
    });

  // Por defecto solo activos; si se pide incluir bajas, traemos todos
  if (!incluirBajas) {
    proveedoresQuery = proveedoresQuery.eq("activo", true);
  }

  if (proveedorFilter) {
    proveedoresQuery = proveedoresQuery.ilike("proveedor", `%${proveedorFilter}%`);
  }

  const { data, error } = await proveedoresQuery.limit(1000);

  const rows = (data ?? []) as ProveedorRow[];

  function sortHref(nextSort: ProveedoresSortKey) {
    return buildFilterHref(
      "/configuracion/proveedores",
      {
        proveedor: proveedorFilter,
        sort: nextSort,
        dir: sortKey === nextSort && sortDirection === "asc" ? "desc" : "asc",
        incluir_bajas: incluirBajas ? "1" : null,
      },
      []
    );
  }

  function sortHeader(nextSort: ProveedoresSortKey, label: string) {
    const active = sortKey === nextSort;
    return (
      <th
        style={{
          textAlign: "left",
          borderBottom: "1px solid #ddd",
          padding: 8,
          whiteSpace: "nowrap",
        }}
      >
        <Link
          href={sortHref(nextSort)}
          className="table-sort-button"
          aria-label={`Ordenar por ${label}`}
        >
          <span>{label}</span>
          <span aria-hidden="true">{active ? (sortDirection === "asc" ? "↑" : "↓") : "↕"}</span>
        </Link>
      </th>
    );
  }

  let editRow: ProveedorRow | null =
    editId !== null
      ? rows.find((row) => Number(row.id_proveedor) === editId) ?? null
      : null;

  if (editId && !editRow) {
    const { data: one } = await supabase
      .from("proveedores")
      .select("id_proveedor, proveedor, cif, domicilio, telefono, email, contacto, activo, created_at")
      .eq("club_id", clubId)
      .eq("id_proveedor", editId)
      .maybeSingle();

    editRow = (one as ProveedorRow | null) ?? null;
  }

  const isDrawerOpen = canUserEdit && (isNewPanel || !!editRow);

  const activosCount = rows.filter((r) => r.activo).length;
  const bajasCount = rows.filter((r) => !r.activo).length;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 16 }}>
      <div className="page-toolbar">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>Proveedores</h1>
        </div>

        <div className="page-toolbar-actions">
          {canUserEdit ? (
            <Link
              href="/configuracion/proveedores?panel=new#form"
              className="icon-button tooltip-button"
              aria-label="Nuevo proveedor"
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
      <AutoSubmitFilters action="/configuracion/proveedores">
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap", margin: "12px 0 16px" }}>
          <label className="filter-field" style={{ flex: "1 1 200px" }}>
            <span>Proveedor</span>
            <div className="filter-control-row">
              <input
                type="search"
                name="proveedor"
                placeholder="Buscar proveedor"
                defaultValue={proveedorFilter}
              />
              <Link
                href={buildFilterHref("/configuracion/proveedores", { incluir_bajas: incluirBajas ? "1" : null }, ["proveedor"])}
                className="filter-reset-button"
                aria-label="Limpiar proveedor"
              >
                X
              </Link>
            </div>
          </label>

          {/* Toggle bajas */}
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "0 14px",
              height: 36,
              border: "1px solid #cfd7e6",
              borderRadius: 6,
              cursor: "pointer",
              background: incluirBajas ? "#fff8e1" : "#fff",
              fontSize: 13,
              fontWeight: 650,
              whiteSpace: "nowrap",
              userSelect: "none",
            }}
          >
            <input
              type="checkbox"
              name="incluir_bajas"
              value="1"
              defaultChecked={incluirBajas}
              style={{ accentColor: "#f99c00", width: 15, height: 15 }}
            />
            Mostrar dados de baja
          </label>
        </div>
      </AutoSubmitFilters>

      {/* Panel lateral edición */}
      {isDrawerOpen ? (
        <>
          <Link href="/configuracion/proveedores" className="drawer-backdrop" aria-label="Cerrar panel" />
          <div
            id="form"
            className="side-drawer"
          >
            <div className="side-drawer-header">
              <div className="side-drawer-title">
                <span>Proveedores</span>
                <h2>{editRow ? `Editar proveedor` : "Nuevo proveedor"}</h2>
                {editRow && !editRow.activo && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#b93a48", fontSize: 12, fontWeight: 750 }}>
                    ● DADO DE BAJA
                  </span>
                )}
              </div>
              <Link
                href="/configuracion/proveedores"
                className="icon-button icon-button-secondary tooltip-button"
                aria-label="Cerrar"
              >
                ×
              </Link>
            </div>

            {!canUserEdit ? (
              <p style={{ margin: 0, opacity: 0.8 }}>
                No tienes permisos para crear/editar proveedores.
              </p>
            ) : (
              <form
                id="proveedor-form"
                key={editRow ? `edit-${editRow.id_proveedor}` : "new"}
                action={upsertProveedor}
                className="side-drawer-body"
              >
                <input type="hidden" name="club_id" value={clubId} />
                <input type="hidden" name="id_proveedor" value={editRow?.id_proveedor ?? ""} />

                <label>
                  Proveedor (nombre)
                  <input name="proveedor" required defaultValue={editRow?.proveedor ?? ""} style={{ width: "100%" }} />
                </label>

                <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
                  <label>
                    CIF
                    <input name="cif" defaultValue={editRow?.cif ?? ""} style={{ width: "100%" }} />
                  </label>
                  <label>
                    Contacto
                    <input name="contacto" defaultValue={editRow?.contacto ?? ""} style={{ width: "100%" }} />
                  </label>
                </div>

                <label>
                  Domicilio
                  <input name="domicilio" defaultValue={editRow?.domicilio ?? ""} style={{ width: "100%" }} />
                </label>

                <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
                  <label>
                    Teléfono
                    <input name="telefono" defaultValue={editRow?.telefono ?? ""} style={{ width: "100%" }} />
                  </label>
                  <label>
                    Email
                    <input name="email" type="email" defaultValue={editRow?.email ?? ""} style={{ width: "100%" }} />
                  </label>
                </div>
              </form>
            )}

            {/* Barra de acciones unificada */}
            {canUserEdit && (
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                paddingTop: 14,
                borderTop: "1px solid var(--border)",
                flexWrap: "wrap",
              }}>
                {/* Guardar — asociado al form por id */}
                <button
                  type="submit"
                  form="proveedor-form"
                  className="icon-button tooltip-button"
                  aria-label={editRow ? "Guardar cambios" : "Crear proveedor"}
                >
                  <Icon name="save" />
                </button>

                <div style={{ flex: 1 }} />

                {/* Dar de baja / Reactivar */}
                {editRow && (
                  editRow.activo ? (
                    <form action={darDeBajaProveedor}>
                      <input type="hidden" name="club_id" value={clubId} />
                      <input type="hidden" name="id_proveedor" value={editRow.id_proveedor} />
                      <ConfirmSubmitButton
                        message="¿Dar de baja este proveedor? Dejará de aparecer en los controles, pero se conservará en el historial contable."
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "0 14px", height: 36, borderRadius: 6, border: "1px solid #f0c070", background: "#fffbea", color: "#92580a", fontSize: 13, fontWeight: 700, cursor: "pointer", minHeight: 36 }}
                      >
                        Dar de baja
                      </ConfirmSubmitButton>
                    </form>
                  ) : (
                    <form action={reactivarProveedor}>
                      <input type="hidden" name="club_id" value={clubId} />
                      <input type="hidden" name="id_proveedor" value={editRow.id_proveedor} />
                      <button type="submit" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "0 14px", height: 36, borderRadius: 6, border: "1px solid #a7d9b0", background: "#f0faf2", color: "#1a6b2e", fontSize: 13, fontWeight: 700, cursor: "pointer", minHeight: 36 }}>
                        Reactivar proveedor
                      </button>
                    </form>
                  )
                )}

                {/* Eliminar */}
                {editRow && (
                  <form action={deleteProveedor}>
                    <input type="hidden" name="club_id" value={clubId} />
                    <input type="hidden" name="id_proveedor" value={editRow.id_proveedor} />
                    <ConfirmSubmitButton
                      message="¿Eliminar definitivamente este proveedor? Si está usado en contabilidad, dará error."
                      className="icon-button icon-button-danger tooltip-button"
                      ariaLabel="Eliminar proveedor definitivamente"
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
        Listado ({activosCount}{incluirBajas && bajasCount > 0 ? ` + ${bajasCount} de baja` : ""})
      </h2>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              {sortHeader("proveedor", "Proveedor")}
              {sortHeader("cif", "CIF")}
              {sortHeader("contacto", "Contacto")}
              {sortHeader("telefono", "Telefono")}
              {sortHeader("email", "Email")}
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>
                Acciones
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id_proveedor}
                style={{ opacity: row.activo ? 1 : 0.55, background: row.activo ? undefined : "#fafafa" }}
              >
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  <div style={{ fontWeight: 700, textDecoration: row.activo ? undefined : "line-through" }}>
                    {row.proveedor}
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 2 }}>
                    <span style={{ opacity: 0.55, fontSize: 12 }}>id: {row.id_proveedor}</span>
                    {!row.activo && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          letterSpacing: "0.04em",
                          color: "#b93a48",
                          background: "#fff0f1",
                          border: "1px solid #f5c2c2",
                          borderRadius: 4,
                          padding: "1px 5px",
                        }}
                      >
                        BAJA
                      </span>
                    )}
                  </div>
                </td>

                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{row.cif ?? "-"}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{row.contacto ?? "-"}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{row.telefono ?? "-"}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{row.email ?? "-"}</td>

                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  {canUserEdit ? (
                    <div className="row-actions">
                      <Link
                        href={`/configuracion/proveedores?edit=${row.id_proveedor}${incluirBajas ? "&incluir_bajas=1" : ""}#form`}
                        className="app-action-link"
                        style={{ gap: 6 }}
                        aria-label={row.activo ? "Editar proveedor" : "Ver proveedor de baja"}
                      >
                        <Icon name="edit" />
                        {row.activo ? "Editar" : "Ver"}
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
                <td colSpan={6} style={{ padding: 12, opacity: 0.8 }}>
                  {incluirBajas
                    ? "No hay proveedores."
                    : "No hay proveedores activos. Activa \"Mostrar dados de baja\" para verlos."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
