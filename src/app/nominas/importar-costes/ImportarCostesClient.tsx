"use client";

import React, { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { importarNominasCostesAction, type CostesRow } from "./actions";

// ──────────────────────────────────────────
// Types
// ──────────────────────────────────────────
type Personal = { id_personal: number; nombre: string };
type Option = { id: number; label: string };

type ParsedRow = {
  trabajador: string; // raw name from Excel
  fecha: string;      // YYYY-MM-DD
  bruto: number;
  coste_empresarial: number;
};

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

/** Normalize a name to lowercase words for fuzzy matching */
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

/** Try to auto-match an Excel worker name to a personal_id */
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

/** Parse an Excel date cell → YYYY-MM-DD string */
function parseDateCell(raw: unknown): string | null {
  if (!raw) return null;
  if (raw instanceof Date) {
    const iso = raw.toISOString().slice(0, 10);
    return iso;
  }
  if (typeof raw === "number") {
    const d = new Date(Math.round((raw - 25569) * 86400 * 1000));
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  const s = String(raw).trim();
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  return null;
}

/** Find column index by header keyword (case-insensitive) */
function findCol(headers: string[], ...keywords: string[]): number {
  return headers.findIndex((h) =>
    keywords.some((k) => h.toLowerCase().includes(k.toLowerCase()))
  );
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
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Step state ──
  type Step = "upload" | "mapping" | "preview";
  const [step, setStep] = useState<Step>("upload");
  const [parseError, setParseError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // ── Parsed rows ──
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);

  // ── Unique worker names → selected personal_id ──
  const [nameMap, setNameMap] = useState<Record<string, number | "">>({});

  // ── Global optional fields ──
  const [programaId, setProgramaId] = useState<number | "">("");
  const [categoriaId, setCategoriaId] = useState<number | "">("");
  const [conceptoId, setConceptoId] = useState<number | "">("");
  const [entidadId, setEntidadId] = useState<number | "">("");

  // ──────────────────────────────────────────
  // Step 1: Parse file
  // ──────────────────────────────────────────
  async function handleFile(file: File) {
    setParseError(null);
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, {
        header: 1,
        defval: null,
        blankrows: false,
      });

      if (raw.length === 0) {
        setParseError("El archivo está vacío o no tiene datos.");
        return;
      }

      // Detect header row: look for a row that has "TRABAJADOR" or "BRUTO"
      let dataStart = 0;
      let headers: string[] = [];
      for (let i = 0; i < Math.min(raw.length, 5); i++) {
        const row = raw[i].map((c) => String(c ?? "").trim());
        if (row.some((c) => /trabajador|bruto|coste/i.test(c))) {
          headers = row;
          dataStart = i + 1;
          break;
        }
      }
      if (!headers.length) {
        // No header detected — use positional: col2=TRABAJADOR, col3=Fecha, col4=BRUTO, col11=COSTE TOT
        headers = [];
        dataStart = 0;
      }

      // Find column indices
      const colTrabajador = headers.length ? findCol(headers, "TRABAJADOR", "trabajador") : 2;
      const colFecha      = headers.length ? findCol(headers, "Fecha", "FECHA") : 3;
      const colBruto      = headers.length ? findCol(headers, "BRUTO") : 4;
      const colCoste      = headers.length ? findCol(headers, "COSTE", "coste_tot", "coste tot") : 11;

      const parsed: ParsedRow[] = [];
      for (let i = dataStart; i < raw.length; i++) {
        const row = raw[i];
        const trabajador = String(row[colTrabajador] ?? "").trim();
        const fecha = parseDateCell(row[colFecha]);
        const bruto = typeof row[colBruto] === "number" ? (row[colBruto] as number) : null;
        const coste = typeof row[colCoste] === "number" ? (row[colCoste] as number) : null;

        if (!trabajador || !fecha || bruto == null || coste == null) continue;

        parsed.push({
          trabajador,
          fecha,
          bruto: r2(bruto),
          coste_empresarial: r2(coste),
        });
      }

      if (parsed.length === 0) {
        setParseError("No se encontraron filas con datos válidos (trabajador, fecha, bruto, coste tot).");
        return;
      }

      // Auto-match unique names
      const uniqueNames = [...new Set(parsed.map((r) => r.trabajador))];
      const initialMap: Record<string, number | ""> = {};
      for (const name of uniqueNames) {
        const matched = autoMatch(name, personal);
        initialMap[name] = matched ?? "";
      }

      setParsedRows(parsed);
      setNameMap(initialMap);
      setStep("mapping");
    } catch (e: any) {
      setParseError(`Error al leer el archivo: ${e?.message ?? String(e)}`);
    }
  }

  // ──────────────────────────────────────────
  // Step 3: Build final rows & import
  // ──────────────────────────────────────────
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

  function handleImport() {
    const rows = buildFinalRows();
    if (rows.length === 0) {
      setImportError("No hay filas con trabajador asignado para importar.");
      return;
    }
    setImportError(null);
    startTransition(async () => {
      try {
        await importarNominasCostesAction(rows);
        // Hard navigation: ensures the nominas page re-fetches fresh data from the server
        window.location.href = "/nominas";
      } catch (e: any) {
        const msg = e?.message ?? String(e);
        // Ignore Next.js internal redirect (shouldn't happen here, but just in case)
        if (msg.includes("NEXT_REDIRECT")) {
          window.location.href = "/nominas";
          return;
        }
        setImportError(msg);
      }
    });
  }

  // ──────────────────────────────────────────
  // UI helpers
  // ──────────────────────────────────────────
  const unmappedNames = Object.entries(nameMap)
    .filter(([, v]) => !v)
    .map(([k]) => k);

  const finalRows = step === "preview" ? buildFinalRows() : [];

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

  // ──────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────
  // ── STEP 1: Upload ──────────────────────────────────
  if (step === "upload") {
    return (
      <div style={{ maxWidth: 560 }}>
        <div
          style={{
            border: "2px dashed #ddd",
            borderRadius: 12,
            padding: 32,
            textAlign: "center",
            background: "#fafafa",
          }}
        >
          <p style={{ margin: "0 0 8px", fontWeight: 600, fontSize: 15 }}>
            Selecciona el archivo Excel (.xls / .xlsx)
          </p>
          <p style={{ margin: "0 0 16px", fontSize: 13, opacity: 0.7 }}>
            Formato esperado: columnas TRABAJADOR, Fecha, BRUTO, COSTE TOT
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".xls,.xlsx"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          <button
            type="button"
            className="icon-button"
            style={{ padding: "10px 24px", fontSize: 14 }}
            onClick={() => fileRef.current?.click()}
          >
            Elegir archivo…
          </button>
        </div>
        {parseError && (
          <p style={{ color: "red", marginTop: 12, fontSize: 13 }}>⚠ {parseError}</p>
        )}
      </div>
    );
  }

  // ── STEP 2: Name mapping ────────────────────────────
  if (step === "mapping") {
    const uniqueNames = Object.keys(nameMap);
    return (
      <div style={{ display: "grid", gap: 20 }}>
        <div
          style={{
            background: "#f0f9ff",
            border: "1px solid #bae6fd",
            borderRadius: 8,
            padding: 12,
            fontSize: 13,
          }}
        >
          Se han detectado <strong>{parsedRows.length} filas</strong> con{" "}
          <strong>{uniqueNames.length} trabajadores únicos</strong>.
          Asigna cada nombre a la persona correspondiente en el club.
        </div>

        {/* Name mapping table */}
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>
            Mapeo de trabajadores
          </h3>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Nombre en Excel</th>
                <th style={thStyle}>Filas</th>
                <th style={{ ...thStyle, width: 280 }}>Personal del club</th>
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
                          setNameMap((m) => ({
                            ...m,
                            [name]: e.target.value ? Number(e.target.value) : "",
                          }))
                        }
                        style={{
                          ...selectStyle,
                          borderColor: selected ? "#ddd" : "#f87171",
                          background: selected ? undefined : "#fff5f5",
                        }}
                      >
                        <option value="">— sin asignar —</option>
                        {personal.map((p) => (
                          <option key={p.id_personal} value={p.id_personal}>
                            {p.nombre}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {unmappedNames.length > 0 && (
            <p style={{ fontSize: 12, color: "#b45309", marginTop: 6 }}>
              ⚠ {unmappedNames.length} trabajador(es) sin asignar — sus filas no se importarán.
            </p>
          )}
        </div>

        {/* Optional global fields */}
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>
            Campos opcionales para todas las filas
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: 12,
            }}
          >
            <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
              Programa
              <select
                value={programaId}
                onChange={(e) => setProgramaId(e.target.value ? Number(e.target.value) : "")}
                style={selectStyle}
              >
                <option value="">(ninguno)</option>
                {programas.map((p) => (
                  <option key={p.id_programa} value={p.id_programa}>
                    {p.anio ? `[${p.anio}] ` : ""}{p.programa}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
              Categoría
              <select
                value={categoriaId}
                onChange={(e) => setCategoriaId(e.target.value ? Number(e.target.value) : "")}
                style={selectStyle}
              >
                <option value="">(ninguna)</option>
                {categorias.map((c) => (
                  <option key={c.id_categoria} value={c.id_categoria}>
                    {c.categoria}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
              Concepto
              <select
                value={conceptoId}
                onChange={(e) => setConceptoId(e.target.value ? Number(e.target.value) : "")}
                style={selectStyle}
              >
                <option value="">(ninguno)</option>
                {conceptos.map((c) => (
                  <option key={c.id_concepto} value={c.id_concepto}>
                    {c.concepto}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
              Entidad
              <select
                value={entidadId}
                onChange={(e) => setEntidadId(e.target.value ? Number(e.target.value) : "")}
                style={selectStyle}
              >
                <option value="">(ninguna)</option>
                {entidades.map((e) => (
                  <option key={e.id_entidad} value={e.id_entidad}>
                    {e.entidad}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={() => { setParsedRows([]); setNameMap({}); setStep("upload"); }}
            style={{ padding: "8px 16px", cursor: "pointer" }}
          >
            ← Volver
          </button>
          <button
            type="button"
            className="icon-button"
            style={{ padding: "8px 20px" }}
            onClick={() => setStep("preview")}
          >
            Vista previa →
          </button>
        </div>
      </div>
    );
  }

  // ── STEP 3: Preview & confirm ───────────────────────
  const mappedCount = finalRows.length;
  const skippedCount = parsedRows.length - mappedCount;
  const personalById = new Map(personal.map((p) => [p.id_personal, p.nombre]));

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div
        style={{
          background: "#f0fdf4",
          border: "1px solid #86efac",
          borderRadius: 8,
          padding: 12,
          fontSize: 13,
        }}
      >
        Se van a importar <strong>{mappedCount} nóminas</strong>
        {skippedCount > 0 && (
          <span style={{ color: "#92400e" }}>
            {" "}(se omiten {skippedCount} filas sin trabajador asignado)
          </span>
        )}.
      </div>

      {importError && (
        <p style={{ color: "red", fontSize: 13 }}>⚠ {importError}</p>
      )}

      {/* Preview table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 800, fontSize: 13 }}>
          <thead>
            <tr>
              <th style={thStyle}>Personal</th>
              <th style={thStyle}>Fecha</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Bruto</th>
              <th style={{ ...thStyle, textAlign: "right" }}>SS</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Coste empresarial</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Importe total</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Importe imputado</th>
            </tr>
          </thead>
          <tbody>
            {finalRows.map((r, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? undefined : "#fafafa" }}>
                <td style={tdStyle}>{personalById.get(r.personal_id) ?? `#${r.personal_id}`}</td>
                <td style={tdStyle}>{fmtDate(r.fecha)}</td>
                <td style={{ ...tdStyle, textAlign: "right" }}>{fmtNum(r.bruto)}</td>
                <td style={{ ...tdStyle, textAlign: "right" }}>{fmtNum(r.ss)}</td>
                <td style={{ ...tdStyle, textAlign: "right" }}>{fmtNum(r.coste_empresarial)}</td>
                <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600 }}>{fmtNum(r.importe_total)}</td>
                <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600 }}>{fmtNum(r.importe_imputado)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 700, background: "#f5f5f5" }}>
              <td style={{ ...tdStyle, borderTop: "2px solid #ddd" }} colSpan={2}>
                Total ({mappedCount} filas)
              </td>
              <td style={{ ...tdStyle, textAlign: "right", borderTop: "2px solid #ddd" }}>
                {fmtNum(finalRows.reduce((s, r) => s + r.bruto, 0))}
              </td>
              <td style={{ ...tdStyle, textAlign: "right", borderTop: "2px solid #ddd" }}>
                {fmtNum(finalRows.reduce((s, r) => s + r.ss, 0))}
              </td>
              <td style={{ ...tdStyle, textAlign: "right", borderTop: "2px solid #ddd" }}>
                {fmtNum(finalRows.reduce((s, r) => s + r.coste_empresarial, 0))}
              </td>
              <td style={{ ...tdStyle, textAlign: "right", borderTop: "2px solid #ddd" }}>
                {fmtNum(finalRows.reduce((s, r) => s + r.importe_total, 0))}
              </td>
              <td style={{ ...tdStyle, textAlign: "right", borderTop: "2px solid #ddd" }}>
                {fmtNum(finalRows.reduce((s, r) => s + r.importe_imputado, 0))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button
          type="button"
          onClick={() => setStep("mapping")}
          style={{ padding: "8px 16px", cursor: "pointer" }}
          disabled={isPending}
        >
          ← Editar mapeo
        </button>
        <button
          type="button"
          className="icon-button"
          style={{ padding: "8px 24px", fontSize: 14 }}
          onClick={handleImport}
          disabled={isPending || mappedCount === 0}
        >
          {isPending ? "Importando…" : `✓ Importar ${mappedCount} nóminas`}
        </button>
      </div>
    </div>
  );
}
