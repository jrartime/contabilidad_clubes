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
import { normalizeDecimalString } from "@/lib/decimal";
import { formatDateEs, formatDecimal, toDateInputValue, toDecimalInputValue } from "@/lib/format";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SubvencionRow = {
  id_subvencion: number;
  nombre: string;
  anio: number;
  administracion: string | null;
  convocatoria: string | null;
  ref_expediente: string | null;
  estado: string;
  importe_solicitado: number | null;
  importe_concedido: number | null;
  fecha_inicio_gasto: string | null;
  fecha_fin_gasto: string | null;
  fecha_limite_justificacion: string | null;
  created_at?: string | null;
};

type SubvencionPayload = {
  club_id: number;
  nombre: string;
  anio: number;
  administracion: string | null;
  convocatoria: string | null;
  ref_expediente: string | null;
  estado: string;
  importe_solicitado: number | null;
  importe_concedido: number | null;
  fecha_inicio_gasto: string | null;
  fecha_fin_gasto: string | null;
  fecha_limite_justificacion: string | null;
};

type ProgramaOption = {
  id_programa: number;
  programa: string;
  anio: number | null;
  activo: boolean;
};

type SubvencionesSortKey = "nombre" | "anio" | "administracion" | "estado" | "importe_concedido";
type SortDirection = "asc" | "desc";

const subvencionesSortColumns: Record<SubvencionesSortKey, string> = {
  nombre: "nombre",
  anio: "anio",
  administracion: "administracion",
  estado: "estado",
  importe_concedido: "importe_concedido",
};

const ESTADOS: { value: string; label: string }[] = [
  { value: "borrador", label: "Borrador" },
  { value: "solicitada", label: "Solicitada" },
  { value: "concedida", label: "Concedida" },
  { value: "denegada", label: "Denegada" },
  { value: "justificada", label: "Justificada" },
  { value: "cerrada", label: "Cerrada" },
];

const ESTADO_COLORS: Record<string, string> = {
  borrador: "#64748b",
  solicitada: "#0891b2",
  concedida: "#1a6b2e",
  denegada: "#b93a48",
  justificada: "#7c3aed",
  cerrada: "#374151",
};

function toText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function toNullableNumber(value: FormDataEntryValue | null): number | null {
  const normalized = normalizeDecimalString(value);
  if (!normalized) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function estadoLabel(estado: string) {
  return ESTADOS.find((e) => e.value === estado)?.label ?? estado;
}

async function upsertSubvencion(formData: FormData) {
  "use server";

  const clubId = Number(formData.get("club_id"));
  const id = String(formData.get("id_subvencion") ?? "").trim();

  if (!clubId || !Number.isFinite(clubId)) {
    redirect("/configuracion/subvenciones?error=club_id%20invalido");
  }

  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!nombre) redirect("/configuracion/subvenciones?error=El%20nombre%20es%20obligatorio");

  const anio = Number(formData.get("anio"));
  if (!Number.isFinite(anio)) redirect("/configuracion/subvenciones?error=El%20a%C3%B1o%20es%20obligatorio");

  const payload: SubvencionPayload = {
    club_id: clubId,
    nombre,
    anio,
    administracion: toText(formData.get("administracion")),
    convocatoria: toText(formData.get("convocatoria")),
    ref_expediente: toText(formData.get("ref_expediente")),
    estado: String(formData.get("estado") ?? "borrador").trim() || "borrador",
    importe_solicitado: toNullableNumber(formData.get("importe_solicitado")),
    importe_concedido: toNullableNumber(formData.get("importe_concedido")),
    fecha_inicio_gasto: toText(formData.get("fecha_inicio_gasto")),
    fecha_fin_gasto: toText(formData.get("fecha_fin_gasto")),
    fecha_limite_justificacion: toText(formData.get("fecha_limite_justificacion")),
  };

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const myRole = await getMyClubRole(clubId);
  if (!canEditClubData(myRole)) redirect("/no-autorizado");

  const { error } = id
    ? await supabase
        .from("subvenciones")
        .update(payload)
        .eq("club_id", clubId)
        .eq("id_subvencion", Number(id))
    : await supabase.from("subvenciones").insert(payload);

  const redirectTo = String(formData.get("redirect_to") ?? "").trim() || "/configuracion/subvenciones";
  if (error) redirect("/configuracion/subvenciones?error=" + encodeURIComponent(error.message));
  redirect(redirectTo);
}

