import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveClubId } from "@/lib/club";
import { getMyClubRole, canAccessConciliation } from "@/lib/clubRole";

export default async function Conciliacion1a1Page() {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const clubId = await getActiveClubId();
  if (!clubId) redirect("/clubs");

  // ✅ Control de acceso por rol
  const role = await getMyClubRole(clubId);
  if (!canAccessConciliation(role)) redirect("/no-autorizado");

  const { data, error } = await supabase
    .from("vw_sugerencias_conciliacion_1a1")
    .select(
      "club_id,id_contabilidad,fecha_factura,numero_factura,proveedor,importe_total,pendiente,id_banco,fecha_operativa,importe,detalle,referencia_1,referencia_2,dias_dif"
    )
    .eq("club_id", clubId)
    .order("dias_dif", { ascending: true })
    .limit(200);

  return (
    <div style={{ maxWidth: 1300, margin: "0 auto", padding: 16 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Conciliación 1 a 1</h1>
</div>

      {error && (
        <p style={{ marginTop: 12 }}>
          Error cargando sugerencias: <b>{error.message}</b>
        </p>
      )}

      <p style={{ marginTop: 10, opacity: 0.8 }}>
        Club: <b>{clubId}</b> · Registros mostrados: <b>{(data ?? []).length}</b>
      </p>

      <div style={{ overflowX: "auto", marginTop: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              {[
                "Factura",
                "Proveedor",
                "Fecha factura",
                "Importe",
                "Banco",
                "Fecha banco",
                "Importe banco",
                "Días",
                "Detalle banco",
                "Acción",
              ].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: "left",
                    borderBottom: "1px solid #ddd",
                    padding: 8,
                    whiteSpace: "nowrap",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {(data ?? []).map((r: any) => (
              <tr key={`${r.id_contabilidad}-${r.id_banco}`}>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  <div>
                    <b>{r.numero_factura ?? "(sin nº)"}</b>
                  </div>
                  <div style={{ opacity: 0.7 }}>id_contabilidad: {r.id_contabilidad}</div>
                </td>

                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{r.proveedor}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{r.fecha_factura}</td>

                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  {Number(r.importe_total).toFixed(2)}
                </td>

                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  <b>id_banco: {r.id_banco}</b>
                </td>

                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{r.fecha_operativa}</td>

                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  {Number(r.importe).toFixed(2)}
                </td>

                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{r.dias_dif}</td>

                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  <div
                    style={{
                      maxWidth: 420,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {r.detalle}
                  </div>
                </td>

                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  <form action="/api/conciliar/1a1" method="post">
                    <input type="hidden" name="club_id" value={clubId} />
                    <input type="hidden" name="contabilidad_id" value={r.id_contabilidad} />
                    <input type="hidden" name="banco_id" value={r.id_banco} />
                    <button type="submit" style={{ padding: "6px 10px", cursor: "pointer" }}>
                      Conciliar
                    </button>
                  </form>
                </td>
              </tr>
            ))}

            {(data ?? []).length === 0 && !error && (
              <tr>
                <td colSpan={10} style={{ padding: 12, opacity: 0.8 }}>
                  No hay sugerencias 1a1 para este club.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
