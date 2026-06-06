import Link from "next/link";
import { redirect } from "next/navigation";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { AutoSubmitFilters } from "@/components/AutoSubmitFilters";
import { Icon } from "@/components/Icon";
import { getActiveClubId } from "@/lib/club";
import { canEditClubData, getMyClubRole } from "@/lib/clubRole";
import { parseDecimalToNumber } from "@/lib/decimal";
import { buildFilterHref } from "@/lib/filters";
import {
  formatDateEs,
  formatDecimal,
  toDateInputValue,
  toDecimalInputValue,
} from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ProgramaRow = {
  id_programa: number;
  programa: string | null;
  anio: number | null;
  subvencion: number | null;
  fecha_limite: string | null;
  activo: boolean;
};

type ProgramaPayload = {
  club_id: number;
  programa: string;
  anio: number | null;
  subvencion: number | null;
  fecha_limite: string | null;
};

type ProgramasSortKey = "anio" | "programa" | "subvencion" | "fecha_limite";
type SortDirection = "asc" | "desc";

const programasSortColumns: Record<ProgramasSortKey, string> = {
  anio: "anio",
  programa: "programa",
  subvencion: "subvencion",
  fecha_limite: "fecha_limite",
};

function parseOptionalYear(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function parseOptionalDate(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  return raw ? raw : null;
}

function formatMoney(value: number | null | undefined) {
  return value === null || value === undefined ? "-" : `${formatDecimal(value)} €`;
}

async function upsertPrograma(formData: FormData) {
  "use server";

  const clubId = Number(formData.get("club_id"));
  const id = String(formData.get("id_programa") ?? "").trim();

  if (!clubId || !Number.isFinite(clubId)) {
    redirect("/configuracion/programas?error=club_id%20invalido");
  }

  const programa = String(formData.get("programa") ?? "").trim();
  if (!programa) redirect("/configuracion/programas?error=Programa%20obligatorio");

  const payload: ProgramaPayload = {
    club_id: clubId,
    programa,
    anio: parseOptionalYear(formData.get("anio")),
    subvencion: parseDecimalToNumber(formData.get("subvencion")),
    fecha_limite: parseOptionalDate(formData.get("fecha_limite")),
  };

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const myRole = await getMyClubRole(clubId);
  if (!canEditClubData(myRole)) redirect("/no-autorizado");

  const { error } = id
    ? await supabase
        .from("programas")
        .update(payload)
        .eq("club_id", clubId)
        .eq("id_programa", Number(id))
    : await supabase.from("programas").insert(payload);

  if (error) redirect("/configuracion/programas?error=" + encodeURIComponent(error.message));
  redirect("/configuracion/programas");
}

async function darDeBajaPrograma(formData: FormData) {
  "use server";

  const clubId = Number(formData.get("club_id"));
  const id = Number(formData.get("id_programa"));

  if (!clubId || !Number.isFinite(clubId)) redirect("/configuracion/programas?error=club_id%20invalido");
  if (!id || !Number.isFinite(id)) redirect("/configuracion/programas?error=id_programa%20invalido");

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const myRole = await getMyClubRole(clubId);
  if (!canEditClubData(myRole)) redirect("/no-autorizado");

  const { error } = await supabase
    .from("programas")
    .update({ activo: false })
    .eq("club_id", clubId)
    .eq("id_programa", id);

  if (error) redirect("/configuracion/programas?error=" + encodeURIComponent(error.message));
  redirect("/configuracion/programas");
}

async function reactivarPrograma(formData: FormData) {
  "use server";

  const clubId = Number(formData.get("club_id"));
  const id = Number(formData.get("id_programa"));

  if (!clubId || !Number.isFinite(clubId)) redirect("/configuracion/programas?error=club_id%20invalido");
  if (!id || !Number.isFinite(id)) redirect("/configuracion/programas?error=id_programa%20invalido");

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const myRole = await getMyClubRole(clubId);
  if (!canEditClubData(myRole)) redirect("/no-autorizado");

  const { error } = await supabase
    .from("programas")
    .update({ activo: true })
    .eq("club_id", clubId)
    .eq("id_programa", id);

  if (error) redirect("/configuracion/programas?error=" + encodeURIComponent(error.message));
  redirect("/configuracion/programas?incluir_bajas=1");
}

async function deletePrograma(formData: FormData) {
  "use server";

  const clubId = Number(formData.get("club_id"));
  const id = Number(formData.get("id_programa"));

  if (!clubId || !Number.isFinite(clubId)) redirect("/configuracion/programas?error=club_id%20invalido");
  if (!id || !Number.isFinite(id)) redirect("/configuracion/programas?error=id_programa%20invalido");

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const myRole = await getMyClubRole(clubId);
  if (!canEditClubData(myRole)) redirect("/no-autorizado");

  const { error } = await supabase
    .from("programas")
    .delete()
    .eq("club_id", clubId)
    .eq("id_programa", id);

  if (error) redirect("/configuracion/programas?error=" + encodeURIComponent(error.message));
  redirect("/configuracion/programas");
}

export default async function ProgramasPage({
  searchParams,
}: {
  searchParams?: Promise<{
    anio?: string;
    programa?: string;
    panel?: string;
    edit?: string;
    error?: string;
    sort?: string;
    dir?: string;
    incluir_bajas?: string;
  }>;
}) {
  const sp = (await searchParams) ?? {};
  const errorMsg = sp.error ? decodeURIComponent(sp.error) : null;
  const editId = sp.edit ? Number(sp.edit) : null;
  const isNewPanel = sp.panel === "new";
  const anioFilter = String(sp.anio ?? "").trim();
  const programaFilter = String(sp.programa ?? "").trim();
  const incluirBajas = sp.incluir_bajas === "1";
  const sortKey = (["anio", "programa", "subvencion", "fecha_limite"].includes(
    String(sp.sort)
  )
    ? sp.sort
    : "anio") as ProgramasSortKey;
  const sortDirection: SortDirection = sp.dir === "asc" ? "asc" : "desc";

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const clubId = await getActiveClubId();
  if (!clubId) redirect("/clubs");

  const myRole = await getMyClubRole(clubId);
  const canUserEdit = canEditClubData(myRole);

  // Para el select de año usamos todos los programas (activos + baja) para no perder opciones de filtro
  const { data: programasForFilter } = await supabase
    .from("programas")
    .select("id_programa, programa, anio, subvencion, fecha_limite, activo")
    .eq("club_id", clubId)
    .order("anio", { ascending: false, nullsFirst: false })
    .order("programa", { ascending: true });

  let programasQuery = supabase
    .from("programas")
    .select("id_programa, programa, anio, subvencion, fecha_limite, activo")
    .eq("club_id", clubId)
    .order(programasSortColumns[sortKey], {
      ascending: sortDirection === "asc",
      nullsFirst: false,
    })
    .order("programa", { ascending: true });

  if (!incluirBajas) programasQuery = programasQuery.eq("activo", true);
  if (anioFilter) programasQuery = programasQuery.eq("anio", Number(anioFilter));
  if (programaFilter) programasQuery = programasQuery.ilike("programa", `%${programaFilter}%`);

  const { data, error } = await programasQuery.limit(1000);
  const rows = (data ?? []) as ProgramaRow[];

  const activosCount = rows.filter((r) => r.activo).length;
  const bajasCount = rows.filter((r) => !r.activo).length;

  function sortHref(nextSort: ProgramasSortKey) {
    return buildFilterHref(
      "/configuracion/programas",
      {
        anio: anioFilter,
        programa: programaFilter,
        sort: nextSort,
        dir: sortKey === nextSort && sortDirection === "asc" ? "desc" : "asc",
        incluir_bajas: incluirBajas ? "1" : null,
      },
      []
    );
  }

  function sortHeader(nextSort: ProgramasSortKey, label: string, width?: number) {
    const active = sortKey === nextSort;
    return (
      <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8, whiteSpace: "nowrap", width }}>
        <Link href={sortHref(nextSort)} className="table-sort-button" aria-label={`Ordenar por ${label}`}>
          <span>{label}</span>
          <span aria-hidden="true">{active ? (sortDirection === "asc" ? "↑" : "↓") : "↕"}</span>
        </Link>
      </th>
    );
  }

  let editRow: ProgramaRow | null =
    editId !== null ? rows.find((row) => Number(row.id_programa) === editId) ?? null : null;

  if (editId && !editRow) {
    const { data: one } = await supabase
      .from("programas")
      .select("id_programa, programa, anio, subvencion, fecha_limite, activo")
      .eq("club_id", clubId)
      .eq("id_programa", editId)
      .maybeSingle();
    editRow = (one as ProgramaRow | null) ?? null;
  }

  const isDrawerOpen = canUserEdit && (isNewPanel || !!editRow);
  const listHref = buildFilterHref(
    "/configuracion/programas",
    { anio: anioFilter, programa: programaFilter, sort: sortKey, dir: sortDirection, incluir_bajas: incluirBajas ? "1" : null },
    []
  );

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 16 }}>
      <div className="page-toolbar">
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Programas</h1>
        <div className="page-toolbar-actions">
          {canUserEdit ? (
            <Link
              href={buildFilterHref("/configuracion/programas", { anio: anioFilter, programa: programaFilter, sort: sortKey, dir: sortDirection, panel: "new", incluir_bajas: incluirBajas ? "1" : null }, [])}
              className="icon-button tooltip-button"
              aria-label="Nuevo programa"
            >
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

      <AutoSubmitFilters action="/configuracion/programas">
        <input type="hidden" name="sort" value={sortKey} />
        <input type="hidden" name="dir" value={sortDirection} />

        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap", margin: "12px 0 16px" }}>
          <label className="filter-field">
            <span>Año</span>
            <div className="filter-control-row">
              <select name="anio" defaultValue={anioFilter}>
                <option value="">Todos</option>
                {Array.from(
                  new Set((programasForFilter ?? []).map((p: any) => p.anio).filter(Boolean))
                ).map((anio) => (
                  <option key={String(anio)} value={String(anio)}>{String(anio)}</option>
                ))}
              </select>
              <Link
                href={buildFilterHref("/configuracion/programas", { programa: programaFilter, sort: sortKey, dir: sortDirection, incluir_bajas: incluirBajas ? "1" : null }, ["anio"])}
                className="filter-reset-button"
                aria-label="Limpiar año"
              >X</Link>
            </div>
          </label>

          <label className="filter-field" style={{ flex: "1 1 180px" }}>
            <span>Programa</span>
            <div className="filter-control-row">
              <input
                type="search"
                name="programa"
                placeholder="Buscar programa"
                defaultValue={programaFilter}
              />
              <Link
                href={buildFilterHref("/configuracion/programas", { anio: anioFilter, sort: sortKey, dir: sortDirection, incluir_bajas: incluirBajas ? "1" : null }, ["programa"])}
                className="filter-reset-button"
                aria-label="Limpiar programa"
              >X</Link>
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

      {isDrawerOpen ? (
        <>
          <Link href={listHref} className="drawer-backdrop" aria-label="Cerrar panel" />
          <div id="form" className="side-drawer">
            <div className="side-drawer-header">
              <div className="side-drawer-title">
                <span>Programas</span>
                <h2>{editRow ? `Editar programa` : "Nuevo programa"}</h2>
                {editRow && !editRow.activo && (
                  <span style={{ color: "#b93a48", fontSize: 12, fontWeight: 750 }}>● DADO DE BAJA</span>
                )}
              </div>
              <Link href={listHref} className="icon-button icon-button-secondary tooltip-button" aria-label="Cerrar">×</Link>
            </div>

            <form
              id="programa-form"
              key={editRow ? `edit-${editRow.id_programa}` : "new"}
              action={upsertPrograma}
              className="side-drawer-body"
            >
              <input type="hidden" name="club_id" value={clubId} />
              <input type="hidden" name="id_programa" value={editRow?.id_programa ?? ""} />

              <label>
                Año
                <input name="anio" type="number" defaultValue={editRow?.anio ?? ""} style={{ width: "100%" }} />
              </label>

              <label>
                Programa
                <input name="programa" required defaultValue={editRow?.programa ?? ""} style={{ width: "100%" }} />
              </label>

              <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
                <label>
                  Subvención
                  <input name="subvencion" inputMode="decimal" defaultValue={toDecimalInputValue(editRow?.subvencion)} style={{ width: "100%" }} />
                </label>
                <label>
                  Fecha límite
                  <input name="fecha_limite" type="date" defaultValue={toDateInputValue(editRow?.fecha_limite)} style={{ width: "100%" }} />
                </label>
              </div>
            </form>

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
                  form="programa-form"
                  className="icon-button tooltip-button"
                  aria-label={editRow ? "Guardar cambios" : "Crear programa"}
                >
                  <Icon name="save" />
                </button>

                <div style={{ flex: 1 }} />

                {/* Dar de baja / Reactivar */}
                {editRow && (
                  editRow.activo ? (
                    <form action={darDeBajaPrograma}>
                      <input type="hidden" name="club_id" value={clubId} />
                      <input type="hidden" name="id_programa" value={editRow.id_programa} />
                      <ConfirmSubmitButton
                        message="¿Dar de baja este programa? Sus asientos y movimientos bancarios dejarán de cargar en contabilidad y banco. El programa se conserva y puede reactivarse."
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "0 14px", height: 36, borderRadius: 6, border: "1px solid #f0c070", background: "#fffbea", color: "#92580a", fontSize: 13, fontWeight: 700, cursor: "pointer", minHeight: 36 }}
                      >
                        Dar de baja
                      </ConfirmSubmitButton>
                    </form>
                  ) : (
                    <form action={reactivarPrograma}>
                      <input type="hidden" name="club_id" value={clubId} />
                      <input type="hidden" name="id_programa" value={editRow.id_programa} />
                      <button type="submit" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "0 14px", height: 36, borderRadius: 6, border: "1px solid #a7d9b0", background: "#f0faf2", color: "#1a6b2e", fontSize: 13, fontWeight: 700, cursor: "pointer", minHeight: 36 }}>
                        Reactivar programa
                      </button>
                    </form>
                  )
                )}

                {/* Eliminar */}
                {editRow && (
                  <form action={deletePrograma}>
                    <input type="hidden" name="club_id" value={clubId} />
                    <input type="hidden" name="id_programa" value={editRow.id_programa} />
                    <ConfirmSubmitButton
                      message="¿Eliminar definitivamente este programa? Si está usado en contabilidad, dará error."
                      className="icon-button icon-button-danger tooltip-button"
                      ariaLabel="Eliminar programa definitivamente"
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

      <h2 style={{ fontSize: 16, marginTop: 16, marginBottom: 8 }}>
        Listado ({activosCount}{incluirBajas && bajasCount > 0 ? ` + ${bajasCount} de baja` : ""})
      </h2>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              {sortHeader("anio", "Año", 90)}
              {sortHeader("programa", "Programa")}
              {sortHeader("subvencion", "Subvención", 140)}
              {sortHeader("fecha_limite", "Fecha límite", 150)}
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8, whiteSpace: "nowrap", width: 110 }}>
                Acciones
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr key={row.id_programa} style={{ opacity: row.activo ? 1 : 0.55, background: row.activo ? undefined : "#fafafa" }}>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{row.anio ?? "-"}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  <div style={{ fontWeight: 700, textDecoration: row.activo ? undefined : "line-through" }}>
                    {row.programa ?? "-"}
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 2 }}>
                    <span style={{ opacity: 0.55, fontSize: 12 }}>id: {row.id_programa}</span>
                    {!row.activo && (
                      <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.04em", color: "#b93a48", background: "#fff0f1", border: "1px solid #f5c2c2", borderRadius: 4, padding: "1px 5px" }}>
                        BAJA
                      </span>
                    )}
                  </div>
                </td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{formatMoney(row.subvencion)}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{formatDateEs(row.fecha_limite)}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  {canUserEdit ? (
                    <div className="row-actions">
                      <Link
                        href={buildFilterHref("/configuracion/programas", { anio: anioFilter, programa: programaFilter, sort: sortKey, dir: sortDirection, edit: row.id_programa, incluir_bajas: incluirBajas ? "1" : null }, [])}
                        className="app-action-link"
                        style={{ gap: 6 }}
                        aria-label="Editar programa"
                      >
                        <Icon name="edit" className="button-icon" />
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
                <td colSpan={5} style={{ padding: 12, opacity: 0.8 }}>
                  {incluirBajas ? "No hay programas." : "No hay programas activos. Activa \"Mostrar dados de baja\" para verlos."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
