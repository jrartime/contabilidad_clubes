import Link from "next/link";
import { Fragment } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/server";
import { getActiveClubId } from "@/lib/club";
import { canEditClubData, getMyClubRole } from "@/lib/clubRole";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { Icon } from "@/components/Icon";
import { AutoSubmitFilters } from "@/components/AutoSubmitFilters";
import { buildFilterHref } from "@/lib/filters";
import { matchesGlobalSearch } from "@/lib/search";
import { TIPOS_PROGRAMA } from "@/lib/conceptRules";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ConceptoRow = {
  id_concepto: number;
  concepto: string;
  en_listado: boolean;
  valido_clubes: boolean;
  valido_eventos: boolean;
  valido_eedd_ctd_discapacidad: boolean;
  naturaleza: "gasto" | "ingreso";
  codigo_interno: string | null;
  requisito_entidad_origen: "no" | "opcional" | "obligatoria";
  requisito_descripcion: "no" | "opcional" | "obligatoria";
};

type ConceptosSortKey = "concepto" | "naturaleza" | "en_listado" | "valido_clubes" | "valido_eventos" | "valido_eedd_ctd_discapacidad";
type SortDirection = "asc" | "desc";

async function upsertConcepto(formData: FormData) {
  "use server";

  const id = String(formData.get("id_concepto") ?? "").trim();
  const concepto = String(formData.get("concepto") ?? "").trim();
  const checks = {
    en_listado: formData.get("en_listado") === "on",
    valido_clubes: formData.get("valido_clubes") === "on",
    valido_eventos: formData.get("valido_eventos") === "on",
    valido_eedd_ctd_discapacidad: formData.get("valido_eedd_ctd_discapacidad") === "on",
  };
  const naturaleza = formData.get("naturaleza") === "ingreso" ? "ingreso" : "gasto";
  const codigo_interno = String(formData.get("codigo_interno") ?? "").trim() || null;
  const requisito_entidad_origen = String(formData.get("requisito_entidad_origen") ?? "no");
  const requisito_descripcion = String(formData.get("requisito_descripcion") ?? "opcional");
  const metadata = { naturaleza, codigo_interno, requisito_entidad_origen, requisito_descripcion };
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
        .update({ concepto, ...checks, ...metadata })
        .eq("club_id", clubId)
        .eq("id_concepto", Number(id))
    : await supabase.from("conceptos").insert({ club_id: clubId, concepto, ...checks, ...metadata });

  const redirectTo = String(formData.get("redirect_to") ?? "").trim() || "/configuracion/conceptos";
  if (error) redirect("/configuracion/conceptos?error=" + encodeURIComponent(error.message));
  redirect(redirectTo);
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
    .eq("club_id", clubId)
    .eq("id_concepto", id);

  const redirectTo = String(formData.get("redirect_to") ?? "").trim() || "/configuracion/conceptos";
  if (error) redirect("/configuracion/conceptos?error=" + encodeURIComponent(error.message));
  redirect(redirectTo);
}

