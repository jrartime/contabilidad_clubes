import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveClubId } from "@/lib/club";
import { canManageMembers, getMyClubRole } from "@/lib/clubRole";
import JuntaDirectivaTable from "./JuntaDirectivaTable";
import { AutoSubmitFilters } from "@/components/AutoSubmitFilters";
import { buildFilterHref } from "@/lib/filters";
import { Icon } from "@/components/Icon";
import { matchesGlobalSearch } from "@/lib/search";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function JuntaDirectivaPage({
  searchParams,
}: {
  searchParams?: Promise<{
    error?: string;
    panel?: string;
    incluir_bajas?: string;
    buscar?: string;
  }>;
}) {
  const sp = (await searchParams) ?? {};
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const clubId = await getActiveClubId();
  if (!clubId) redirect("/clubs");

  const role = await getMyClubRole(clubId);
  const canUserEdit = canManageMembers(role);
  const incluirBajas = sp.incluir_bajas === "1";
  const buscar = String(sp.buscar ?? "").trim();

  let query = supabase
    .from("junta_directiva")
    .select("id_cargo, persona_nombre, persona_dni, cargo, fecha_inicio, fecha_fin, observaciones, activo")
    .eq("club_id", clubId)
    .order("cargo", { ascending: true })
    .order("persona_nombre", { ascending: true });

  if (!incluirBajas) {
    query = query.eq("activo", true);
  }

  const { data, error } = await query;
  const rows = (data ?? []).filter((row) => matchesGlobalSearch(buscar, Object.values(row)));

  if (error) {
    return (
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Junta directiva</h1>
        <p>Error: {error.message}</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 16 }}>
      <div className="page-toolbar">
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Junta directiva</h1>
        <div className="page-toolbar-actions">
          {canUserEdit ? (
            <Link
              href={buildFilterHref("/configuracion/junta-directiva", { buscar, panel: "new", incluir_bajas: incluirBajas ? "1" : null }, [])}
              className="icon-button tooltip-button"
              aria-label="Nuevo cargo"
            >
              <Icon name="new" />
            </Link>
          ) : null}
        </div>
      </div>

      {sp.error ? (
        <div style={{ border: "1px solid #f5c2c2", background: "#fff5f5", padding: 10, borderRadius: 8, marginTop: 10 }}>
          <b>Error:</b> {sp.error}
        </div>
      ) : null}

      <AutoSubmitFilters action="/configuracion/junta-directiva">
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap", margin: "12px 0 16px" }}>
          <label className="filter-field" style={{ flex: "1 1 260px" }}>
            <span>Búsqueda</span>
            <div className="filter-control-row">
              <input type="search" name="buscar" placeholder="Buscar en todos los campos" defaultValue={buscar} />
              {buscar ? (
                <Link href={buildFilterHref("/configuracion/junta-directiva", { incluir_bajas: incluirBajas ? "1" : null }, ["buscar"])} className="filter-reset-button" aria-label="Limpiar búsqueda">X</Link>
              ) : null}
            </div>
          </label>

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
            Mostrar mandatos finalizados
          </label>
        </div>
      </AutoSubmitFilters>

      <JuntaDirectivaTable
        initialRows={rows ?? []}
        canEdit={canUserEdit}
        initialPanelMode={sp.panel === "new" ? "new" : null}
        incluirBajas={incluirBajas}
      />
    </div>
  );
}
