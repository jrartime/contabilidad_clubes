import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveClubId } from "@/lib/club";
import { getMyClubRole } from "@/lib/clubRole";
import { csvEscape, formatCsvNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

function canView(role: string | null) {
  return role === "owner" || role === "admin" || role === "manager" || role === "viewer";
}

function formatMonthYear(value: any) {
  const s = String(value ?? "").trim();
  if (!s) return "";
  const iso = /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : s;
  const parts = iso.split("-");
  if (parts.length < 2) return s;
  return `${parts[1]}/${parts[0]}`;
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
  const programa_id = programa_id_str && !isProgramaNoneFilter ? Number(programa_id_str) : null;
  const hasProgramaFilter =
    isProgramaNoneFilter || (!!programa_id && Number.isFinite(programa_id));

  let q = supabase
    .from("contabilidad")
    .select(
      [
        "id_contabilidad",
        "fecha",
        "personal_id",
        "bruto",
        "bruto_imputado",
        "ss",
        "ss_imputado",
        "importe_imputado",
        "created_at",
      ].join(",")
    )
    .eq("club_id", clubId)
    .eq("tipo_id", 3);

  if (hasProgramaFilter) {
    q = isProgramaNoneFilter ? q.is("programa_id", null) : q.eq("programa_id", programa_id);
  }

  const { data: rows, error } = await q
    .order("fecha", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: personal } = await supabase
    .from("personal")
    .select("id_personal, nombre")
    .order("nombre", { ascending: true });

  const personalMap = new Map<number, string>();
  (personal ?? []).forEach((p: any) => {
    if (p?.id_personal) personalMap.set(Number(p.id_personal), p.nombre ?? "");
  });

  const safeRows = rows ?? [];

  const header = [
    "Nº",
    "Nombre de la persona trabajadora",
    "Mes y año",
    "Total devengado",
    "Importe imputado",
    "Seguridad Social a cargo de la entidad",
    "Importe de Seguridad Social imputado",
    "Total",
  ];

  const lines: string[] = [];
  lines.push(header.map(csvEscape).join(";"));

  let totalJustificado = 0;
  safeRows.forEach((r: any, idx: number) => {
    const total = Number(r.importe_imputado ?? 0) || 0;
    totalJustificado += total;
    lines.push(
      [
        idx + 1,
        personalMap.get(Number(r.personal_id)) ?? "",
        formatMonthYear(r.fecha),
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
      "TOTAL JUSTIFICADO",
      "",
      "",
      "",
      "",
      "",
      "",
      formatCsvNumber(totalJustificado),
    ].map(csvEscape).join(";")
  );

  const csv = "\uFEFF" + lines.join("\n");

  const now = new Date();
  const ymd = now.toISOString().slice(0, 10);
  const filenameBase = hasProgramaFilter
    ? isProgramaNoneFilter
      ? "nominas_sin_programa"
      : `nominas_programa_${programa_id}`
    : "nominas";
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
