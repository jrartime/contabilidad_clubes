import Link from "next/link";
import { redirect } from "next/navigation";
import { Icon } from "@/components/Icon";
import { getActiveClubId } from "@/lib/club";
import { getMyClubRole } from "@/lib/clubRole";
import { normalizeDecimalString } from "@/lib/decimal";
import { buildFilterHref } from "@/lib/filters";
import { formatDecimal } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PresupuestoRow = Pick<
  Database["public"]["Tables"]["presupuestos"]["Row"],
  "id_presupuesto" | "nombre" | "tipo_programa" | "subvencion_id" | "anio_inicio" | "anio_fin"
>;
type PartidaRow = Pick<
  Database["public"]["Tables"]["presupuesto_partidas"]["Row"],
  "presupuesto_id" | "importe_presupuestado" | "naturaleza_snapshot"
>;

const TIPO_LABELS: Record<string, string> = {
  clubes: "Clubes deportivos",
  eventos: "Eventos y competiciones",
  eedd_ctd_discapacidad: "EEDD / CTD",
};

/** Convierte un numeric(14,2) a céntimos enteros para sumar sin error binario. */
function decimalToCents(value: unknown) {
  const normalized = normalizeDecimalString(value || 0);
  const negative = normalized.startsWith("-");
  const unsigned = negative ? normalized.slice(1) : normalized;
  const [integer = "0", decimals = ""] = unsigned.split(".");
  const cents =
    BigInt(integer || "0") * BigInt(100) + BigInt(decimals.padEnd(2, "0").slice(0, 2) || "0");
  return negative ? -cents : cents;
}

function formatCents(value: bigint) {
  return `${formatDecimal(Number(value) / 100)} €`;
}

type Totales = { ingresos: bigint; gastos: bigint };

function emptyTotales(): Totales {
  return { ingresos: BigInt(0), gastos: BigInt(0) };
}

function addPartida(totales: Totales, partida: PartidaRow) {
  const cents = decimalToCents(partida.importe_presupuestado);
  if (partida.naturaleza_snapshot === "ingreso") totales.ingresos += cents;
  else if (partida.naturaleza_snapshot === "gasto") totales.gastos += cents;
}

