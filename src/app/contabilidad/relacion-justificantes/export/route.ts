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

function getPayrollMonthLabel(value: unknown) {
  const text = String(value ?? "").trim();
  const isoMatch = /^(\d{4})-(\d{2})/.exec(text);
  if (!isoMatch) return "";
  return `${isoMatch[2]}/${isoMatch[1]}`;
}

// Justificación A (Anexo III, JUSTIFICACIÓN A. Importe subvencionado por el
// Ayuntamiento de Oviedo): los gastos clasificados en Categoría A, respetando
// los mismos filtros que el listado de Contabilidad.
// 6.1. Relación de justificantes: todos salvo los de tipo Nómina.
// 6.2. Relación de nóminas: solo los de tipo Nómina.
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
        "bruto",
        "bruto_imputado",
        "ss",
        "ss_imputado",
        "categoria_ref:categorias!contabilidad_categoria_id_fkey (categoria)",
        "tipo_ref:tipos!contabilidad_tipo_id_fkey (tipo)",
        "proveedor:proveedores!contabilidad_proveedor_fk (proveedor, cif)",
        "concepto_ref:conceptos!contabilidad_concepto_id_fkey (concepto)",
        "personal_ref:personal!contabilidad_personal_id_fkey (nombre)",
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

  const categoriaA = (rows ?? []).filter(
    (r: any) => String(r.categoria_ref?.categoria ?? "").trim().toUpperCase() === "A"
  );
  const esNomina = (r: any) =>
    String(r.tipo_ref?.tipo ?? "").trim().toUpperCase() === "NÓMINA" ||
    String(r.tipo_ref?.tipo ?? "").trim().toUpperCase() === "NOMINA";

  const nominasRows = categoriaA
    .filter((r: any) => esNomina(r))
    .filter((r: any) => matchesGlobalSearch(buscar, [JSON.stringify(r)]));

  // En 6.1 las nóminas no se listan una a una (eso es 6.2): se agrupan y
  // suman por fecha, conservando proveedor/concepto/fecha de pago (son
  // consistentes dentro de una misma fecha de nómina).
  const nominasPorFecha = new Map<string, any>();
  for (const r of nominasRows as any[]) {
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
      });
    }
  }
  const nominasAgrupadas = Array.from(nominasPorFecha.values());

  const justificantesRows = [
    ...categoriaA
      .filter((r: any) => !esNomina(r))
      .filter((r: any) => matchesGlobalSearch(buscar, [JSON.stringify(r)])),
    ...nominasAgrupadas,
  ].sort((a: any, b: any) => String(a.fecha ?? "").localeCompare(String(b.fecha ?? "")));

  if (format === "json") {
    const items = justificantesRows.map((r: any, idx: number) => ({
      numero: idx + 1,
      acreedor: r.proveedor?.proveedor ?? "",
      cif: r.proveedor?.cif ?? "",
      numero_factura: r.numero_factura ?? "",
      fecha: r.fecha ?? "",
      fecha_pago: r.fecha_pago ?? "",
      importe_imputado: Number(r.importe_imputado ?? 0) || 0,
      relacion_proyecto: r.concepto_ref?.concepto ?? "",
    }));
    const total = items.reduce((sum, item) => sum + item.importe_imputado, 0);

    const nominaItems = nominasRows.map((r: any, idx: number) => ({
      numero: idx + 1,
      nombre: r.personal_ref?.nombre ?? "",
      mes: getPayrollMonthLabel(r.fecha),
      total_devengado: Number(r.bruto ?? 0) || 0,
      importe_imputado: Number(r.bruto_imputado ?? 0) || 0,
      ss_cargo_entidad: Number(r.ss ?? 0) || 0,
      ss_imputado: Number(r.ss_imputado ?? 0) || 0,
      total: Number(r.importe_imputado ?? 0) || 0,
    }));
    const nominasTotal = nominaItems.reduce((sum, item) => sum + item.total, 0);

    return NextResponse.json({
      items,
      total,
      nominas: { items: nominaItems, total: nominasTotal },
    });
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
  ];

  const lines: string[] = [];
  lines.push("6.1. Relación de justificantes");
  lines.push(header.map(csvEscape).join(";"));

  let totalJustificado = 0;
  justificantesRows.forEach((r: any, idx: number) => {
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

  lines.push("");
  lines.push("");
  lines.push("6.2. Relación de nóminas");
  lines.push(
    [
      "Nº",
      "Nombre de la persona trabajadora",
      "Mes",
      "Total devengado",
      "Importe imputado",
      "Seguridad Social a cargo de la entidad",
      "Importe de Seguridad Social imputado",
      "Total",
    ].map(csvEscape).join(";")
  );

  let totalNominas = 0;
  nominasRows.forEach((r: any, idx: number) => {
    const total = Number(r.importe_imputado ?? 0) || 0;
    totalNominas += total;

    lines.push(
      [
        idx + 1,
        r.personal_ref?.nombre ?? "",
        getPayrollMonthLabel(r.fecha),
        formatCsvNumber(r.bruto),
        formatCsvNumber(r.bruto_imputado),
        formatCsvNumber(r.ss),
        formatCsvNumber(r.ss_imputado),
        formatCsvNumber(total),
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
      "",
      formatCsvNumber(totalNominas),
    ].map(csvEscape).join(";")
  );

  const csv = "﻿" + lines.join("\n");

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
