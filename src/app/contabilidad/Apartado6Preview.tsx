"use client";

import { useRef, useState, type CSSProperties } from "react";
import { csvEscape, formatCsvNumber, formatDateEs, formatDecimal } from "@/lib/format";

type JustificanteItem = {
  numero: number;
  acreedor: string;
  cif: string;
  numero_factura: string;
  fecha: string;
  fecha_pago: string;
  importe_imputado: number;
  relacion_proyecto: string;
  entidad_financiadora?: string;
};

type NominaItem = {
  numero: number;
  nombre: string;
  mes: string;
  total_devengado: number;
  importe_imputado: number;
  ss_cargo_entidad: number;
  ss_imputado: number;
  total: number;
};

const DOCUMENTACION_ITEMS = [
  {
    key: "gasto",
    label: "Justificantes de gasto (facturas y demás documentos de valor probatorio equivalente, nóminas, seguridad social, etc.).",
  },
  {
    key: "pago",
    label: "Justificantes de pago (transferencias/en efectivo).",
  },
  {
    key: "personal",
    label:
      "(Solo para gastos de personal) Original y copia de recibos de nómina, documentos derivados del Sistema de Liquidación Directa de cotizaciones a la Seguridad Social (SLD), Recibo de Liquidación de Cotizaciones (RLC), Relación Nominal de Trabajadores (RNT) y Modelos 111 y 190 de ingresos por retenciones de IRPF.",
  },
  {
    key: "profesionales",
    label: "(Solo para prestación de servicios de profesionales) Modelos 111 y 190 de ingresos por retenciones de IRPF.",
  },
  {
    key: "viajes",
    label:
      "(Solo para gastos de viaje y dietas de manutención) Liquidación individual de cada dieta o gasto de viaje realizado en la que constarán los datos y la firma del perceptor, los conceptos de gasto, los datos de la entidad subvencionada y la firma de su representante legal.",
  },
] as const;

type DocKey = (typeof DOCUMENTACION_ITEMS)[number]["key"];

