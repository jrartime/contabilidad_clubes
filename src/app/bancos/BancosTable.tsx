"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { buildFilterHref } from "@/lib/filters";
import { formatDateEs, formatDecimal } from "@/lib/format";
import { asignarProgramaMasivoAction } from "./actions";

type Row = {
  id_banco: number;
  fecha_operativa: string | null;
  fecha_valor: string | null;
  detalle: string | null;
  referencia: string | null;
  referencia_1: string | null;
  referencia_2: string | null;
  categoria: string | null;
  programa_id: number | null;
  concepto_id: number | null;
  orden: number | null;
  debe: number | null;
  haber: number | null;
  saldo: number | null;
  importe: number | null;
};

type BancosSortKey = "fecha_operativa" | "detalle" | "debe" | "haber" | "saldo" | "importe";

type FilterParams = {
  programa_id: string | null;
  concepto_id: string;
  fecha_operativa_desde: string;
  fecha_operativa_hasta: string;
  sort: string;
  dir: string;
};

function money(value: number | null) {
  return value === null || value === undefined ? "-" : formatDecimal(value);
}

export default function BancosTable({
  rows: initialRows,
  canEdit,
  programas,
  conceptos,
  filterParams,
  sortKey,
  sortDir,
}: {
  rows: Row[];
  canEdit: boolean;
  programas: { id_programa: number; programa: string; anio?: number | null }[];
  conceptos: { id_concepto: number; concepto: string }[];
  filterParams: FilterParams;
  sortKey: BancosSortKey;
  sortDir: "asc" | "desc";
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Estado de asignación masiva
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkProgramaId, setBulkProgramaId] = useState<string>("");
  const [bulkResult, setBulkResult] = useState<string | null>(null);

  // Filas con estado local (para reflejar el cambio de programa inmediatamente)
  const [rows, setRows] = useState<Row[]>(initialRows);
  // Sincronizar si el padre pasa nuevas filas (cambio de filtro/navegación)
  React.useEffect(() => { setRows(initialRows); }, [initialRows]);

  const programaById = new Map(
    programas.map((p) => [
      Number(p.id_programa),
      `${p.anio ? `[${p.anio}] ` : ""}${p.programa}`,
    ])
  );
  const conceptoById = new Map(
    conceptos.map((c) => [Number(c.id_concepto), c.concepto])
  );

  // Sort hrefs (URL-based, preservan filtros)
  function sortHref(col: BancosSortKey) {
    const nextDir = sortKey === col && sortDir === "desc" ? "asc" : "desc";
    return buildFilterHref("/bancos", { ...filterParams, sort: col, dir: nextDir }, []);
  }

  const thBase: React.CSSProperties = { borderBottom: "1px solid #ddd", padding: 8, whiteSpace: "nowrap" };

  function sortTh(col: BancosSortKey, label: string, style?: React.CSSProperties) {
    const active = sortKey === col;
    return (
      <th style={{ ...thBase, textAlign: "left", ...style }}>
        <Link href={sortHref(col)} className="table-sort-button" aria-label={`Ordenar por ${label}`}>
          <span>{label}</span>
          <span aria-hidden="true">{active ? (sortDir === "asc" ? "↑" : "↓") : "↕"}</span>
        </Link>
      </th>
    );
  }

  function sortThRight(col: BancosSortKey, label: string, style?: React.CSSProperties) {
    const active = sortKey === col;
    return (
      <th style={{ ...thBase, textAlign: "right", ...style }}>
        <Link href={sortHref(col)} className="table-sort-button" style={{ justifyContent: "flex-end" }} aria-label={`Ordenar por ${label}`}>
          <span aria-hidden="true">{active ? (sortDir === "asc" ? "↑" : "↓") : "↕"}</span>
          <span>{label}</span>
        </Link>
      </th>
    );
  }

  // Selección
  const allSelected = rows.length > 0 && selectedIds.size === rows.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(rows.map((r) => r.id_banco)));
    }
  }

  function toggleRow(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // Ejecutar asignación masiva
  function ejecutarAsignacion() {
    if (!selectedIds.size) return;
    const ids = Array.from(selectedIds);
    const programaIdNum = bulkProgramaId ? Number(bulkProgramaId) : null;
    const programaNombre = programaIdNum
      ? (programaById.get(programaIdNum) ?? `id ${programaIdNum}`)
      : "(sin programa)";

    if (!confirm(
      `¿Asignar el programa "${programaNombre}" a ${ids.length} movimiento(s) seleccionado(s)?`
    )) return;

    startTransition(async () => {
      const result = await asignarProgramaMasivoAction(ids, programaIdNum);
      if (result.error) {
        setBulkResult(`Error: ${result.error}`);
      } else {
        // Actualizar filas localmente
        setRows((prev) =>
          prev.map((r) =>
            selectedIds.has(r.id_banco)
              ? { ...r, programa_id: programaIdNum }
              : r
          )
        );
        setBulkResult(`✓ ${result.updated} movimiento(s) actualizados`);
        setSelectedIds(new Set());
        router.refresh();
      }
    });
  }

  function cancelarBulk() {
    setBulkMode(false);
    setSelectedIds(new Set());
    setBulkProgramaId("");
    setBulkResult(null);
  }

  return (
    <div>
      {/* Barra de asignación masiva */}
      {canEdit && (
        <div style={{ marginBottom: 12 }}>
          {!bulkMode ? (
            <button
              type="button"
              onClick={() => { setBulkMode(true); setBulkResult(null); }}
              className="app-action-link"
              style={{ gap: 8 }}
            >
              <svg className="button-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="5" width="4" height="4" rx="1" />
                <rect x="3" y="11" width="4" height="4" rx="1" />
                <rect x="3" y="17" width="4" height="4" rx="1" />
                <line x1="10" y1="7" x2="21" y2="7" />
                <line x1="10" y1="13" x2="21" y2="13" />
                <line x1="10" y1="19" x2="21" y2="19" />
              </svg>
              Asignación masiva de programa
            </button>
          ) : (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 14px",
              background: "#f0f7ff",
              border: "1px solid #c3d9f5",
              borderRadius: 8,
              flexWrap: "wrap",
            }}>
              {/* Seleccionar todos */}
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 650, cursor: "pointer", whiteSpace: "nowrap" }}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = someSelected; }}
                  onChange={toggleAll}
                  style={{ width: 16, height: 16, accentColor: "var(--primary)" }}
                />
                {selectedIds.size > 0 ? `${selectedIds.size} seleccionado(s)` : "Seleccionar todos"}
              </label>

              <div style={{ width: 1, height: 24, background: "#c3d9f5" }} />

              {/* Selector de programa */}
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 650 }}>
                <span style={{ whiteSpace: "nowrap" }}>Programa:</span>
                <select
                  value={bulkProgramaId}
                  onChange={(e) => setBulkProgramaId(e.currentTarget.value)}
                  style={{ minWidth: 200, height: 34, padding: "0 8px", fontSize: 13 }}
                >
                  <option value="">(sin programa)</option>
                  {programas.map((p) => (
                    <option key={p.id_programa} value={p.id_programa}>
                      {p.anio ? `[${p.anio}] ` : ""}{p.programa}
                    </option>
                  ))}
                </select>
              </label>

              {/* Ejecutar */}
              <button
                type="button"
                onClick={ejecutarAsignacion}
                disabled={isPending || selectedIds.size === 0}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "0 16px",
                  height: 34,
                  borderRadius: 6,
                  background: selectedIds.size > 0 ? "var(--primary)" : "#ccc",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 700,
                  border: 0,
                  cursor: selectedIds.size > 0 ? "pointer" : "not-allowed",
                  minHeight: 34,
                  opacity: isPending ? 0.7 : 1,
                }}
              >
                {isPending ? "Guardando…" : "Ejecutar"}
              </button>

              {/* Cancelar */}
              <button
                type="button"
                onClick={cancelarBulk}
                disabled={isPending}
                className="app-action-link app-action-link-secondary"
                style={{ height: 34, fontSize: 13 }}
              >
                Cancelar
              </button>

              {/* Resultado */}
              {bulkResult && (
                <span style={{ fontSize: 13, color: bulkResult.startsWith("✓") ? "#1a6b2e" : "#b93a48", fontWeight: 650 }}>
                  {bulkResult}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tabla */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              {/* Columna checkbox en modo bulk */}
              {bulkMode && (
                <th style={{ ...thBase, width: 40, textAlign: "center" }} />
              )}
              <th style={{ ...thBase, textAlign: "left", width: 90 }}>Acciones</th>
              {sortTh("fecha_operativa", "Fecha", { width: 120 })}
              {sortTh("detalle", "Detalle", { minWidth: 260 })}
              <th style={{ ...thBase, textAlign: "left", width: 160 }}>Referencia</th>
              <th style={{ ...thBase, textAlign: "left", width: 180 }}>Programa</th>
              <th style={{ ...thBase, textAlign: "left", width: 160 }}>Concepto</th>
              {sortThRight("debe", "Debe", { width: 110 })}
              {sortThRight("haber", "Haber", { width: 110 })}
              {sortThRight("importe", "Importe", { width: 110 })}
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => {
              const isSelected = selectedIds.has(row.id_banco);
              return (
                <tr
                  key={row.id_banco}
                  style={{ background: isSelected ? "#eef5ff" : undefined, cursor: bulkMode ? "pointer" : undefined }}
                  onClick={bulkMode ? () => toggleRow(row.id_banco) : undefined}
                >
                  {/* Checkbox bulk */}
                  {bulkMode && (
                    <td style={{ padding: 8, borderBottom: "1px solid #eee", textAlign: "center" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRow(row.id_banco)}
                        style={{ width: 16, height: 16, accentColor: "var(--primary)", cursor: "pointer" }}
                      />
                    </td>
                  )}

                  <td style={{ padding: 8, borderBottom: "1px solid #eee" }}
                    onClick={bulkMode ? (e) => e.stopPropagation() : undefined}
                  >
                    {canEdit ? (
                      <Link
                        href={`${buildFilterHref("/bancos", { ...filterParams, edit: row.id_banco }, [])}#form`}
                        className="app-action-link"
                        style={{ gap: 6 }}
                        aria-label="Editar movimiento"
                      >
                        <Icon name="edit" />
                        Editar
                      </Link>
                    ) : (
                      <span style={{ opacity: 0.6 }}>-</span>
                    )}
                  </td>

                  <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                    {formatDateEs(row.fecha_operativa)}
                  </td>

                  <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                    <div style={{ fontWeight: 700 }}>{row.detalle ?? "-"}</div>
                    <div style={{ opacity: 0.65, fontSize: 12 }}>
                      id: {row.id_banco}
                      {row.orden !== null && row.orden !== undefined ? ` - orden: ${row.orden}` : ""}
                      {row.referencia_1 ? ` - ref. 1: ${row.referencia_1}` : ""}
                      {row.referencia_2 ? ` - ref. 2: ${row.referencia_2}` : ""}
                    </div>
                  </td>

                  <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                    {row.referencia ?? "-"}
                  </td>

                  <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                    {row.programa_id ? programaById.get(Number(row.programa_id)) ?? row.programa_id : "-"}
                  </td>

                  <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                    {row.concepto_id ? conceptoById.get(Number(row.concepto_id)) ?? row.concepto_id : "-"}
                  </td>

                  <td style={{ padding: 8, borderBottom: "1px solid #eee", textAlign: "right" }}>
                    {money(row.debe)}
                  </td>
                  <td style={{ padding: 8, borderBottom: "1px solid #eee", textAlign: "right" }}>
                    {money(row.haber)}
                  </td>
                  <td style={{ padding: 8, borderBottom: "1px solid #eee", textAlign: "right" }}>
                    {money(row.importe)}
                  </td>
                </tr>
              );
            })}

            {rows.length === 0 && (
              <tr>
                <td colSpan={bulkMode ? 10 : 9} style={{ padding: 12, opacity: 0.8 }}>
                  No hay movimientos todavia.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
