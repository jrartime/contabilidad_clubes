import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveClubId } from "@/lib/club";
import { getMyClubRole, canAccessConciliation } from "@/lib/clubRole";
import ConciliacionManualClient, {
  type AsientoRow,
  type BancoRow,
  type PagoRow,
} from "./ConciliacionManualClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Conciliacion1a1Page() {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const clubId = await getActiveClubId();
  if (!clubId) redirect("/clubs");

  const role = await getMyClubRole(clubId);
  if (!canAccessConciliation(role)) redirect("/no-autorizado");

  // ── 1. IDs ya conciliados ────────────────────────────────────────────────
  const { data: pagosBruto } = await supabase
    .from("pagos")
    .select("contabilidad_id, banco_id, fecha_pago_real, importe_pagado")
    .eq("club_id", clubId)
    .order("fecha_pago_real", { ascending: false })
    .limit(500);

  const pagosList = pagosBruto ?? [];
  const conciliadosContabilidadIds = pagosList.map((p: any) => p.contabilidad_id as number);
  const conciliadosBancoIds = pagosList.map((p: any) => p.banco_id as number);

  // ── 2. Asientos SIN conciliar ────────────────────────────────────────────
  let asientosQ = supabase
    .from("contabilidad")
    .select(
      "id_contabilidad, fecha, numero_factura, importe_total, detalle, " +
      "proveedor:proveedores!contabilidad_proveedor_fk(proveedor), " +
      "programa_ref:programas!contabilidad_programa_id_fkey(programa), " +
      "concepto_ref:conceptos!contabilidad_concepto_id_fkey(concepto)"
    )
    .eq("club_id", clubId)
    .order("fecha", { ascending: false })
    .limit(500);

  if (conciliadosContabilidadIds.length > 0) {
    asientosQ = asientosQ.not(
      "id_contabilidad",
      "in",
      `(${conciliadosContabilidadIds.join(",")})`
    );
  }

  // ── 3. Movimientos bancarios SIN conciliar ───────────────────────────────
  let bancosQ = supabase
    .from("bancos")
    .select("id_banco, fecha_operativa, importe, detalle, referencia_1")
    .eq("club_id", clubId)
    .order("fecha_operativa", { ascending: false })
    .limit(500);

  if (conciliadosBancoIds.length > 0) {
    bancosQ = bancosQ.not(
      "id_banco",
      "in",
      `(${conciliadosBancoIds.join(",")})`
    );
  }

  // ── 4. Detalle de los ya conciliados (para la pestaña "conciliados") ─────
  const conciliadosContabilidadMap = new Map<number, any>();
  const conciliadosBancoMap = new Map<number, any>();

  const [
    { data: asientosBruto },
    { data: bancosBruto },
    { data: asientosDetalle },
    { data: bancosDetalle },
  ] = await Promise.all([
    asientosQ,
    bancosQ,
    conciliadosContabilidadIds.length > 0
      ? supabase
          .from("contabilidad")
          .select(
            "id_contabilidad, fecha, numero_factura, importe_total, detalle, " +
            "proveedor:proveedores!contabilidad_proveedor_fk(proveedor), " +
            "programa_ref:programas!contabilidad_programa_id_fkey(programa)"
          )
          .eq("club_id", clubId)
          .in("id_contabilidad", conciliadosContabilidadIds)
      : Promise.resolve({ data: [], error: null }),
    conciliadosBancoIds.length > 0
      ? supabase
          .from("bancos")
          .select("id_banco, fecha_operativa, importe, detalle, referencia_1")
          .eq("club_id", clubId)
          .in("id_banco", conciliadosBancoIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  // Poblar los mapas
  for (const a of (asientosDetalle ?? [])) {
    conciliadosContabilidadMap.set((a as any).id_contabilidad, a);
  }
  for (const b of (bancosDetalle ?? [])) {
    conciliadosBancoMap.set((b as any).id_banco, b);
  }

  // ── Normalizar asientos ──────────────────────────────────────────────────
  const asientos: AsientoRow[] = (asientosBruto ?? []).map((a: any) => ({
    id_contabilidad: a.id_contabilidad,
    fecha: a.fecha ?? null,
    numero_factura: a.numero_factura ?? null,
    proveedor: a.proveedor?.proveedor ?? null,
    importe_total: Number(a.importe_total ?? 0),
    programa: a.programa_ref?.programa ?? null,
    concepto: a.concepto_ref?.concepto ?? null,
    detalle: a.detalle ?? null,
  }));

  const movimientos: BancoRow[] = (bancosBruto ?? []).map((b: any) => ({
    id_banco: b.id_banco,
    fecha_operativa: b.fecha_operativa ?? null,
    importe: Number(b.importe ?? 0),
    detalle: b.detalle ?? null,
    referencia_1: b.referencia_1 ?? null,
  }));

  const pagos: PagoRow[] = pagosList.map((p: any) => {
    const a = conciliadosContabilidadMap.get(p.contabilidad_id);
    const b = conciliadosBancoMap.get(p.banco_id);
    return {
      contabilidad_id: p.contabilidad_id,
      banco_id: p.banco_id,
      fecha_pago_real: p.fecha_pago_real ?? null,
      importe_pagado: Number(p.importe_pagado ?? 0),
      asiento: a
        ? {
            id_contabilidad: a.id_contabilidad,
            fecha: a.fecha ?? null,
            numero_factura: a.numero_factura ?? null,
            proveedor: a.proveedor?.proveedor ?? null,
            importe_total: Number(a.importe_total ?? 0),
            programa: a.programa_ref?.programa ?? null,
            concepto: null,
            detalle: a.detalle ?? null,
          }
        : undefined,
      banco: b
        ? {
            id_banco: b.id_banco,
            fecha_operativa: b.fecha_operativa ?? null,
            importe: Number(b.importe ?? 0),
            detalle: b.detalle ?? null,
            referencia_1: b.referencia_1 ?? null,
          }
        : undefined,
    };
  });

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: 16 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Conciliación 1 a 1</h1>
      </div>
      <ConciliacionManualClient
        asientos={asientos}
        movimientos={movimientos}
        pagos={pagos}
      />
    </div>
  );
}