export default async function PresupuestoAnualPage({
  searchParams,
}: {
  searchParams?: Promise<{ anio?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const anio = /^\d{4}$/.test(String(sp.anio ?? "")) ? Number(sp.anio) : new Date().getFullYear();

  const supabase = await createSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) redirect("/login");

  const clubId = await getActiveClubId();
  if (!clubId) redirect("/clubs");
  await getMyClubRole(clubId);

  const { data: presupuestosData, error: presupuestosError } = await supabase
    .from("presupuestos")
    .select("id_presupuesto, nombre, tipo_programa, subvencion_id, anio_inicio, anio_fin")
    .eq("club_id", clubId)
    .eq("estado", "cerrado")
    .lte("anio_inicio", anio)
    .gte("anio_fin", anio)
    .order("nombre", { ascending: true });

  const presupuestos = (presupuestosData ?? []) as PresupuestoRow[];
  const presupuestoIds = presupuestos.map((p) => p.id_presupuesto);

  let partidas: PartidaRow[] = [];
  let partidasError: string | null = presupuestosError?.message ?? null;

  if (presupuestoIds.length && !partidasError) {
    const pageSize = 1000;
    let offset = 0;
    let hasMore = true;
    while (hasMore) {
      const { data, error } = await supabase
        .from("presupuesto_partidas")
        .select("presupuesto_id, importe_presupuestado, naturaleza_snapshot")
        .in("presupuesto_id", presupuestoIds)
        .range(offset, offset + pageSize - 1);

      if (error) {
        partidasError = error.message;
        break;
      }

      partidas = partidas.concat((data ?? []) as PartidaRow[]);
      hasMore = (data?.length ?? 0) === pageSize;
      offset += pageSize;
    }
  }

  const subvencionIds = [...new Set(presupuestos.map((p) => p.subvencion_id).filter((id): id is number => id !== null))];
  let subvencionNames = new Map<number, string>();
  if (subvencionIds.length) {
    const { data: subvencionesData } = await supabase
      .from("subvenciones")
      .select("id_subvencion, nombre")
      .eq("club_id", clubId)
      .in("id_subvencion", subvencionIds);
    subvencionNames = new Map((subvencionesData ?? []).map((s) => [s.id_subvencion, s.nombre]));
  }

  const partidasPorPresupuesto = new Map<number, PartidaRow[]>();
  for (const partida of partidas) {
    const list = partidasPorPresupuesto.get(partida.presupuesto_id) ?? [];
    list.push(partida);
    partidasPorPresupuesto.set(partida.presupuesto_id, list);
  }

  const totalGeneral = emptyTotales();
  const porTipo = new Map<string, Totales>();
  const conSubvencion = emptyTotales();
  const sinSubvencion = emptyTotales();

  const filas = presupuestos.map((presupuesto) => {
    const propias = partidasPorPresupuesto.get(presupuesto.id_presupuesto) ?? [];
    const totales = emptyTotales();
    for (const partida of propias) {
      addPartida(totales, partida);
      addPartida(totalGeneral, partida);

      const tipoTotales = porTipo.get(presupuesto.tipo_programa) ?? emptyTotales();
      addPartida(tipoTotales, partida);
      porTipo.set(presupuesto.tipo_programa, tipoTotales);

      addPartida(presupuesto.subvencion_id !== null ? conSubvencion : sinSubvencion, partida);
    }
    return {
      ...presupuesto,
      totales,
      subvencionNombre: presupuesto.subvencion_id !== null ? subvencionNames.get(presupuesto.subvencion_id) ?? "—" : null,
    };
  });

  const diferenciaGeneral = totalGeneral.ingresos - totalGeneral.gastos;
  const yearHref = (nextYear: number) => buildFilterHref("/presupuestos/anual", { anio: String(nextYear) });

  return (
    <div className="presupuesto-anual-page">
      <div className="page-toolbar">
        <div>
          <h1>Presupuesto general anual</h1>
          <p>Consolidado de todos los presupuestos cerrados del año, con y sin subvención.</p>
        </div>
        <Link href="/presupuestos" className="app-action-link" aria-label="Volver a presupuestos">
          <Icon name="enter" />
          <span>Volver a presupuestos</span>
        </Link>
      </div>

      <div className="anual-year-filter">
        <Link href={yearHref(anio - 1)} className="icon-button icon-button-secondary" aria-label="Año anterior">‹</Link>
        <span className="anual-year-label">{anio}</span>
        <Link href={yearHref(anio + 1)} className="icon-button icon-button-secondary" aria-label="Año siguiente">›</Link>
      </div>

      {presupuestosError ? <div className="presupuesto-error">Error al cargar presupuestos: {presupuestosError.message}</div> : null}
      {partidasError ? <div className="presupuesto-error">Error al cargar partidas: {partidasError}</div> : null}

      {!presupuestos.length && !presupuestosError ? (
        <div className="anual-empty">No hay presupuestos cerrados en {anio}.</div>
      ) : (
        <>
          <div className="anual-summary-grid">
            <div className="anual-card">
              <span>Total ingresos</span>
              <strong>{formatCents(totalGeneral.ingresos)}</strong>
            </div>
            <div className="anual-card">
              <span>Total gastos</span>
              <strong>{formatCents(totalGeneral.gastos)}</strong>
            </div>
            <div className={`anual-card ${diferenciaGeneral !== BigInt(0) ? "anual-card-warning" : ""}`}>
              <span>Diferencia</span>
              <strong>{formatCents(diferenciaGeneral)}</strong>
            </div>
            <div className="anual-card">
              <span>Presupuestos incluidos</span>
              <strong>{presupuestos.length}</strong>
            </div>
          </div>

          <h2>Por tipo de programa</h2>
          <div className="anual-table-wrap">
            <table>
              <thead><tr><th>Tipo</th><th>Ingresos</th><th>Gastos</th></tr></thead>
              <tbody>
                {[...porTipo.entries()].map(([tipo, totales]) => (
                  <tr key={tipo}>
                    <td>{TIPO_LABELS[tipo] ?? tipo}</td>
                    <td>{formatCents(totales.ingresos)}</td>
                    <td>{formatCents(totales.gastos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2>Con subvención vs. presupuesto propio</h2>
          <div className="anual-table-wrap">
            <table>
              <thead><tr><th>Origen</th><th>Ingresos</th><th>Gastos</th></tr></thead>
              <tbody>
                <tr>
                  <td>Con subvención</td>
                  <td>{formatCents(conSubvencion.ingresos)}</td>
                  <td>{formatCents(conSubvencion.gastos)}</td>
                </tr>
                <tr>
                  <td>Presupuesto propio</td>
                  <td>{formatCents(sinSubvencion.ingresos)}</td>
                  <td>{formatCents(sinSubvencion.gastos)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2>Presupuestos incluidos ({filas.length})</h2>
          <div className="anual-table-wrap">
            <table>
              <thead><tr><th>Nombre</th><th>Tipo</th><th>Subvención</th><th>Ingresos</th><th>Gastos</th><th><span className="sr-only">Acciones</span></th></tr></thead>
              <tbody>
                {filas.map((fila) => (
                  <tr key={fila.id_presupuesto}>
                    <td><strong>{fila.nombre}</strong></td>
                    <td>{TIPO_LABELS[fila.tipo_programa] ?? fila.tipo_programa}</td>
                    <td>{fila.subvencionNombre ?? "Presupuesto interno"}</td>
                    <td>{formatCents(fila.totales.ingresos)}</td>
                    <td>{formatCents(fila.totales.gastos)}</td>
                    <td>
                      <Link href={`/presupuestos?edit=${fila.id_presupuesto}`} className="icon-button icon-button-secondary tooltip-button" aria-label="Ver presupuesto">
                        <Icon name="enter" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <style>{`
        .presupuesto-anual-page { max-width: 1100px; margin: 0 auto; padding: 16px; }
        .presupuesto-anual-page h1 { margin: 0; font-size: 22px; font-weight: 800; }
        .presupuesto-anual-page .page-toolbar p { margin: 4px 0 0; color: var(--muted); font-size: 13px; }
        .presupuesto-anual-page h2 { font-size: 15px; margin: 20px 0 8px; }
        .anual-year-filter { display: flex; align-items: center; gap: 10px; margin: 16px 0; }
        .anual-year-label { font-size: 16px; font-weight: 750; min-width: 50px; text-align: center; }
        .anual-empty { padding: 24px; text-align: center; color: var(--muted); border: 1px dashed var(--border-strong); border-radius: 10px; }
        .presupuesto-error { margin-bottom: 12px; padding: 10px; border-radius: 8px; font-size: 13px; border: 1px solid #f5c2c2; background: #fff5f5; }
        .anual-summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 8px; }
        .anual-card { border: 1px solid var(--border); border-radius: 8px; padding: 10px; display: grid; gap: 4px; }
        .anual-card span { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: .03em; }
        .anual-card strong { font-size: 16px; }
        .anual-card-warning strong { color: #a12f3c; }
        .anual-table-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: 10px; background: #fff; margin-bottom: 4px; }
        .anual-table-wrap table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .anual-table-wrap th, .anual-table-wrap td { padding: 9px 10px; border-bottom: 1px solid var(--border); text-align: left; }
        .anual-table-wrap th:not(:first-child), .anual-table-wrap td:not(:first-child) { text-align: right; }
        .anual-table-wrap th:last-child, .anual-table-wrap td:last-child { text-align: center; }
        @media (max-width: 720px) { .anual-summary-grid { grid-template-columns: repeat(2, 1fr); } }
      `}</style>
    </div>
  );
}
