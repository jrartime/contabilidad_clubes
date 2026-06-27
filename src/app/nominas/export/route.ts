import { NextResponse } from "next/server";
import { getActiveClubId } from "@/lib/club";
import { getMyClubRole } from "@/lib/clubRole";
import { formatCsvNumber } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function canView(role: string | null) {
  return role === "owner" || role === "admin" || role === "manager" || role === "viewer";
}

function formatMonthYear(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const iso = /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : text;
  const parts = iso.split("-");
  if (parts.length < 2) return text;
  return `${parts[1]}/${parts[0]}`;
}

function parseNumberFilter(value: string | null) {
  const n = value ? Number(value) : null;
  return n && Number.isFinite(n) ? n : null;
}

function formatPdfNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return formatCsvNumber(n);
}

function pdfText(value: unknown) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/\r?\n/g, " ");
}

function wrapText(text: string, width: number, fontSize: number) {
  const maxChars = Math.max(1, Math.floor(width / (fontSize * 0.52)));
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

function createPdfBuffer(rows: any[], personalMap: Map<number, string>) {
  const pageWidth = 841.89;
  const pageHeight = 595.28;
  const margin = 24;
  const startX = margin;
  const cellPadding = 4;
  const fontSize = 8;
  const lineHeight = 9.5;
  const columns = [
    { label: "N\u00ba", width: 28, align: "center" as const },
    { label: "Nombre de la persona trabajadora", width: 190, align: "left" as const },
    { label: "Mes", width: 55, align: "center" as const },
    { label: "Total devengado", width: 80, align: "right" as const },
    { label: "Importe imputado", width: 80, align: "right" as const },
    { label: "Seguridad Social a cargo de la entidad", width: 115, align: "right" as const },
    { label: "Importe de Seguridad Social imputado", width: 115, align: "right" as const },
    { label: "Total", width: Math.max(80, pageWidth - margin * 2 - 663), align: "right" as const },
  ];
  const tableWidth = columns.reduce((acc, column) => acc + column.width, 0);
  const pages: string[][] = [[]];
  let page = pages[0];
  let y = margin;

  function pdfY(top: number, height: number) {
    return pageHeight - top - height;
  }

  function add(command: string) {
    page.push(command);
  }

  function textX(text: string, x: number, width: number, align: "left" | "center" | "right") {
    const approxWidth = text.length * fontSize * 0.48;
    if (align === "right") return x + width - cellPadding - approxWidth;
    if (align === "center") return x + (width - approxWidth) / 2;
    return x + cellPadding;
  }

  function drawCell(
    text: string,
    x: number,
    top: number,
    width: number,
    height: number,
    options?: { align?: "left" | "center" | "right"; bold?: boolean; fill?: string }
  ) {
    const bottom = pdfY(top, height);
    if (options?.fill) {
      add(`${options.fill} rg ${x.toFixed(2)} ${bottom.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re f`);
    }
    add(`0 0.322 0.608 RG 1.2 w ${x.toFixed(2)} ${bottom.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re S`);

    const lines = wrapText(text, width - cellPadding * 2, fontSize);
    const font = options?.bold ? "F2" : "F1";
    lines.slice(0, Math.max(1, Math.floor((height - cellPadding * 2) / lineHeight))).forEach((line, index) => {
      const tx = textX(line, x, width, options?.align ?? "left");
      const ty = pageHeight - top - cellPadding - fontSize - index * lineHeight;
      add(`BT /${font} ${fontSize} Tf 0 0 0 rg ${tx.toFixed(2)} ${ty.toFixed(2)} Td (${pdfText(line)}) Tj ET`);
    });
  }

  function drawHeader() {
    drawCell(
      "6.2. Relacion de nominas. Solo para gastos de personal:",
      startX,
      y,
      tableWidth,
      20,
      { bold: true, fill: "0.969 0.969 0.969" }
    );
    y += 20;

    const headerHeight = 42;
    let x = startX;
    columns.forEach((column) => {
      drawCell(column.label, x, y, column.width, headerHeight, {
        align: "center",
        fill: "0.969 0.969 0.969",
      });
      x += column.width;
    });
    y += headerHeight;
  }

  function addPageIfNeeded(height: number) {
    if (y + height <= pageHeight - margin) return;
    page = [];
    pages.push(page);
    y = margin;
    drawHeader();
  }

  function rowHeight(values: string[]) {
    const maxLines = Math.max(
      1,
      ...values.map((value, index) => wrapText(value, columns[index].width - cellPadding * 2, fontSize).length)
    );
    return Math.max(22, maxLines * lineHeight + cellPadding * 2);
  }

  drawHeader();

  let totalJustificado = 0;
  rows.forEach((row, index) => {
    const total = Number(row.importe_imputado ?? 0) || 0;
    totalJustificado += total;
    const values = [
      String(index + 1),
      personalMap.get(Number(row.personal_id)) ?? "",
      formatMonthYear(row.fecha),
      formatPdfNumber(row.bruto),
      formatPdfNumber(row.bruto_imputado),
      formatPdfNumber(row.ss),
      formatPdfNumber(row.ss_imputado),
      formatCsvNumber(total),
    ];
    const height = rowHeight(values);
    addPageIfNeeded(height);

    let x = startX;
    values.forEach((value, columnIndex) => {
      drawCell(value, x, y, columns[columnIndex].width, height, {
        align: columns[columnIndex].align,
      });
      x += columns[columnIndex].width;
    });
    y += height;
  });

  addPageIfNeeded(24);
  const totalLabelWidth = columns.slice(0, 7).reduce((acc, column) => acc + column.width, 0);
  drawCell("TOTAL IMPORTE JUSTIFICADO", startX, y, totalLabelWidth, 22, {
    align: "center",
    bold: true,
  });
  drawCell(formatCsvNumber(totalJustificado), startX + totalLabelWidth, y, columns[7].width, 22, {
    align: "right",
    bold: true,
  });

  const objects: string[] = [];
  function obj(content: string) {
    objects.push(content);
    return objects.length;
  }

  const catalogId = obj("<< /Type /Catalog /Pages 2 0 R >>");
  const kids: number[] = [];
  const pageObjects: { pageId: number; contentId: number }[] = [];
  const fontId = 3;
  const boldFontId = 4;
  obj("<< /Type /Pages /Kids [] /Count 0 >>");
  obj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  obj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");

  for (const commands of pages) {
    const stream = commands.join("\n");
    const contentId = obj(`<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`);
    const pageId = obj(
      [
        "<< /Type /Page",
        "/Parent 2 0 R",
        `/MediaBox [0 0 ${pageWidth} ${pageHeight}]`,
        `/Resources << /Font << /F1 ${fontId} 0 R /F2 ${boldFontId} 0 R >> >>`,
        `/Contents ${contentId} 0 R`,
        ">>",
      ].join(" ")
    );
    kids.push(pageId);
    pageObjects.push({ pageId, contentId });
  }

  objects[1] = `<< /Type /Pages /Kids [${kids.map((id) => `${id} 0 R`).join(" ")}] /Count ${kids.length} >>`;

  const parts: string[] = ["%PDF-1.4\n%\xE2\xE3\xCF\xD3\n"];
  const offsets: number[] = [0];
  for (let i = 0; i < objects.length; i += 1) {
    offsets.push(Buffer.byteLength(parts.join(""), "latin1"));
    parts.push(`${i + 1} 0 obj\n${objects[i]}\nendobj\n`);
  }
  const xrefOffset = Buffer.byteLength(parts.join(""), "latin1");
  parts.push(`xref\n0 ${objects.length + 1}\n`);
  parts.push("0000000000 65535 f \n");
  offsets.slice(1).forEach((offset) => {
    parts.push(`${String(offset).padStart(10, "0")} 00000 n \n`);
  });
  parts.push(`trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\n`);
  parts.push(`startxref\n${xrefOffset}\n%%EOF`);

  return Buffer.from(parts.join(""), "latin1");
}

export async function GET(req: Request) {
  try {
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
    const programaId =
      programaIdRaw && !isProgramaNoneFilter ? parseNumberFilter(programaIdRaw) : null;
    const hasProgramaFilter = isProgramaNoneFilter || !!programaId;
    const personalId = parseNumberFilter(url.searchParams.get("personal_id"));
    const categoriaId = parseNumberFilter(url.searchParams.get("categoria_id"));
    const fechaDesde = String(url.searchParams.get("fecha_desde") ?? "").trim();
    const fechaHasta = String(url.searchParams.get("fecha_hasta") ?? "").trim();

    const { data: programas } = await supabase
      .from("programas")
      .select("id_programa")
      .eq("club_id", clubId)
      .eq("activo", true);
    const activeProgramIds = (programas ?? []).map((program: any) => Number(program.id_programa));

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
      q = isProgramaNoneFilter ? q.is("programa_id", null) : q.eq("programa_id", programaId);
    } else if (activeProgramIds.length > 0) {
      q = q.or(`programa_id.is.null,programa_id.in.(${activeProgramIds.join(",")})`);
    } else {
      q = q.is("programa_id", null);
    }
    if (personalId) q = q.eq("personal_id", personalId);
    if (categoriaId) q = q.eq("categoria_id", categoriaId);
    if (fechaDesde) q = q.gte("fecha", fechaDesde);
    if (fechaHasta) q = q.lte("fecha", fechaHasta);

    const { data: rows, error } = await q
      .order("fecha", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: personal } = await supabase
      .from("personal")
      .select("id_personal, nombre")
      .eq("club_id", clubId)
      .eq("activo", true)
      .order("nombre", { ascending: true });

    const personalMap = new Map<number, string>();
    (personal ?? []).forEach((person: any) => {
      if (person?.id_personal) personalMap.set(Number(person.id_personal), person.nombre ?? "");
    });

    const pdf = await createPdfBuffer((rows ?? []) as any[], personalMap);

    const ymd = new Date().toISOString().slice(0, 10);
    const filenameParts = ["relacion_nominas"];
    if (hasProgramaFilter) {
      filenameParts.push(isProgramaNoneFilter ? "sin_programa" : `programa_${programaId}`);
    }
    if (personalId) filenameParts.push(`personal_${personalId}`);
    if (categoriaId) filenameParts.push(`categoria_${categoriaId}`);
    if (fechaDesde) filenameParts.push(`desde_${fechaDesde}`);
    if (fechaHasta) filenameParts.push(`hasta_${fechaHasta}`);
    const filename = `${filenameParts.join("_")}_${ymd}.pdf`;

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("nominas/export pdf error", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
