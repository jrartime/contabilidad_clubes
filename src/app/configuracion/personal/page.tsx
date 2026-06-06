import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveClubId } from "@/lib/club";
import { canEditClubData, getMyClubRole } from "@/lib/clubRole";
import PersonalTable from "./PersonalTable";
import { AutoSubmitFilters } from "@/components/AutoSubmitFilters";
import { buildFilterHref } from "@/lib/filters";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PersonalPage({
  searchParams,
}: {
  searchParams?: Promise<{
    error?: string;
    nombre?: string;
    panel?: string;
    incluir_bajas?: string;
  }>;
}) {
  const sp = (await searchParams) ?? {};
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const clubId = await getActiveClubId();
  if (!clubId) redirect("/clubs");

  const role = await getMyClubRole(clubId);
  const canUserEdit = canEditClubData(role);
  const nombreFilter = String(sp.nombre ?? "").trim();
  const incluirBajas = sp.incluir_bajas === "1";

  let personalQuery = supabase
    .from("personal")
    .select("id_personal, nombre, nif, tipo, observaciones, activo")
    .eq("club_id", clubId)
    .order("nombre", { ascending: true });

  // Por defecto solo activos; si se pide incluir bajas, traemos todos
  if (!incluirBajas) {
    personalQuery = personalQuery.eq("activo", true);
  }

  if (nombreFilter) personalQuery = personalQuery.ilike("nombre", `%${nombreFilter}%`);

  const { data: personal, error } = await personalQuery;

  if (error) {
    return (
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Personal</h1>
        <p>Error: {error.message}</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 16 }}>
      <div className="page-toolbar">
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Personal</h1>
        <div className="page-toolbar-actions">
          {canUserEdit ? (
            <Link
              href={buildFilterHref("/configuracion/personal", { nombre: nombreFilter, panel: "new", incluir_bajas: incluirBajas ? "1" : null }, [])}
              className="icon-button tooltip-button"
              aria-label="Nuevo personal"
            >
              <Icon name="new" />
            </Link>
          ) : null}
        </div>
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

      <AutoSubmitFilters action="/configuracion/personal">
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap", margin: "12px 0 16px" }}>
          <label className="filter-field" style={{ flex: "1 1 200px" }}>
            <span>Nombre</span>
            <div className="filter-control-row">
              <input
                type="search"
                name="nombre"
                placeholder="Buscar personal"
                defaultValue={nombreFilter}
              />
              <Link
                href={buildFilterHref("/configuracion/personal", { incluir_bajas: incluirBajas ? "1" : null }, ["nombre"])}
                className="filter-reset-button"
                aria-label="Limpiar nombre"
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

      <PersonalTable
        initialRows={personal ?? []}
        canEdit={canUserEdit}
        initialPanelMode={sp.panel === "new" ? "new" : null}
        incluirBajas={incluirBajas}
      />
    </div>
  );
}