async function deleteSubvencion(formData: FormData) {
  "use server";

  const clubId = Number(formData.get("club_id"));
  const id = Number(formData.get("id_subvencion"));

  if (!clubId || !Number.isFinite(clubId)) {
    redirect("/configuracion/subvenciones?error=club_id%20invalido");
  }
  if (!id || !Number.isFinite(id)) {
    redirect("/configuracion/subvenciones?error=id_subvencion%20invalido");
  }

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const myRole = await getMyClubRole(clubId);
  if (!canEditClubData(myRole)) redirect("/no-autorizado");

  const { error } = await supabase
    .from("subvenciones")
    .delete()
    .eq("club_id", clubId)
    .eq("id_subvencion", id);

  const redirectToDelete = String(formData.get("redirect_to") ?? "").trim() || "/configuracion/subvenciones";
  if (error) {
    const message =
      error.code === "23503"
        ? "No se puede eliminar: hay presupuestos vinculados a esta subvención."
        : error.message;
    redirect("/configuracion/subvenciones?error=" + encodeURIComponent(message));
  }
  redirect(redirectToDelete);
}

async function updateSubvencionProgramas(formData: FormData) {
  "use server";

  const clubId = Number(formData.get("club_id"));
  const subvencionId = Number(formData.get("id_subvencion"));

  if (!clubId || !Number.isFinite(clubId)) redirect("/configuracion/subvenciones?error=club_id%20invalido");
  if (!subvencionId || !Number.isFinite(subvencionId)) {
    redirect("/configuracion/subvenciones?error=id_subvencion%20invalido");
  }

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const myRole = await getMyClubRole(clubId);
  if (!canEditClubData(myRole)) redirect("/no-autorizado");

  const redirectTo = String(formData.get("redirect_to") ?? "").trim() || "/configuracion/subvenciones";

  const selectedIds = Array.from(new Set(formData.getAll("programa_id")))
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n));

  const { error: deleteError } = await supabase
    .from("subvencion_programas")
    .delete()
    .eq("club_id", clubId)
    .eq("subvencion_id", subvencionId);

  if (deleteError) {
    redirect("/configuracion/subvenciones?error=" + encodeURIComponent(deleteError.message));
  }

  if (selectedIds.length > 0) {
    const payload = selectedIds.map((programaId) => ({
      club_id: clubId,
      subvencion_id: subvencionId,
      programa_id: programaId,
      presupuesto_previsto: toNullableNumber(formData.get(`presupuesto_previsto_${programaId}`)),
    }));

    const { error: insertError } = await supabase.from("subvencion_programas").insert(payload);
    if (insertError) {
      redirect("/configuracion/subvenciones?error=" + encodeURIComponent(insertError.message));
    }
  }

  redirect(redirectTo);
}

