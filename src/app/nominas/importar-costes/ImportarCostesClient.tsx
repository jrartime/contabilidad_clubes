"use client";

import React, { useRef, useState, useTransition } from "react";
import {
  importarNominasCostesAction,
  parsearExcelCostesAction,
  type CostesRow,
  type ParsedCostesRow,
} from "./actions";

// ──────────────────────────────────────────
// Types
// ──────────────────────────────────────────
type Personal = { id_personal: number; nombre: string };

// ──────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────
function r2(n: number) {
  return Math.round(n * 100) / 100;
}

function fmtDate(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function fmtNum(n: number | null | undefined) {
  if (n == null) return "—";
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function normalizeName(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");
}

function autoMatch(trabajador: string, personal: Personal[]): number | null {
  const target = normalizeName(trabajador);
  let bestId: number | null = null;
  let bestScore = 0;
  for (const p of personal) {
    const candidate = normalizeName(p.nombre);
    const targetWords = new Set(target.split(" "));
    const candidateWords = candidate.split(" ");
    const matches = candidateWords.filter((w) => targetWords.has(w)).length;
    const score = matches / Math.max(targetWords.size, candidateWords.length);
    if (score > bestScore) {
      bestScore = score;
      bestId = p.id_personal;
    }
  }
  return bestScore >= 0.5 ? bestId : null;
}

// ──────────────────────────────────────────
// Main component
// ──────────────────────────────────────────
export default function ImportarCostesClient({
  personal,
  programas,
  conceptos,
  categorias,
  entidades,
}: {
  personal: Personal[];
  programas: { id_programa: number; programa: string; anio?: number | null }[];
  conceptos: { id_concepto: number; concepto: string }[];
  categorias: { id_categoria: number; categoria: string }[];
  entidades: { id_entidad: number; entidad: string }[];
}) {
  const [isParsing, startParsing] = useTransition();
  const [isImporting, startImporting] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  type Step = "upload" | "mapping" | "preview";
  const [step, setStep] = useState<Step>("upload");
  const [parseError, setParseError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const [parsedRows, setParsedRows] = useState<ParsedCostesRow[]>([]);
  const [nameMap, setNameMap] = useState<Record<string, number | "">>({});

  // Optional global fields
  const [programaId, setProgramaId] = useState<number | "">("");
  const [categoriaId, setCategoriaId] = useState<number | "">("");
  const [conceptoId, setConceptoId] = useState<number | "">("");
  const [entidadId, setEntidadId] = useState<number | "">("");

  // ── Step 1: upload & server-side parse ──
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);

    const fd = new FormData();
    fd.append("file", file);

    startParsing(async () => {
      const result = await parsearExcelCostesAction(fd);
      if (!result.ok) {
        setParseError(result.error);
        // Reset the input so the same file can be re-selected
        if (fileRef.current) fileRef.current.value = "";
        return;
      }

      const uniqueNames = [...new Set(result.rows.map((r) => r.trabajador))];
      const initialMap: Record<string, number | ""> = {};
      for (const name of uniqueNames) {
        initialMap[name] = autoMatch(name, personal) ?? "";
      }

      setParsedRows(result.rows);
      setNameMap(initialMap);
      setStep("mapping");
    });
  }

  // ── Build final rows for import ──
  function buildFinalRows(): CostesRow[] {
    return parsedRows
      .filter((r) => nameMap[r.trabajador])
      .map((r) => {
        const ss = r2(r.coste_empresarial - r.bruto);
        return {
          personal_id: nameMap[r.trabajador] as number,
          fecha: r.fecha,
          bruto: r.bruto,
          coste_empresarial: r.coste_empresarial,
          ss,
          bruto_imputado: r.bruto,
          ss_imputado: ss,
          importe_total: r.coste_empresarial,
          importe_imputado: r.coste_empresarial,
          programa_id: programaId || null,
          categoria_id: categoriaId || null,
          concepto_id: conceptoId || null,
          entidad_id: entidadId || null,
        };
      });
  }

  // ── Step 3: import ──
  function handleImport() {
    const rows = buildFinalRows();
    if (rows.length === 0) {
      setImportError("No hay filas con trabajador asignado para importar.");
      return;
    }
    setImportError(null);
    startImporting(async () => {
      const result = await importarNominasCostesAction(rows);
      if (!result.ok) {
        setImportError(result.error);
        return;
      }
      window.location.href = "/nominas";
    });
  }

  // ── Derived ──
  const unmappedCount = Object.values(nameMap).filter((v) => !v).length;
  const finalRows = step === "preview" ? buildFinalRows() : [];
  const mappedCount = finalRows.length;
  const personalById = new Map(personal.map((p) => [p.id_personal, p.nombre]));

  // ── Styles ──
  const selectStyle: React.CSSProperties = {
    padding: "4px 8px",
    fontSize: 13,
    borderRadius: 4,
    border: "1px solid #ddd",
    width: "100%",
  };
  const thStyle: React.CSSProperties = {
    textAlign: "left",
    padding: "6px 10px",
    background: "#f5f5f5",
    fontWeight: 600,
    fontSize: 12,
    borderBottom: "2px solid #ddd",
    whiteSpace: "nowrap",
  };
  const tdStyle: React.CSSProperties = {
    padding: "5px 10px",
    borderBottom: "1px solid #eee",
    fontSize: 13,
    verticalAlign: "middle",
  };
  const errorBox: React.CSSProperties = {
    background: "#fff0f0",
    border: "2px solid #f87171",
    borderRadius: 8,
    padding: "12px 16px",
    fontSize: 13,
    color: "#b91c1c",
    fontWeight: 600,
  };

  // ─────────────────────────────────────────
  // STEP 1 — Seleccionar archivo
  // ─────────────────────────────────────────
  if (step === "upload") {
    return (
      <div style={{ maxWidth: 540 }}>
        <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 8, padding: 14, marginBottom: 16, fontSize: 13 }}>
          <strong>Formato esperado:</strong> columnas <code>TRABAJADOR</code>, <code>Fecha</code>, <code>BRUTO</code>, <code>COSTE TOT</code>.<br />
          Acepta archivos <code>.xls</code> y <code>.xlsx</code>.
        </div>

        <div
          style={{
            border: "2px dashed #cbd5e1",
            borderRadius: 12,
            padding: 40,
            textAlign: "center",
            background: isParsing ? "#f8fafc" : "#fff",
          }}
        >
          {isParsing ? (
            <p style={{ margin: 0, fontWeight: 600, fontSize: 15, opacity: 0.7 }}>
              Leyendo archivo…
            </p>
          ) : (
            <>
              <p style={{ margin: "0 0 16px", fontWeight: 600, fontSize: 15 }}>
                Selecciona el archivo Excel
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".xls,.xlsx"
                style={{ display: "none" }}
                onChange={handleFileChange}
              />
              <button
                type="button"
                className="icon-button"
                style={{ padding: "10px 28px", fontSize: 14 }}
                onClick={() => fileRef.current?.click()}
              >
                📂 Elegir archivo…
              </button>
            </>
          )}
        </div>

        {parseError && (
          <div style={{ ...errorBox, marginTop: 12 }}>⚠ {parseError}</div>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────
  // STEP 2 — Mapeo de nombres
  // ─────────────────────────────────────────
  if (step === "mapping") {
    const uniqueNames = Object.keys(nameMap);
    return (
      <div style={{ display: "grid", gap: 20 }}>
        <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 8, padding: 12, fontSize: 13 }}>
          Se detectaron <strong>{parsedRows.length} filas</strong> con <strong>{uniqueNames.length} trabajadores únicos</strong>.
          Asigna cada nombre a la persona correspondiente del club.
        </div>

        {/* Tabla de mapeo */}
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Trabajadores detectados</h3>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Nombre en Excel</th>
                <th style={{ ...thStyle, textAlign: "center", width: 60 }}>Filas</th>
                <th style={{ ...thStyle, width: 300 }}>Personal del club</th>
              </tr>
            </thead>
            <tbody>
              {uniqueNames.map((name) => {
                const count = parsedRows.filter((r) => r.trabajador === name).length;
                const selected = nameMap[name];
                return (
                  <tr key={name}>
                    <td style={tdStyle}>{name}</td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>{count}</td>
                    <td style={tdStyle}>
                      <select
                        value={selected}
                        onChange={(e) =>
                          setNameMap((m) => ({ ...m, [name]: e.target.value ? Number(e.target.value) : "" }))
                        }
                        style={{
                          ...selectStyle,
                          borderColor: selected ? "#ddd" : "#f87171",
                          background: selected ? undefined : "#fff5f5",
                        }}
                      >
                        <option value="">— sin asignar (no se importará) —</option>
                        {personal.map((p) => (
                          <option key={p.id_personal} value={p.id_personal}>{p.nombre}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {unmappedCount > 0 && (
            <p style={{ fontSize: 12, color: "#92400e", marginTop: 6 }}>
              ⚠ {unmappedCount} trabajador(es) sin asignar — sus filas no se importarán.
            </p>
          )}
        </div>

        {/* Campos opcionales */}
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Campos opcionales (para todas las filas)</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 12 }}>
            {[
              { label: "Programa", value: programaId, set: setProgramaId, opts: programas.map((p) => ({ id: p.id_programa, label: `${p.anio ? `[${p.anio}] ` : ""}${p.programa}` })) },
              { label: "Categoría", value: categoriaId, set: setCategoriaId, opts: categorias.map((c) => ({ id: c.id_categoria, label: c.categoria })) },
              { label: "Concepto",  value: conceptoId,  set: setConceptoId,  opts: conceptos.map((c)  => ({ id: c.id_concepto,  label: c.concepto  })) },
              { label: "Entidad",   value: entidadId,   set: setEntidadId,   opts: entidades.map((e)  => ({ id: e.id_entidad,   label: e.entidad   })) },
            ].map(({ label, value, set, opts }) => (
              <label key={label} style={{ display: "grid", gap: 4, fontSize: 13 }}>
                {label}
                <select value={value} onChange={(e) => set(e.target.value ? Number(e.target.value) : "")} style={selectStyle}>
                  <option value="">(ninguno)</option>
                  {opts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              </label>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" onClick={() => { setParsedRows([]); setNameMap({}); setStep("upload"); }} style={{ padding: "8px 16px", cursor: "pointer" }}>
            ← Cambiar archivo
          </button>
          <button
            type="button"
            className="icon-button"
            style={{ padding: "8px 24px" }}
            onClick={() => setStep("preview")}
          >
            Ver previsualización →
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────
  // STEP 3 — Previsualización e importar
  // ─────────────────────────────────────────
  const skippedCount = parsedRows.length - mappedCount;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: 12, fontSize: 13 }}>
        Se van a importar <strong>{mappedCount} nóminas</strong>
        {skippedCount > 0 && <span style={{ color: "#92400e" }}> (se omiten {skippedCount} filas sin trabajador asignado)</span>}.
      </div>

      {importError && <div style={errorBox}>⚠ Error al importar: {importError}</div>}

      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 750, fontSize: 13 }}>
          <thead>
            <tr>
              <th style={thStyle}>Personal</th>
              <th style={thStyle}>Fecha</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Bruto</th>
              <th style={{ ...thStyle, textAlign: "right" }}>SS</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Coste emp.</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Total / Imputado</th>
            </tr>
          </thead>
          <tbody>
            {finalRows.map((r, i) => {
              const ss = r2(r.coste_empresarial - r.bruto);
              return (
                <tr key={i} style={{ background: i % 2 === 0 ? undefined : "#fafafa" }}>
                  <td style={tdStyle}>{personalById.get(r.personal_id) ?? `#${r.personal_id}`}</td>
                  <td style={tdStyle}>{fmtDate(r.fecha)}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{fmtNum(r.bruto)}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{fmtNum(ss)}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{fmtNum(r.coste_empresarial)}</td>
                  <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600 }}>{fmtNum(r.coste_empresarial)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 700, background: "#f5f5f5" }}>
              <td style={{ ...tdStyle, borderTop: "2px solid #ddd" }} colSpan={2}>Total ({mappedCount})</td>
              <td style={{ ...tdStyle, textAlign: "right", borderTop: "2px solid #ddd" }}>{fmtNum(finalRows.reduce((s, r) => s + r.bruto, 0))}</td>
              <td style={{ ...tdStyle, textAlign: "right", borderTop: "2px solid #ddd" }}>{fmtNum(finalRows.reduce((s, r) => s + r2(r.coste_empresarial - r.bruto), 0))}</td>
              <td style={{ ...tdStyle, textAlign: "right", borderTop: "2px solid #ddd" }}>{fmtNum(finalRows.reduce((s, r) => s + r.coste_empresarial, 0))}</td>
              <td style={{ ...tdStyle, textAlign: "right", borderTop: "2px solid #ddd" }}>{fmtNum(finalRows.reduce((s, r) => s + r.coste_empresarial, 0))}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button type="button" onClick={() => setStep("mapping")} style={{ padding: "8px 16px", cursor: "pointer" }} disabled={isImporting}>
          ← Editar mapeo
        </button>
        <button
          type="button"
          className="icon-button"
          style={{ padding: "10px 28px", fontSize: 14 }}
          onClick={handleImport}
          disabled={isImporting || mappedCount === 0}
        >
          {isImporting ? "Importando…" : `✓ Importar ${mappedCount} nóminas`}
        </button>
      </div>
    </div>
  );
}