export function Apartado6Preview({ exportParamsStr }: { exportParamsStr: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [items61, setItems61] = useState<JustificanteItem[]>([]);
  const [total61, setTotal61] = useState(0);
  const [items62, setItems62] = useState<NominaItem[]>([]);
  const [total62, setTotal62] = useState(0);
  const [items63, setItems63] = useState<JustificanteItem[]>([]);
  const [total63, setTotal63] = useState(0);

  const [checklist, setChecklist] = useState<Record<DocKey, boolean>>({
    gasto: false,
    pago: false,
    personal: false,
    profesionales: false,
    viajes: false,
  });

  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  function buildUrl(apiPath: string, extra?: Record<string, string>) {
    const params = new URLSearchParams(exportParamsStr);
    if (extra) for (const [k, v] of Object.entries(extra)) params.set(k, v);
    const qs = params.toString();
    return qs ? `${apiPath}?${qs}` : apiPath;
  }

  async function openPreview() {
    setOpen(true);
    setLoading(true);
    setError(null);
    setActionMsg(null);
    try {
      const [resA, resB] = await Promise.all([
        fetch(buildUrl("/contabilidad/relacion-justificantes/export", { format: "json" })),
        fetch(buildUrl("/contabilidad/cofinanciacion/export", { format: "json" })),
      ]);
      if (!resA.ok || !resB.ok) throw new Error("No se pudo cargar la memoria económica justificativa.");
      const dataA = await resA.json();
      const dataB = await resB.json();
      setItems61(dataA.items ?? []);
      setTotal61(dataA.total ?? 0);
      setItems62(dataA.nominas?.items ?? []);
      setTotal62(dataA.nominas?.total ?? 0);
      setItems63(dataB.items ?? []);
      setTotal63(dataB.total ?? 0);
    } catch (e: any) {
      setError(e?.message ?? "Error cargando el informe.");
    } finally {
      setLoading(false);
    }
  }

  function closePreview() {
    setOpen(false);
  }

  function toggleDoc(key: DocKey) {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function buildCsv() {
    const lines: string[] = [];
    lines.push("6. MEMORIA ECONÓMICA JUSTIFICATIVA");
    lines.push("");
    lines.push("JUSTIFICACIÓN A. Importe subvencionado por el Ayuntamiento de Oviedo");
    lines.push("6.1. Relación de justificantes");
    lines.push(
      ["Nº", "Acreedor", "CIF/NIF", "Nº de factura", "Fecha factura", "Fecha pago factura", "Importe imputado", "Relación con el proyecto subvencionado"]
        .map(csvEscape)
        .join(";")
    );
    items61.forEach((it) => {
      lines.push(
        [it.numero, it.acreedor, it.cif, it.numero_factura, it.fecha, it.fecha_pago, formatCsvNumber(it.importe_imputado), it.relacion_proyecto]
          .map(csvEscape)
          .join(";")
      );
    });
    lines.push("");
    lines.push(["TOTAL IMPORTE JUSTIFICADO", "", "", "", "", "", formatCsvNumber(total61), ""].map(csvEscape).join(";"));
    lines.push("");
    lines.push("6.2. Relación de nóminas");
    lines.push(
      ["Nº", "Nombre de la persona trabajadora", "Mes", "Total devengado", "Importe imputado", "Seguridad Social a cargo de la entidad", "Importe de Seguridad Social imputado", "Total"]
        .map(csvEscape)
        .join(";")
    );
    items62.forEach((it) => {
      lines.push(
        [it.numero, it.nombre, it.mes, formatCsvNumber(it.total_devengado), formatCsvNumber(it.importe_imputado), formatCsvNumber(it.ss_cargo_entidad), formatCsvNumber(it.ss_imputado), formatCsvNumber(it.total)]
          .map(csvEscape)
          .join(";")
      );
    });
    lines.push("");
    lines.push(["TOTAL IMPORTE JUSTIFICADO", "", "", "", "", "", "", formatCsvNumber(total62)].map(csvEscape).join(";"));
    lines.push("");
    lines.push("Documentación que se acompaña a la justificación económica");
    DOCUMENTACION_ITEMS.forEach((d) => {
      lines.push([checklist[d.key] ? "[X]" : "[ ]", d.label].map(csvEscape).join(";"));
    });
    lines.push("");
    lines.push("JUSTIFICACIÓN B. Importe financiado por la propia entidad o por otras instituciones públicas o privadas");
    lines.push("6.3. Declaración responsable de cofinanciación");
    lines.push(
      ["Nº", "Acreedor", "CIF/NIF", "Nº de factura", "Fecha factura", "Fecha pago factura", "Importe imputado", "Relación con el proyecto subvencionado", "Entidad financiadora"]
        .map(csvEscape)
        .join(";")
    );
    items63.forEach((it) => {
      lines.push(
        [it.numero, it.acreedor, it.cif, it.numero_factura, it.fecha, it.fecha_pago, formatCsvNumber(it.importe_imputado), it.relacion_proyecto, it.entidad_financiadora ?? ""]
          .map(csvEscape)
          .join(";")
      );
    });
    lines.push("");
    lines.push(["TOTAL IMPORTE JUSTIFICADO", "", "", "", "", "", formatCsvNumber(total63), "", ""].map(csvEscape).join(";"));
    return "﻿" + lines.join("\n");
  }

  function descargarCsv() {
    const csv = buildCsv();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `apartado_6_memoria_justificativa_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function descargarPdf() {
    setBusyAction("pdf");
    setActionMsg(null);
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      const doc = new jsPDF({ orientation: "landscape" }) as any;

      doc.setFontSize(13);
      doc.text("6. MEMORIA ECONÓMICA JUSTIFICATIVA", 14, 14);
      doc.setFontSize(11);
      doc.text("JUSTIFICACIÓN A. Importe subvencionado por el Ayuntamiento de Oviedo", 14, 21);
      doc.setFontSize(9);
      doc.text("6.1. Relación de justificantes", 14, 27);
      autoTable(doc, {
        startY: 31,
        head: [["Nº", "Acreedor", "CIF/NIF", "Nº factura", "Fecha factura", "Fecha pago", "Importe imputado", "Relación con el proyecto"]],
        body: items61.map((it) => [it.numero, it.acreedor, it.cif, it.numero_factura, formatDateEs(it.fecha), formatDateEs(it.fecha_pago), formatDecimal(it.importe_imputado), it.relacion_proyecto]),
        foot: [["", "", "", "", "", "TOTAL IMPORTE JUSTIFICADO", formatDecimal(total61), ""]],
        styles: { fontSize: 8 },
        headStyles: { fillColor: [30, 58, 138] },
      });

      let y = (doc as any).lastAutoTable?.finalY ?? 31;
      doc.setFontSize(10);
      doc.text("6.2. Relación de nóminas", 14, y + 10);
      autoTable(doc, {
        startY: y + 14,
        head: [["Nº", "Nombre", "Mes", "Total devengado", "Importe imputado", "SS a cargo entidad", "Importe SS imputado", "Total"]],
        body: items62.map((it) => [it.numero, it.nombre, it.mes, formatDecimal(it.total_devengado), formatDecimal(it.importe_imputado), formatDecimal(it.ss_cargo_entidad), formatDecimal(it.ss_imputado), formatDecimal(it.total)]),
        foot: [["", "", "", "", "", "", "TOTAL IMPORTE JUSTIFICADO", formatDecimal(total62)]],
        styles: { fontSize: 8 },
        headStyles: { fillColor: [30, 58, 138] },
      });

      y = (doc as any).lastAutoTable?.finalY ?? y;
      doc.setFontSize(10);
      doc.text("Documentación que se acompaña a la justificación económica", 14, y + 10);
      doc.setFontSize(8);
      let docY = y + 16;
      DOCUMENTACION_ITEMS.forEach((d) => {
        const mark = checklist[d.key] ? "[X]" : "[ ]";
        const text = doc.splitTextToSize(`${mark} ${d.label}`, 260);
        doc.text(text, 14, docY);
        docY += text.length * 4 + 2;
      });

      doc.setFontSize(11);
      doc.text("JUSTIFICACIÓN B. Importe financiado por la propia entidad o por otras instituciones públicas o privadas", 14, docY + 8);
      doc.setFontSize(9);
      doc.text("6.3. Declaración responsable de cofinanciación", 14, docY + 14);
      autoTable(doc, {
        startY: docY + 18,
        head: [["Nº", "Acreedor", "CIF/NIF", "Nº factura", "Fecha factura", "Fecha pago", "Importe imputado", "Relación con el proyecto", "Entidad financiadora"]],
        body: items63.map((it) => [it.numero, it.acreedor, it.cif, it.numero_factura, formatDateEs(it.fecha), formatDateEs(it.fecha_pago), formatDecimal(it.importe_imputado), it.relacion_proyecto, it.entidad_financiadora ?? ""]),
        foot: [["", "", "", "", "", "", "TOTAL IMPORTE JUSTIFICADO", formatDecimal(total63), ""]],
        styles: { fontSize: 8 },
        headStyles: { fillColor: [30, 58, 138] },
      });

      doc.save(`apartado_6_memoria_justificativa_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch {
      setActionMsg("No se pudo generar el PDF.");
    } finally {
      setBusyAction(null);
    }
  }

  async function copiarComoImagen() {
    setBusyAction("imagen");
    setActionMsg(null);
    try {
      if (!containerRef.current) throw new Error("Contenido no disponible");
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(containerRef.current, { backgroundColor: "#ffffff", scale: 2 });
      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("No se pudo generar la imagen");
      if (!("clipboard" in navigator) || !(window as any).ClipboardItem) {
        throw new Error("Este navegador no permite copiar imágenes al portapapeles");
      }
      await navigator.clipboard.write([new (window as any).ClipboardItem({ "image/png": blob })]);
      setActionMsg("Apartado 6 copiado como imagen al portapapeles.");
    } catch (e: any) {
      setActionMsg(e?.message ?? "No se pudo copiar la imagen.");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openPreview}
        className="app-action-link"
        style={{ cursor: "pointer" }}
        title="Apartado 6 completo: Memoria económica justificativa (6.1, 6.2, 6.3 y documentación a acompañar)"
      >
        Justificación completa (apartado 6)
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          onClick={closePreview}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 10,
              padding: 16,
              maxWidth: "95vw",
              maxHeight: "90vh",
              overflow: "auto",
              width: 1100,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <h2 style={{ margin: 0, fontSize: 16, flex: 1 }}>
                6. Memoria económica justificativa (6.1, 6.2 y 6.3)
              </h2>
              <button type="button" onClick={closePreview} className="icon-button tooltip-button" aria-label="Cerrar">
                ✕
              </button>
            </div>

            {loading ? <p>Cargando…</p> : null}
            {error ? <p style={{ color: "#b42318" }}>{error}</p> : null}

            {!loading && !error ? (
              <>
                <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                  <button type="button" className="app-action-link" style={{ cursor: "pointer" }} onClick={descargarCsv}>
                    Descargar CSV
                  </button>
                  <button
                    type="button"
                    className="app-action-link"
                    style={{ cursor: "pointer" }}
                    onClick={descargarPdf}
                    disabled={busyAction === "pdf"}
                  >
                    {busyAction === "pdf" ? "Generando PDF…" : "Descargar PDF"}
                  </button>
                  <button
                    type="button"
                    className="app-action-link"
                    style={{ cursor: "pointer" }}
                    onClick={copiarComoImagen}
                    disabled={busyAction === "imagen"}
                  >
                    {busyAction === "imagen" ? "Copiando…" : "Copiar como imagen"}
                  </button>
                </div>
                {actionMsg ? <p style={{ marginTop: -4, marginBottom: 10 }}>{actionMsg}</p> : null}

                <div ref={containerRef} style={{ background: "#fff" }}>
                  <h3 style={{ fontSize: 14, margin: "0 0 4px" }}>
                    JUSTIFICACIÓN A. Importe subvencionado por el Ayuntamiento de Oviedo
                  </h3>
                  <p style={{ fontSize: 12, margin: "0 0 8px", opacity: 0.8 }}>6.1. Relación de justificantes</p>
                  <div style={{ overflowX: "auto" }}>
                    <table style={tableStyle}>
                      <thead>
                        <tr>
                          {["Nº", "Acreedor", "CIF/NIF", "Nº factura", "Fecha factura", "Fecha pago factura", "Importe imputado", "Relación con el proyecto subvencionado"].map((h) => (
                            <th key={h} style={thStyle}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {items61.length === 0 ? (
                          <tr><td colSpan={8} style={emptyTdStyle}>No hay gastos de Categoría A con los filtros actuales.</td></tr>
                        ) : (
                          items61.map((it) => (
                            <tr key={it.numero}>
                              <td style={tdStyle}>{it.numero}</td>
                              <td style={tdStyle}>{it.acreedor}</td>
                              <td style={tdStyle}>{it.cif}</td>
                              <td style={tdStyle}>{it.numero_factura}</td>
                              <td style={tdStyle}>{formatDateEs(it.fecha)}</td>
                              <td style={tdStyle}>{formatDateEs(it.fecha_pago)}</td>
                              <td style={{ ...tdStyle, textAlign: "right" }}>{formatDecimal(it.importe_imputado)}</td>
                              <td style={tdStyle}>{it.relacion_proyecto}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={6} style={totalTdStyle}>TOTAL IMPORTE JUSTIFICADO</td>
                          <td style={totalTdStyle}>{formatDecimal(total61)}</td>
                          <td style={tdStyle}></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  <h3 style={{ fontSize: 14, margin: "20px 0 8px" }}>6.2. Relación de nóminas</h3>
                  <div style={{ overflowX: "auto" }}>
                    <table style={tableStyle}>
                      <thead>
                        <tr>
                          {["Nº", "Nombre de la persona trabajadora", "Mes", "Total devengado", "Importe imputado", "Seguridad Social a cargo de la entidad", "Importe de Seguridad Social imputado", "Total"].map((h) => (
                            <th key={h} style={thStyle}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {items62.length === 0 ? (
                          <tr><td colSpan={8} style={emptyTdStyle}>No hay nóminas de Categoría A con los filtros actuales.</td></tr>
                        ) : (
                          items62.map((it) => (
                            <tr key={it.numero}>
                              <td style={tdStyle}>{it.numero}</td>
                              <td style={tdStyle}>{it.nombre}</td>
                              <td style={tdStyle}>{it.mes}</td>
                              <td style={{ ...tdStyle, textAlign: "right" }}>{formatDecimal(it.total_devengado)}</td>
                              <td style={{ ...tdStyle, textAlign: "right" }}>{formatDecimal(it.importe_imputado)}</td>
                              <td style={{ ...tdStyle, textAlign: "right" }}>{formatDecimal(it.ss_cargo_entidad)}</td>
                              <td style={{ ...tdStyle, textAlign: "right" }}>{formatDecimal(it.ss_imputado)}</td>
                              <td style={{ ...tdStyle, textAlign: "right" }}>{formatDecimal(it.total)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={6} style={totalTdStyle}>TOTAL IMPORTE JUSTIFICADO</td>
                          <td colSpan={2} style={totalTdStyle}>{formatDecimal(total62)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  <h3 style={{ fontSize: 14, margin: "20px 0 8px" }}>
                    Documentación que se acompaña a la justificación económica
                  </h3>
                  <div style={{ display: "grid", gap: 8, marginBottom: 20 }}>
                    {DOCUMENTACION_ITEMS.map((d) => (
                      <label
                        key={d.key}
                        style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, cursor: "pointer" }}
                      >
                        <span
                          onClick={() => toggleDoc(d.key)}
                          style={{
                            flex: "0 0 auto",
                            width: 16,
                            height: 16,
                            border: "1px solid #333",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            marginTop: 1,
                            fontSize: 12,
                            lineHeight: 1,
                            userSelect: "none",
                          }}
                        >
                          {checklist[d.key] ? "✓" : ""}
                        </span>
                        <span onClick={() => toggleDoc(d.key)}>{d.label}</span>
                      </label>
                    ))}
                  </div>

                  <h3 style={{ fontSize: 14, margin: "20px 0 4px" }}>
                    JUSTIFICACIÓN B. Importe financiado por la propia entidad o por otras instituciones públicas o privadas
                  </h3>
                  <p style={{ fontSize: 12, margin: "0 0 8px", opacity: 0.8 }}>6.3. Declaración responsable de cofinanciación</p>
                  <div style={{ overflowX: "auto" }}>
                    <table style={tableStyle}>
                      <thead>
                        <tr>
                          {["Nº", "Acreedor", "CIF/NIF", "Nº factura", "Fecha factura", "Fecha pago factura", "Importe imputado", "Relación con el proyecto subvencionado", "Entidad financiadora"].map((h) => (
                            <th key={h} style={thStyle}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {items63.length === 0 ? (
                          <tr><td colSpan={9} style={emptyTdStyle}>No hay gastos de Categoría B con los filtros actuales.</td></tr>
                        ) : (
                          items63.map((it) => (
                            <tr key={it.numero}>
                              <td style={tdStyle}>{it.numero}</td>
                              <td style={tdStyle}>{it.acreedor}</td>
                              <td style={tdStyle}>{it.cif}</td>
                              <td style={tdStyle}>{it.numero_factura}</td>
                              <td style={tdStyle}>{formatDateEs(it.fecha)}</td>
                              <td style={tdStyle}>{formatDateEs(it.fecha_pago)}</td>
                              <td style={{ ...tdStyle, textAlign: "right" }}>{formatDecimal(it.importe_imputado)}</td>
                              <td style={tdStyle}>{it.relacion_proyecto}</td>
                              <td style={tdStyle}>{it.entidad_financiadora}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={6} style={totalTdStyle}>TOTAL IMPORTE JUSTIFICADO</td>
                          <td style={totalTdStyle}>{formatDecimal(total63)}</td>
                          <td colSpan={2} style={tdStyle}></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

const tableStyle: CSSProperties = {
  borderCollapse: "collapse",
  width: "100%",
  fontSize: 13,
  background: "#fff",
};

const thStyle: CSSProperties = {
  border: "1px solid #1e3a8a",
  padding: "6px 8px",
  background: "#1e3a8a",
  color: "#fff",
  textAlign: "left",
  whiteSpace: "nowrap",
};

const tdStyle: CSSProperties = {
  border: "1px solid #ddd",
  padding: "6px 8px",
  whiteSpace: "nowrap",
};

const emptyTdStyle: CSSProperties = {
  border: "1px solid #ddd",
  padding: 10,
  textAlign: "center",
};

const totalTdStyle: CSSProperties = {
  ...tdStyle,
  fontWeight: 700,
  textAlign: "right",
};
