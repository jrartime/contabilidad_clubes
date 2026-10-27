import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveClubId } from "@/lib/club";
import { getMyClubRole } from "@/lib/clubRole";
import { csvEscape, formatCsvNumber } from "@/lib/format";
import { matchesGlobalSearch } from "@/lib/search";

export const dynamic = "force-dynamic";

function canView(role: string | null) {
  return role === "owner" || role === "admin" || role === "manager" || role === "viewer";
}

// Justificación B (Anexo III, 6.3 Declaración responsable de cofinanciación):
// los gastos clasificados en Categoría B (financiados por el propio club o por
// otras instituciones, no por la subvención), respetando los mismos filtros
// que el listado de Contabilidad.
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
  const format = String(url.searchParams.get("format") ?? "csv").trim();
  const programa_id_str = url.searchParams.get("programa_id");
  const isProgramaNoneFilter = programa_id_str === "none";
  const programa_id = programa_id_str ? Number(programa_id_str) : null;
  const hasProgramaFilter =
    isProgramaNoneFilter || (!!programa_id && Number.isFinite(programa_id));
  const proveedor_id_str = url.searchParams.get("proveedor_id");
  const proveedor_id = proveedor_id_str ? Number(proveedor_id_str) : null;
  const hasProveedorFilter = !!proveedor_id && Number.isFinite(proveedor_id);
  const personal_id_str = url.searchParams.get("personal_id");
  const personal_id = personal_id_str ? Number(personal_id_str) : null;
  const hasPersonalFilter = !!personal_id && Number.isFinite(personal_id);
  const tipo_id_str = url.searchParams.get("tipo_id");
  const tipo_id = tipo_id_str ? Number(tipo_id_str) : null;
  const hasTipoFilter = !!tipo_id && Number.isFinite(tipo_id);
  const concepto_id_str = url.searchParams.get("concepto_id");
  const concepto_id = concepto_id_str ? Number(concepto_id_str) : null;
  const hasConceptoFilter = !!concepto_id && Number.isFinite(concepto_id);
  const fecha_desde = String(url.searchParams.get("fecha_desde") ?? "").trim();
  const fecha_hasta = String(url.searchParams.get("fecha_hasta") ?? "").trim();
  const buscar = String(url.searchParams.get("buscar") ?? "").trim();

  let q = supabase
    .from("contabilidad")
    .select(
      [
        "id_contabilidad",
        "numero_factura",
        "fecha",
        "fecha_pago",
        "importe_imputado",
        "observaciones",
        "categoria_ref:categorias!contabilidad_categoria_id_fkey (categoria)",
        "tipo_ref:tipos!contabilidad_tipo_id_fkey (tipo)",
        "proveedor:proveedores!contabilidad_proveedor_fk (proveedor, cif)",
        "concepto_ref:conceptos!contabilidad_concepto_id_fkey (concepto)",
        "entidad_financiadora:entidades!contabilidad_entidad_financiadora_id_fkey (entidad)",
        "created_at",
      ].join(",")
    )
    .eq("club_id", clubId);

  if (hasProgramaFilter) {
    // Filtro explícito: mostrar ese programa concreto (igual que el listado principal)
    q = isProgramaNoneFilter ? q.is("programa_id", null) : q.eq("programa_id", programa_id);
  } else {
    // Sin filtro: excluir asientos de programas dados de baja, igual que el listado principal
    const { data: programasActivos } = await supabase
      .from("programas")
      .select("id_programa")
      .eq("club_id", clubId)
      .eq("activo", true);
    const activeProgramIds = (programasActivos ?? []).map((p: any) => Number(p.id_programa));
    q = activeProgramIds.length > 0
      ? q.or(`programa_id.is.null,programa_id.in.(${activeProgramIds.join(",")})`)
      : q.is("programa_id", null);
  }
  if (hasProveedorFilter) q = q.eq("proveedor_id", proveedor_id);
  if (hasPersonalFilter) q = q.eq("personal_id", personal_id);
  if (hasTipoFilter) q = q.eq("tipo_id", tipo_id);
  if (hasConceptoFilter) q = q.eq("concepto_id", concepto_id);
  if (fecha_desde) q = q.gte("fecha", fecha_desde);
  if (fecha_hasta) q = q.lte("fecha", fecha_hasta);

  const { data: rows, error } = await q
    .order("fecha", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const categoriaB = (rows ?? []).filter(
    (r: any) => String(r.categoria_ref?.categoria ?? "").trim().toUpperCase() === "B"
  );
  const esNomina = (r: any) =>
    String(r.tipo_ref?.tipo ?? "").trim().toUpperCase() === "NÓMINA" ||
    String(r.tipo_ref?.tipo ?? "").trim().toUpperCase() === "NOMINA";

  // Igual que en 6.1: las nóminas no se listan una a una, se agrupan y suman
  // por fecha, conservando proveedor/concepto/fecha de pago/entidad financiadora.
  const nominasPorFecha = new Map<string, any>();
  for (const r of categoriaB.filter(esNomina) as any[]) {
    const key = String(r.fecha ?? "");
    const grupo = nominasPorFecha.get(key);
    const importe = Number(r.importe_imputado ?? 0) || 0;
    if (grupo) {
      grupo.importe_imputado += importe;
    } else {
      nominasPorFecha.set(key, {
        numero_factura: "",
        fecha: r.fecha ?? "",
        fecha_pago: r.fecha_pago ?? "",
        importe_imputado: importe,
        proveedor: r.proveedor,
        concepto_ref: r.concepto_ref,
        entidad_financiadora: r.entidad_financiadora,
      });
    }
  }
  const nominasAgrupadas = Array.from(nominasPorFecha.values());

  const combinedRows = [
    ...categoriaB.filter((r: any) => !esNomina(r)),
    ...nominasAgrupadas,
  ].sort((a: any, b: any) => String(a.fecha ?? "").localeCompare(String(b.fecha ?? "")));

  const safeRows = combinedRows.filter((r: any) => matchesGlobalSearch(buscar, [JSON.stringify(r)]));

  if (format === "json") {
    const items = safeRows.map((r: any, idx: number) => ({
      numero: idx + 1,
      acreedor: r.proveedor?.proveedor ?? "",
      cif: r.proveedor?.cif ?? "",
      numero_factura: r.numero_factura ?? "",
      fecha: r.fecha ?? "",
      fecha_pago: r.fecha_pago ?? "",
      importe_imputado: Number(r.importe_imputado ?? 0) || 0,
      relacion_proyecto: r.concepto_ref?.concepto ?? "",
      entidad_financiadora: r.entidad_financiadora?.entidad ?? "",
    }));
    const total = items.reduce((sum, item) => sum + item.importe_imputado, 0);
    return NextResponse.json({ items, total });
  }

  const header = [
    "Nº",
    "Acreedor",
    "CIF/NIF",
    "Nº de factura",
    "Fecha factura",
    "Fecha pago factura",
    "Importe imputado",
    "Relación con el proyecto subvencionado",
    "Entidad financiadora",
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
        r.entidad_financiadora?.entidad ?? "",
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
      "",
    ].map(csvEscape).join(";")
  );

  const csv = "﻿" + lines.join("\n");

  const now = new Date();
  const ymd = now.toISOString().slice(0, 10);
  let filenameBase = "justificacion_b_cofinanciacion_todos";
  if (hasProgramaFilter && hasProveedorFilter) {
    filenameBase = isProgramaNoneFilter
      ? `justificacion_b_cofinanciacion_sin_programa_proveedor_${proveedor_id}`
      : `justificacion_b_cofinanciacion_programa_${programa_id}_proveedor_${proveedor_id}`;
  } else if (hasProgramaFilter) {
    filenameBase = isProgramaNoneFilter
      ? "justificacion_b_cofinanciacion_sin_programa"
      : `justificacion_b_cofinanciacion_programa_${programa_id}`;
  } else if (hasProveedorFilter) {
    filenameBase = `justificacion_b_cofinanciacion_proveedor_${proveedor_id}`;
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
