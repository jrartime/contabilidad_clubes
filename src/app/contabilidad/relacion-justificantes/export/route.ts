import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveClubId } from "@/lib/club";
import { getMyClubRole } from "@/lib/clubRole";
import { csvEscape, formatCsvNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

function canView(role: string | null) {
  return role === "owner" || role === "admin" || role === "manager" || role === "viewer";
}

export async function GET(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const clubId = await getActiveClubId();
  if (!clubId) {
    return NextResponse.json({ error: "No hay club activo" }, { status: 400 });
  }

  const myRole = await getMyClubRole(clubId);
  if (!canView(myRole)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const url = new URL(req.url);
  const programa_id_str = url.searchParams.get("programa_id");
  const isProgramaNoneFilter = programa_id_str === "none";
  const programa_id = programa_id_str ? Number(programa_id_str) : null;
  const hasProgramaFilter =
    isProgramaNoneFilter || (!!programa_id && Number.isFinite(programa_id));
  const proveedor_id_str = url.searchParams.get("proveedor_id");
  const proveedor_id = proveedor_id_str ? Number(proveedor_id_str) : null;
  const hasProveedorFilter = !!proveedor_id && Number.isFinite(proveedor_id);

  let q = supabase
    .from("contabilidad")
    .select(
      [
        "id_contabilidad",
        "numero_factura",
        "fecha",
        "fecha_pago",
        "importe_imputado",
        "proveedor:proveedores!contabilidad_proveedor_fk (proveedor, cif)",
        "concepto_ref:conceptos!contabilidad_concepto_id_fkey (concepto)",
        "created_at",
      ].join(",")
    )
    .eq("club_id", clubId);

  if (hasProgramaFilter) {
    q = isProgramaNoneFilter ? q.is("programa_id", null) : q.eq("programa_id", programa_id);
  }
  if (hasProveedorFilter) q = q.eq("proveedor_id", proveedor_id);

  const { data: rows, error } = await q
    .order("fecha", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const safeRows = rows ?? [];

  const header = [
    "Nº",
    "Acreedor",
    "CIF/NIF",
    "Nº de factura",
    "Fecha factura",
    "Fecha pago factura",
    "Importe imputado",
    "Relación con el proyecto subvencionado",
  ];

  const lines: string[] = [];
  lines.push(header.map(csvEscape).join(";"));

  let totalJustificado = 0;
  safeRows.forEach((r: any, idx: number) => {
    const imputado = Number(r.importe_imputado ?? 0) || 0;
    totalJustificado += imputado;

    lines.push(
      [
        idx + 1,
        r.proveedor?.proveedor ?? "",
        r.proveedor?.cif ?? "",
        r.numero_factura ?? "",
        r.fecha ?? "",
        r.fecha_pago ?? "",
        formatCsvNumber(imputado),
        r.concepto_ref?.concepto ?? "",
      ].map(csvEscape).join(";")
    );
  });

  lines.push("");
  lines.push(
    [
      "TOTAL IMPORTE JUSTIFICADO",
      "",
      "",
      "",
      "",
      "",
      formatCsvNumber(totalJustificado),
      "",
    ].map(csvEscape).join(";")
  );

  const csv = "\uFEFF" + lines.join("\n");

  const now = new Date();
  const ymd = now.toISOString().slice(0, 10);
  let filenameBase = "relacion_justificantes_todos";
  if (hasProgramaFilter && hasProveedorFilter) {
    filenameBase = isProgramaNoneFilter
      ? `relacion_justificantes_sin_programa_proveedor_${proveedor_id}`
      : `relacion_justificantes_programa_${programa_id}_proveedor_${proveedor_id}`;
  } else if (hasProgramaFilter) {
    filenameBase = isProgramaNoneFilter
      ? "relacion_justificantes_sin_programa"
      : `relacion_justificantes_programa_${programa_id}`;
  } else if (hasProveedorFilter) {
    filenameBase = `relacion_justificantes_proveedor_${proveedor_id}`;
  }

  const filename = `${filenameBase}_${ymd}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