export default async function ConceptosPage({
  searchParams,
}: {
  searchParams?: Promise<{
    error?: string;
    edit?: string;
    panel?: string;
    concepto?: string;
    buscar?: string;
    sort?: string;
    dir?: string;
  }>;
}) {
  const sp = (await searchParams) ?? {};
  const errorMsg = sp.error ? decodeURIComponent(sp.error) : null;
  const editId = sp.edit ? Number(sp.edit) : null;
  const isNewPanel = sp.panel === "new";
  const conceptoFilter = String(sp.concepto ?? "").trim();
  const buscar = String(sp.buscar ?? "").trim();
  const sortKey = (["concepto", "naturaleza", "en_listado", "valido_clubes", "valido_eventos", "valido_eedd_ctd_discapacidad"].includes(String(sp.sort)) ? sp.sort : "concepto") as ConceptosSortKey;
  const sortDirection: SortDirection = sp.dir === "desc" ? "desc" : "asc";
  const listParams = { concepto: conceptoFilter, buscar, sort: sortKey !== "concepto" ? sortKey : null, dir: sortDirection !== "asc" ? sortDirection : null };
  const listHref = buildFilterHref("/configuracion/conceptos", listParams, []);

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
    .select("id_concepto, concepto, en_listado, valido_clubes, valido_eventos, valido_eedd_ctd_discapacidad, naturaleza, codigo_interno, requisito_entidad_origen, requisito_descripcion")
    .eq("club_id", clubId)
    .order(sortKey, { ascending: sortDirection === "asc", nullsFirst: false })
    .order("concepto", { ascending: true });

  if (conceptoFilter) {
    conceptosQuery = conceptosQuery.ilike("concepto", `%${conceptoFilter}%`);
  }

  const { data, error } = await conceptosQuery.limit(1000);
  const rows = ((data ?? []) as ConceptoRow[]).filter((row) => matchesGlobalSearch(buscar, Object.values(row)));

  let editRow: ConceptoRow | null =
    editId !== null
      ? rows.find((row) => Number(row.id_concepto) === editId) ?? null
      : null;

  if (editId && !editRow) {
    const { data: one } = await supabase
      .from("conceptos")
      .select("id_concepto, concepto, en_listado, valido_clubes, valido_eventos, valido_eedd_ctd_discapacidad, naturaleza, codigo_interno, requisito_entidad_origen, requisito_descripcion")
      .eq("club_id", clubId)
      .eq("id_concepto", editId)
      .maybeSingle();
    editRow = (one as ConceptoRow | null) ?? null;
  }

  const isDrawerOpen = canUserEdit && (isNewPanel || !!editRow);

  function sortHref(nextSort: ConceptosSortKey) {
    return buildFilterHref("/configuracion/conceptos", {
      concepto: conceptoFilter,
      buscar,
      sort: nextSort === "concepto" ? null : nextSort,
      dir: sortKey === nextSort && sortDirection === "asc" ? "desc" : "asc",
    }, []);
  }

  function sortHeader(nextSort: ConceptosSortKey, label: string, textAlign: "left" | "center" = "left") {
    const active = sortKey === nextSort;
    return (
      <th style={{ textAlign, borderBottom: "1px solid #ddd", padding: 8 }}>
        <Link href={sortHref(nextSort)} className="table-sort-button" aria-label={`Ordenar por ${label}`}>
          <span>{label}</span>
          <span aria-hidden="true">{active ? (sortDirection === "asc" ? "↑" : "↓") : "↕"}</span>
        </Link>
      </th>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 16 }}>
      <div className="page-toolbar">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>Conceptos</h1>
        </div>

        <div className="page-toolbar-actions">
          {canUserEdit ? (
            <Link
              href={buildFilterHref("/configuracion/conceptos", { ...listParams, panel: "new" }, []) + "#form"}
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
        <input type="hidden" name="sort" value={sortKey !== "concepto" ? sortKey : ""} />
        <input type="hidden" name="dir" value={sortDirection !== "asc" ? sortDirection : ""} />
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap", margin: "12px 0 16px" }}>
          <label className="filter-field" style={{ flex: "1 1 260px" }}><span>Búsqueda</span><div className="filter-control-row"><input type="search" name="buscar" placeholder="Buscar en todos los campos" defaultValue={buscar} />{buscar ? <Link href={buildFilterHref("/configuracion/conceptos", { ...listParams, concepto: conceptoFilter }, ["buscar"])} className="filter-reset-button" aria-label="Limpiar búsqueda">X</Link> : null}</div></label>
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
                href={buildFilterHref("/configuracion/conceptos", { ...listParams, buscar }, ["concepto"])}
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
          <Link href={listHref} className="drawer-backdrop" aria-label="Cerrar panel" />
          <div id="form" className="side-drawer">
            <div className="side-drawer-header">
              <div className="side-drawer-title">
                <span>Conceptos</span>
                <h2>{editRow ? "Editar concepto" : "Nuevo concepto"}</h2>
              </div>
              <Link
                href={listHref}
                className="icon-button icon-button-secondary tooltip-button"
                aria-label="Cerrar"
              >
                <Icon name="logout" />
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
                <input type="hidden" name="redirect_to" value={listHref} />

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
                <label>
                  Naturaleza
                  <select name="naturaleza" defaultValue={editRow?.naturaleza ?? "gasto"}>
                    <option value="gasto">Gasto</option>
                    <option value="ingreso">Ingreso</option>
                  </select>
                </label>
                <label>
                  Código interno
                  <input name="codigo_interno" defaultValue={editRow?.codigo_interno ?? ""} placeholder="Opcional" />
                </label>
                <label>
                  Entidad de origen
                  <select name="requisito_entidad_origen" defaultValue={editRow?.requisito_entidad_origen ?? "no"}>
                    <option value="no">No requerida</option><option value="opcional">Opcional</option><option value="obligatoria">Obligatoria</option>
                  </select>
                </label>
                <label>
                  Descripción adicional
                  <select name="requisito_descripcion" defaultValue={editRow?.requisito_descripcion ?? "opcional"}>
                    <option value="no">No requerida</option><option value="opcional">Opcional</option><option value="obligatoria">Obligatoria</option>
                  </select>
                </label>
                <label><input type="checkbox" name="en_listado" defaultChecked={editRow?.en_listado ?? false} /> En listado oficial</label>
                <label><input type="checkbox" name="valido_clubes" defaultChecked={editRow?.valido_clubes ?? false} /> Admitido en Club</label>
                <label><input type="checkbox" name="valido_eventos" defaultChecked={editRow?.valido_eventos ?? false} /> Admitido en Eventos</label>
                <label><input type="checkbox" name="valido_eedd_ctd_discapacidad" defaultChecked={editRow?.valido_eedd_ctd_discapacidad ?? false} /> Admitido en EEDD / CTD / discapacidad</label>
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
                    <input type="hidden" name="redirect_to" value={listHref} />
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
      <p style={{ margin: "-2px 0 10px", fontSize: 12, opacity: 0.7 }}>
        Los ticks indican si el concepto pertenece al catálogo regulado y para qué tipos de programa está admitido.
      </p>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              {sortHeader("concepto", "Concepto")}
              {sortHeader("naturaleza", "Naturaleza")}
              {sortHeader("en_listado", "En listado", "center")}
              {TIPOS_PROGRAMA.map((tipo) => (
                <Fragment key={tipo.value}>{sortHeader(tipo.value === "clubes" ? "valido_clubes" : tipo.value === "eventos" ? "valido_eventos" : "valido_eedd_ctd_discapacidad", tipo.label, "center")}</Fragment>
              ))}
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
                  {row.naturaleza === "ingreso" ? "Ingreso" : "Gasto"}
                </td>

                <td style={{ padding: 8, borderBottom: "1px solid #eee", textAlign: "center", fontSize: 17 }}>
                  {row.en_listado ? <span aria-label="Sí" title="Incluido en el listado">✓</span> : "-"}
                </td>

                {TIPOS_PROGRAMA.map((tipo) => {
                  const permitido = tipo.value === "clubes" ? row.valido_clubes : tipo.value === "eventos" ? row.valido_eventos : row.valido_eedd_ctd_discapacidad;
                  return (
                    <td key={tipo.value} style={{ padding: 8, borderBottom: "1px solid #eee", textAlign: "center", fontSize: 17 }}>
                      {permitido ? <span aria-label="Sí" title={`Admitido en ${tipo.label}`}>✓</span> : "-"}
                    </td>
                  );
                })}

                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  {canUserEdit ? (
                    <div className="row-actions">
                      <Link
                        href={buildFilterHref("/configuracion/conceptos", { ...listParams, edit: row.id_concepto }, []) + "#form"}
                        className="app-action-link"
                        style={{ gap: 6 }}
                        aria-label="Editar concepto"
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
                <td colSpan={7} style={{ padding: 12, opacity: 0.8 }}>
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
