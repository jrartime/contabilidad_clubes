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
  const programaIdRaw = url.searchParams.get("programa_id");
  const isProgramaNoneFilter = programaIdRaw === "none";
  const programaId = programaIdRaw ? Number(programaIdRaw) : null;
  const hasProgramaFilter =
    isProgramaNoneFilter || (!!programaId && Number.isFinite(programaId));
  const proveedorIdRaw = url.searchParams.get("proveedor_id");
  const proveedorId = proveedorIdRaw ? Number(proveedorIdRaw) : null;
  const hasProveedorFilter = !!proveedorId && Number.isFinite(proveedorId);

  let q = supabase
    .from("contabilidad")
    .select(
      [
        "id_contabilidad",
        "fecha",
        "fecha_pago",
        "numero_factura",
        "detalle",
        "importe_total",
        "importe_imputado",
        "proveedor:proveedores!contabilidad_proveedor_fk (proveedor)",
        "programa_ref:programas!contabilidad_programa_id_fkey (programa)",
        "categoria_ref:categorias!contabilidad_categoria_id_fkey (categoria)",
        "concepto_ref:conceptos!contabilidad_concepto_id_fkey (concepto)",
      ].join(",")
    )
    .eq("club_id", clubId);

  if (hasProgramaFilter) {
    q = isProgramaNoneFilter ? q.is("programa_id", null) : q.eq("programa_id", programaId);
  }
  if (hasProveedorFilter) q = q.eq("proveedor_id", proveedorId);

  const { data: rows, error } = await q
    .order("fecha", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const safeRows = rows ?? [];
  const totals = safeRows.reduce(
    (acc: { total: number; imputado: number }, r: any) => {
      acc.total += Number(r.importe_total ?? 0) || 0;
      acc.imputado += Number(r.importe_imputado ?? 0) || 0;
      return acc;
    },
    { total: 0, imputado: 0 }
  );
  const pendiente = totals.total - totals.imputado;

  const header = [
    "ID",
    "Fecha devengo",
    "Fecha pago",
    "Tipo",
    "Proveedor",
    "Programa",
    "Categoría",
    "Concepto",
    "Nº factura",
    "Detalle",
    "Importe total",
    "Importe imputado",
    "Pendiente",
  ];

  const lines: string[] = [];
  lines.push(header.map(csvEscape).join(";"));

  for (const r of safeRows as any[]) {
    const total = Number(r.importe_total ?? 0) || 0;
    const imputado = Number(r.importe_imputado ?? 0) || 0;
    const rowPendiente = total - imputado;

    lines.push(
      [
        r.id_contabilidad,
        r.fecha ?? "",
        r.fecha_pago ?? "",
        "",
        r.proveedor?.proveedor ?? "",
        r.programa_ref?.programa ?? "",
        r.categoria_ref?.categoria ?? "",
        r.concepto_ref?.concepto ?? "",
        r.numero_factura ?? "",
        r.detalle ?? "",
        formatCsvNumber(total),
        formatCsvNumber(imputado),
        formatCsvNumber(rowPendiente),
      ]
        .map(csvEscape)
        .join(";")
    );
  }

  lines.push("");
  lines.push(
    [
      "TOTAL",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      formatCsvNumber(totals.total),
      formatCsvNumber(totals.imputado),
      formatCsvNumber(pendiente),
    ]
      .map(csvEscape)
      .join(";")
  );

  const csv = "\uFEFF" + lines.join("\n");
  const ymd = new Date().toISOString().slice(0, 10);
  let filenameBase = "estado_liquidacion_todos";

  if (hasProgramaFilter && hasProveedorFilter) {
    filenameBase = isProgramaNoneFilter
      ? `estado_liquidacion_sin_programa_proveedor_${proveedorId}`
      : `estado_liquidacion_programa_${programaId}_proveedor_${proveedorId}`;
  } else if (hasProgramaFilter) {
    filenameBase = isProgramaNoneFilter
      ? "estado_liquidacion_sin_programa"
      : `estado_liquidacion_programa_${programaId}`;
  } else if (hasProveedorFilter) {
    filenameBase = `estado_liquidacion_proveedor_${proveedorId}`;
  }

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filenameBase}_${ymd}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