export default async function SubvencionesPage({
  searchParams,
}: {
  searchParams?: Promise<{
    error?: string;
    edit?: string;
    panel?: string;
    anio?: string;
    estado?: string;
    sort?: string;
    dir?: string;
    buscar?: string;
  }>;
}) {
  const sp = (await searchParams) ?? {};
  const errorMsg = sp.error ? decodeURIComponent(sp.error) : null;
  const editId = sp.edit ? Number(sp.edit) : null;
  const isNewPanel = sp.panel === "new";
  const anioFilter = String(sp.anio ?? "").trim();
  const estadoFilter = String(sp.estado ?? "").trim();
  const buscar = String(sp.buscar ?? "").trim();
  const sortKey = (["nombre", "anio", "administracion", "estado", "importe_concedido"].includes(
    String(sp.sort)
  )
    ? sp.sort
    : "anio") as SubvencionesSortKey;
  const sortDirection: SortDirection = sp.dir === "asc" ? "asc" : "desc";
  const filterParams = {
    buscar,
    anio: anioFilter,
    estado: estadoFilter,
    sort: sortKey !== "anio" ? sortKey : null,
    dir: sortDirection !== "desc" ? sortDirection : null,
  };
  const listHref = buildFilterHref("/configuracion/subvenciones", filterParams, []);

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const clubId = await getActiveClubId();
  if (!clubId) redirect("/clubs");

  const myRole = await getMyClubRole(clubId);
  const canUserEdit = canEditClubData(myRole);

  let subvencionesQuery = supabase
    .from("subvenciones")
    .select(
      "id_subvencion, nombre, anio, administracion, convocatoria, ref_expediente, estado, importe_solicitado, importe_concedido, fecha_inicio_gasto, fecha_fin_gasto, fecha_limite_justificacion, created_at"
    )
    .eq("club_id", clubId)
    .order(subvencionesSortColumns[sortKey], {
      ascending: sortDirection === "asc",
      nullsFirst: false,
    });

  if (anioFilter) subvencionesQuery = subvencionesQuery.eq("anio", Number(anioFilter));
  if (estadoFilter) subvencionesQuery = subvencionesQuery.eq("estado", estadoFilter);

  const { data, error } = await subvencionesQuery.limit(1000);

  const rows = ((data ?? []) as SubvencionRow[]).filter((row) => matchesGlobalSearch(buscar, Object.values(row)));

  function sortHref(nextSort: SubvencionesSortKey) {
    return buildFilterHref(
      "/configuracion/subvenciones",
      {
        buscar,
        anio: anioFilter,
        estado: estadoFilter,
        sort: nextSort,
        dir: sortKey === nextSort && sortDirection === "desc" ? "asc" : "desc",
      },
      []
    );
  }

  function sortHeader(nextSort: SubvencionesSortKey, label: string) {
    const active = sortKey === nextSort;
    return (
      <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8, whiteSpace: "nowrap" }}>
        <Link href={sortHref(nextSort)} className="table-sort-button" aria-label={`Ordenar por ${label}`}>
          <span>{label}</span>
          <span aria-hidden="true">{active ? (sortDirection === "asc" ? "↑" : "↓") : "↕"}</span>
        </Link>
      </th>
    );
  }

  let editRow: SubvencionRow | null =
    editId !== null ? rows.find((row) => Number(row.id_subvencion) === editId) ?? null : null;

  if (editId && !editRow) {
    const { data: one } = await supabase
      .from("subvenciones")
      .select(
        "id_subvencion, nombre, anio, administracion, convocatoria, ref_expediente, estado, importe_solicitado, importe_concedido, fecha_inicio_gasto, fecha_fin_gasto, fecha_limite_justificacion, created_at"
      )
      .eq("club_id", clubId)
      .eq("id_subvencion", editId)
      .maybeSingle();

    editRow = (one as SubvencionRow | null) ?? null;
  }

  const isDrawerOpen = canUserEdit && (isNewPanel || !!editRow);

  const { data: programasData } = isDrawerOpen
    ? await supabase
        .from("programas")
        .select("id_programa, programa, anio, activo")
        .eq("club_id", clubId)
        .order("anio", { ascending: false })
        .order("programa", { ascending: true })
    : { data: null };
  const programasClub = (programasData ?? []) as ProgramaOption[];

  const linkedProgramas = new Map<number, number | null>();
  if (editRow) {
    const { data: links } = await supabase
      .from("subvencion_programas")
      .select("programa_id, presupuesto_previsto")
      .eq("club_id", clubId)
      .eq("subvencion_id", editRow.id_subvencion);
    for (const link of (links ?? []) as { programa_id: number; presupuesto_previsto: number | null }[]) {
      linkedProgramas.set(link.programa_id, link.presupuesto_previsto);
    }
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 16 }}>
      <div className="page-toolbar">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>Subvenciones</h1>
        </div>

        <div className="page-toolbar-actions">
          {canUserEdit ? (
            <Link
              href="/configuracion/subvenciones?panel=new#form"
              className="icon-button tooltip-button"
              aria-label="Nueva subvención"
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

      {/* Filtros */}
      <AutoSubmitFilters action="/configuracion/subvenciones" className="filters-grid">
        <label className="filter-field">
          <span>Búsqueda</span>
          <div className="filter-control-row">
            <input type="search" name="buscar" defaultValue={buscar} placeholder="Buscar en todos los campos" />
            {buscar ? (
              <Link href={buildFilterHref("/configuracion/subvenciones", { anio: anioFilter, estado: estadoFilter }, ["buscar"])} className="filter-reset-button" aria-label="Limpiar búsqueda">X</Link>
            ) : null}
          </div>
        </label>
        <label className="filter-field">
          <span>Año</span>
          <input type="number" name="anio" min={2000} max={2200} defaultValue={anioFilter} placeholder="Todos" />
        </label>
        <label className="filter-field">
          <span>Estado</span>
          <select name="estado" defaultValue={estadoFilter}>
            <option value="">Todos</option>
            {ESTADOS.map((e) => (
              <option key={e.value} value={e.value}>{e.label}</option>
            ))}
          </select>
        </label>
      </AutoSubmitFilters>

      {/* Panel lateral edición */}
      {isDrawerOpen ? (
        <>
          <Link href={listHref} className="drawer-backdrop" aria-label="Cerrar panel" />
          <div id="form" className="side-drawer">
            <div className="side-drawer-header">
              <div className="side-drawer-title">
                <span>Subvenciones</span>
                <h2>{editRow ? "Editar subvención" : "Nueva subvención"}</h2>
              </div>
              <Link href={listHref} className="icon-button icon-button-secondary tooltip-button" aria-label="Cerrar">
                <Icon name="logout" />
              </Link>
            </div>

            {!canUserEdit ? (
              <p style={{ margin: 0, opacity: 0.8 }}>No tienes permisos para crear/editar subvenciones.</p>
            ) : (
              <form
                id="subvencion-form"
                key={editRow ? `edit-${editRow.id_subvencion}` : "new"}
                action={upsertSubvencion}
                className="side-drawer-body"
              >
                <input type="hidden" name="club_id" value={clubId} />
                <input type="hidden" name="id_subvencion" value={editRow?.id_subvencion ?? ""} />
                <input type="hidden" name="redirect_to" value={listHref} />

                <label>
                  Nombre *
                  <input name="nombre" required defaultValue={editRow?.nombre ?? ""} style={{ width: "100%" }} />
                </label>

                <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
                  <label>
                    Año *
                    <input name="anio" type="number" min={2000} max={2200} required defaultValue={editRow?.anio ?? ""} style={{ width: "100%" }} />
                  </label>
                  <label>
                    Estado
                    <select name="estado" defaultValue={editRow?.estado ?? "borrador"} style={{ width: "100%" }}>
                      {ESTADOS.map((e) => (
                        <option key={e.value} value={e.value}>{e.label}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
                  <label>
                    Administración
                    <input name="administracion" defaultValue={editRow?.administracion ?? ""} style={{ width: "100%" }} />
                  </label>
                  <label>
                    Convocatoria
                    <input name="convocatoria" defaultValue={editRow?.convocatoria ?? ""} style={{ width: "100%" }} />
                  </label>
                </div>

                <label>
                  Nº de expediente
                  <input name="ref_expediente" defaultValue={editRow?.ref_expediente ?? ""} style={{ width: "100%" }} />
                </label>

                <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
                  <label>
                    Importe solicitado
                    <input
                      name="importe_solicitado"
                      type="text"
                      inputMode="decimal"
                      defaultValue={toDecimalInputValue(editRow?.importe_solicitado ?? "")}
                      style={{ width: "100%" }}
                    />
                  </label>
                  <label>
                    Importe concedido
                    <input
                      name="importe_concedido"
                      type="text"
                      inputMode="decimal"
                      defaultValue={toDecimalInputValue(editRow?.importe_concedido ?? "")}
                      style={{ width: "100%" }}
                    />
                  </label>
                </div>

                <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
                  <label>
                    Inicio del gasto subvencionable
                    <input name="fecha_inicio_gasto" type="date" defaultValue={toDateInputValue(editRow?.fecha_inicio_gasto)} style={{ width: "100%" }} />
                  </label>
                  <label>
                    Fin del gasto subvencionable
                    <input name="fecha_fin_gasto" type="date" defaultValue={toDateInputValue(editRow?.fecha_fin_gasto)} style={{ width: "100%" }} />
                  </label>
                </div>

                <label>
                  Fecha límite de justificación
                  <input name="fecha_limite_justificacion" type="date" defaultValue={toDateInputValue(editRow?.fecha_limite_justificacion)} style={{ width: "100%" }} />
                </label>
              </form>
            )}

            {canUserEdit && !editRow && (
              <p style={{ borderTop: "1px solid #eee", paddingTop: 12, marginTop: 12, fontSize: 12, opacity: 0.7 }}>
                Guarda la subvención primero para poder vincular programas.
              </p>
            )}

            {canUserEdit && editRow && (
              <div style={{ borderTop: "1px solid #eee", paddingTop: 12, marginTop: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Programas vinculados</div>
                <p style={{ margin: "0 0 8px", fontSize: 12, opacity: 0.7 }}>
                  Marca los programas que cubre esta subvención. Un presupuesto ligado a ella solo podrá incluir programas de esta lista.
                </p>
                <form
                  id="subvencion-programas-form"
                  key={`programas-${editRow.id_subvencion}`}
                  action={updateSubvencionProgramas}
                >
                  <input type="hidden" name="club_id" value={clubId} />
                  <input type="hidden" name="id_subvencion" value={editRow.id_subvencion} />
                  <input type="hidden" name="redirect_to" value={`/configuracion/subvenciones?edit=${editRow.id_subvencion}#form`} />

                  {programasClub.length === 0 ? (
                    <p style={{ margin: 0, fontSize: 13, opacity: 0.7 }}>Este club no tiene programas creados todavía.</p>
                  ) : (
                    <div style={{ display: "grid", gap: 6, maxHeight: 260, overflowY: "auto", paddingRight: 4 }}>
                      {programasClub.map((p) => {
                        const linked = linkedProgramas.has(p.id_programa);
                        return (
                          <label key={p.id_programa} style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 400 }}>
                            <input type="checkbox" name="programa_id" value={p.id_programa} defaultChecked={linked} />
                            <span style={{ flex: 1, fontSize: 13, opacity: p.activo ? 1 : 0.6 }}>
                              {p.anio ? `[${p.anio}] ` : ""}
                              {p.programa}
                              {!p.activo ? " (baja)" : ""}
                            </span>
                            <input
                              name={`presupuesto_previsto_${p.id_programa}`}
                              type="text"
                              inputMode="decimal"
                              placeholder="Previsto"
                              defaultValue={toDecimalInputValue(linkedProgramas.get(p.id_programa) ?? "")}
                              style={{ width: 110 }}
                            />
                          </label>
                        );
                      })}
                    </div>
                  )}

                  <button
                    type="submit"
                    style={{ marginTop: 10, padding: "6px 14px", height: 32, borderRadius: 6, border: "1px solid #cfd7e6", background: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                  >
                    Guardar programas vinculados
                  </button>
                </form>
              </div>
            )}

            {canUserEdit && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 14, borderTop: "1px solid var(--border)", flexWrap: "wrap" }}>
                <button
                  type="submit"
                  form="subvencion-form"
                  className="icon-button tooltip-button"
                  aria-label={editRow ? "Guardar cambios" : "Crear subvención"}
                >
                  <Icon name="save" />
                </button>

                <div style={{ flex: 1 }} />

                {editRow && (
                  <form action={deleteSubvencion}>
                    <input type="hidden" name="club_id" value={clubId} />
                    <input type="hidden" name="id_subvencion" value={editRow.id_subvencion} />
                    <input type="hidden" name="redirect_to" value={listHref} />
                    <ConfirmSubmitButton
                      message="¿Eliminar definitivamente esta subvención? Si tiene presupuestos vinculados, dará error. Los vínculos con programas y el checklist de justificación asociados se eliminarán."
                      className="icon-button icon-button-danger tooltip-button"
                      ariaLabel="Eliminar subvención definitivamente"
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
      <h2 style={{ fontSize: 16, marginTop: 16, marginBottom: 8 }}>Listado ({rows.length})</h2>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              {sortHeader("nombre", "Nombre")}
              {sortHeader("anio", "Año")}
              {sortHeader("administracion", "Administración")}
              {sortHeader("estado", "Estado")}
              {sortHeader("importe_concedido", "Importe concedido")}
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Fecha límite justif.</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => {
              const color = ESTADO_COLORS[row.estado] ?? "#64748b";
              return (
                <tr key={row.id_subvencion}>
                  <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                    <div style={{ fontWeight: 700 }}>{row.nombre}</div>
                    <div style={{ opacity: 0.55, fontSize: 12 }}>id: {row.id_subvencion}</div>
                  </td>
                  <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{row.anio}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{row.administracion ?? "-"}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 10px",
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 700,
                        background: color,
                        color: "#fff",
                      }}
                    >
                      {estadoLabel(row.estado)}
                    </span>
                  </td>
                  <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{formatDecimal(row.importe_concedido)} €</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{formatDateEs(row.fecha_limite_justificacion)}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                    {canUserEdit ? (
                      <div className="row-actions">
                        <Link
                          href={`/configuracion/subvenciones?edit=${row.id_subvencion}#form`}
                          className="app-action-link"
                          style={{ gap: 6 }}
                          aria-label="Editar subvención"
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
              );
            })}

            {rows.length === 0 && !error && (
              <tr>
                <td colSpan={7} style={{ padding: 12, opacity: 0.8 }}>
                  No hay subvenciones.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
